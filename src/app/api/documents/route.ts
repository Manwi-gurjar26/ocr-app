import { after } from "next/server";
import type { DocumentRow } from "@/db/schema";
import { ingestUpload, processDocument, UploadError } from "@/lib/pipeline";
import { handle, jsonError, parseListQuery, repo } from "@/lib/server";

export const maxDuration = 300;

export async function GET(req: Request) {
  return handle(async () => {
    const filter = parseListQuery(new URL(req.url).searchParams);
    return Response.json(await repo().list(filter));
  });
}

/** multipart/form-data with one or more `files`. Returns created rows; OCR runs after the response. */
export async function POST(req: Request) {
  return handle(async () => {
    const form = await req.formData().catch(() => null);
    const files = form?.getAll("files").filter((f): f is File => f instanceof File) ?? [];
    if (!files.length) return jsonError("No files uploaded (use form field 'files')", 400);
    if (files.length > 20) return jsonError("At most 20 files per upload", 400);

    const r = repo();
    const created: DocumentRow[] = [];
    const errors: string[] = [];
    for (const f of files) {
      try {
        created.push(await ingestUpload({ repo: r }, { name: f.name, mime: f.type, bytes: Buffer.from(await f.arrayBuffer()) }));
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
