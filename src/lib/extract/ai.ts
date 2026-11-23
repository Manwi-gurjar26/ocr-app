import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { DocType, DocumentFields } from "../types";

export const AI_MODEL = "claude-opus-5-5";

const str = z.string().nullable();
const num = z.number().nullable();
const item = z.object({ description: z.string(), quantity: num, unitPrice: num, amount: num });

export const ExtractionSchema = z.object({
  docType: z.enum(["electricity_bill", "gst_certificate", "bank_statement", "id_card", "invoice", "receipt", "unknown"]),
  electricityBill: z
    .object({
      discom: str, consumerName: str, consumerNumber: str, address: str, billDate: str, billingPeriod: str,
      unitsConsumed: num, sanctionedLoad: str, amountPayable: num, dueDate: str, currency: str,
    })
    .nullable(),
  gstCertificate: z
    .object({
      gstin: str, legalName: str, tradeName: str, address: str, constitution: str, registrationType: str,
      dateOfLiability: str, dateOfIssue: str,
    })
    .nullable(),
  bankStatement: z
    .object({
      bankName: str, accountHolder: str, accountNumber: str, ifsc: str, periodFrom: str, periodTo: str,
      openingBalance: num, closingBalance: num, totalCredits: num, totalDebits: num, currency: str,
      transactions: z.array(z.object({ date: str, description: z.string(), debit: num, credit: num, balance: num })),
    })
    .nullable(),
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
Classify the document as electricity_bill, gst_certificate (Form GST REG-06), bank_statement, id_card (KYC: Aadhaar, PAN, passport, DL, voter ID), invoice, receipt, or unknown.
Fill ONLY the object matching the type; set every other object to null.
Rules:
- Dates as ISO yyyy-mm-dd. Numeric dates in the document are day-first (dd/mm/yyyy).
- Amounts as plain numbers (no currency symbols or commas). Currency as ISO code (INR, USD...).
- Use null for anything not present. Never guess or invent values.
- Aadhaar numbers formatted as "1234 5678 9012".
- billingPeriod as "Month yyyy" or "yyyy-mm-dd to yyyy-mm-dd". unitsConsumed in kWh.
- For bank statements include at most the first 100 transactions.
- An OCR transcript is provided as a hint; trust the image when they disagree.`;

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

type ImageMedia = "image/png" | "image/jpeg" | "image/webp";

export interface AiResult {
  docType: DocType;
  fields: DocumentFields;
}

const KEY: Record<DocType, keyof Extraction | null> = {
  electricity_bill: "electricityBill",
  gst_certificate: "gstCertificate",
  bank_statement: "bankStatement",
  id_card: "idCard",
  invoice: "invoice",
  receipt: "receipt",
  unknown: null,
};

export function toResult(e: Partial<Extraction> & Pick<Extraction, "docType">): AiResult {
  const key = KEY[e.docType];
  const fields = key ? (e[key] as DocumentFields | null | undefined) : null;
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
