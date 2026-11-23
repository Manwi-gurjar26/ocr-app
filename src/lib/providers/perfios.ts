import { z } from "zod";
import type { DocType } from "../types";
import type { DocumentChecker } from "./types";

/**
 * Perfios OCR + Document Tamper adapter (blueprint: KYC documents, cheques, bank statements).
 *
 * IMPORTANT: Perfios APIs are contract-specific and not publicly documented. The request and the
 * `PerfiosResponse` mapping below are a placeholder contract — align both with the API spec Perfios
 * issues with your credentials before enabling in production. Bank statement *analysis* (credit
 * scoring) is Perfios BSA, a separate product; this adapter only covers OCR + tamper signals.
 *
 * Enable with PERFIOS_OCR_URL and PERFIOS_API_KEY.
 */

const PERFIOS_DOC: Partial<Record<DocType, string>> = {
  id_card: "KYC",
  bank_statement: "BANK_STATEMENT",
};

const PerfiosResponse = z.object({
  text: z.string().default(""),
  confidence: z.number().min(0).max(100).default(0),
  pages: z.number().int().positive().default(1),
  documentType: z.string().optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
  tamper: z
    .array(z.object({ code: z.string(), message: z.string(), severity: z.enum(["low", "medium", "high"]) }))
    .default([]),
});

type Fetch = typeof fetch;

export function createPerfiosChecker(fetchImpl: Fetch = fetch): DocumentChecker {
  return {
    name: "perfios",
    available: () => Boolean(process.env.PERFIOS_OCR_URL && process.env.PERFIOS_API_KEY),
    async analyze({ bytes, mime, docType }) {
      const form = new FormData();
      form.set("file", new Blob([new Uint8Array(bytes)], { type: mime }), "document");
      form.set("documentType", (docType && PERFIOS_DOC[docType]) || "AUTO");
      form.set("tamperCheck", "true");
      const res = await fetchImpl(process.env.PERFIOS_OCR_URL!, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.PERFIOS_API_KEY}` },
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`Perfios OCR failed (${res.status})`);
      const body = PerfiosResponse.parse(await res.json());
      return {
        provider: "perfios",
        text: body.text,
        confidence: body.confidence,
        pages: body.pages,
        images: mime.startsWith("image/") ? [bytes] : [],
        fields: body.fields,
        tamper: body.tamper,
      };
    },
  };
}

export const perfiosChecker = createPerfiosChecker();
