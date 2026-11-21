import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { DocType, DocumentFields } from "../types";

export const AI_MODEL = "claude-opus-5-5";

const str = z.string().nullable();
const num = z.number().nullable();
const item = z.object({ description: z.string(), quantity: num, unitPrice: num, amount: num });

export const ExtractionSchema = z.object({
  docType: z.enum(["invoice", "receipt", "id_card", "unknown"]),
  invoice: z
    .object({
      invoiceNumber: str, invoiceDate: str, dueDate: str, vendorName: str, vendorGstin: str, customerName: str,
      subtotal: num, tax: num, total: num, currency: str, lineItems: z.array(item),
    })
    .nullable(),
  receipt: z
    .object({
      merchantName: str, date: str, time: str, paymentMethod: str, subtotal: num, tax: num, total: num,
      currency: str, items: z.array(item),
    })
    .nullable(),
  idCard: z
    .object({
      idType: z.enum(["aadhaar", "pan", "passport", "driving_license", "voter_id", "other"]).nullable(),
      idNumber: str, fullName: str, dateOfBirth: str, gender: str, fatherName: str, address: str, expiryDate: str,
    })
    .nullable(),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

const SYSTEM = `You extract structured data from scanned business and identity documents (mostly Indian).
Classify the document as invoice, receipt, id_card, or unknown, then fill ONLY the matching object; set the other two to null.
Rules:
- Dates as ISO yyyy-mm-dd. Numeric dates in the document are day-first (dd/mm/yyyy).
- Amounts as plain numbers (no currency symbols or commas). Currency as ISO code (INR, USD...).
- Use null for anything not present. Never guess or invent values.
- Aadhaar numbers formatted as "1234 5678 9012".
- An OCR transcript is provided as a hint; trust the image when they disagree.`;

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

type ImageMedia = "image/png" | "image/jpeg" | "image/webp";

export interface AiResult {
  docType: DocType;
  fields: DocumentFields;
}

export function toResult(e: Extraction): AiResult {
  const fields =
    e.docType === "invoice" ? e.invoice : e.docType === "receipt" ? e.receipt : e.docType === "id_card" ? e.idCard : null;
  return { docType: e.docType, fields: fields ?? {} };
}

/** Extract fields with Claude vision. Throws on API errors or refusals so the caller can fall back to rules. */
export async function extractWithAi(
  images: Buffer[],
  ocrText: string,
  client: Pick<Anthropic, "messages"> = new Anthropic(),
): Promise<AiResult> {
  const content: Anthropic.ContentBlockParam[] = images.slice(0, 3).map((img) => ({
    type: "image",
    source: { type: "base64", media_type: "image/png" as ImageMedia, data: img.toString("base64") },
  }));
  content.push({
    type: "text",
    text: `OCR transcript (may contain errors):\n<ocr>\n${ocrText.slice(0, 20_000)}\n</ocr>\n\nExtract the document data.`,
  });

  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(ExtractionSchema) },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") throw new Error("AI declined to process this document");
  if (!response.parsed_output) throw new Error(`AI returned no structured output (stop_reason: ${response.stop_reason})`);
  return toResult(response.parsed_output);
}
