import { after } from "next/server";
import { z } from "zod";
import type { DocumentRow } from "@/db/schema";
import { ingestUpload, processDocument, UploadError } from "@/lib/pipeline";
import { handle, jsonError, parseListQuery, repo } from "@/lib/server";
import { DOC_TYPES } from "@/lib/types";

export const maxDuration = 300;

export async function GET(req: Request) {
  return handle(async () => {
    const filter = parseListQuery(new URL(req.url).searchParams);
    return Response.json(await repo().list(filter));
  });
}

const UploadMeta = z.object({
  docType: z.enum(DOC_TYPES).optional(),
  customerId: z.string().trim().min(1).max(100).optional(),
  declared: z
    .string()
    .max(5000)
    .transform((s, ctx) => {
      try {
        return z.record(z.string(), z.union([z.string().max(300), z.number(), z.null()])).parse(JSON.parse(s));
      } catch {
        ctx.addIssue({ code: "custom", message: "must be a JSON object of customer-entered details" });
        return z.NEVER;
      }
    })
    .optional(),
});

/**
 * multipart/form-data:
 *   files       one or more files (PDF / JPG / PNG / WEBP, ≤ 10 MB each)
 *   docType     optional selected category (electricity_bill, gst_certificate, bank_statement, id_card, ...)
 *   customerId  optional owner id
 *   declared    optional JSON of customer-entered details, e.g. {"consumerNumber":"123456789","consumerName":"ABC Industries"}
 * Returns the created rows (status `uploaded`); OCR + validation run after the response.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const form = await req.formData().catch(() => null);
    const files = form?.getAll("files").filter((f): f is File => f instanceof File) ?? [];
    if (!files.length) return jsonError("No files uploaded (use form field 'files')", 400);
    if (files.length > 20) return jsonError("At most 20 files per upload", 400);
    const str = (k: string) => {
      const v = form?.get(k);
      return typeof v === "string" && v !== "" ? v : undefined;
    };
    const meta = UploadMeta.parse({ docType: str("docType"), customerId: str("customerId"), declared: str("declared") });

    const r = repo();
    const created: DocumentRow[] = [];
    const errors: string[] = [];
    for (const f of files) {
      try {
        created.push(
          await ingestUpload(
            { repo: r },
            {
              name: f.name,
              mime: f.type,
              bytes: Buffer.from(await f.arrayBuffer()),
              customerId: meta.customerId,
              declaredType: meta.docType,
              declared: meta.declared,
            },
          ),
        );
      } catch (e) {
        if (e instanceof UploadError) errors.push(e.message);
        else throw e;
      }
    }
    if (!created.length) return jsonError(errors.join("; "), 400);

    after(async () => {
      for (const d of created) await processDocument({ repo: r }, d.id);
    });
    return Response.json({ items: created, errors }, { status: 201 });
  });
}
