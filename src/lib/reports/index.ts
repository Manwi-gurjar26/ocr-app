import type { DocumentRow } from "@/db/schema";
import { displayFields, formatDate, formatMoney, headline, itemsOf, STATUS_LABEL, TYPE_LABEL } from "../format";
import { isBusy } from "../types";

const EXTRACTION_LABEL: Record<string, string> = { ai: "AI vision", rules: "OCR rules", textract: "Amazon Textract", perfios: "Perfios" };
import { PdfWriter } from "./pdf-kit";

function stamp(d: Date) {
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export async function documentReport(doc: DocumentRow, opts: { includeText?: boolean } = {}): Promise<Uint8Array> {
  const fields = doc.fields as Record<string, unknown>;
  const w = await PdfWriter.create(`${TYPE_LABEL[doc.docType]} Report`);
  w.header(`${TYPE_LABEL[doc.docType]} Report`, `${doc.fileName}  -  generated ${stamp(new Date())}`);

  w.sectionTitle("Document");
  w.keyValues([
    { label: "File", value: doc.fileName },
    { label: "Type", value: TYPE_LABEL[doc.docType] },
    { label: "Uploaded", value: stamp(doc.createdAt) },
    { label: "Status", value: STATUS_LABEL[doc.status] ?? doc.status },
    { label: "Extraction", value: EXTRACTION_LABEL[doc.extractionMethod ?? "rules"] ?? "OCR rules" },
    { label: "OCR confidence", value: doc.ocrConfidence != null ? `${Math.round(doc.ocrConfidence)}%` : "—" },
  ]);

  const rows = displayFields(doc.docType, fields);
  if (rows.length) {
    w.gap(8);
    w.sectionTitle("Extracted data");
    w.keyValues(rows);
  }

  const checks = doc.validation?.checks ?? [];
  if (checks.length) {
    w.gap(8);
    w.sectionTitle("Validation");
    w.table(
      ["Result", "Check", "Detail"],
      checks.map((c) => [c.status.toUpperCase(), c.label, c.message]),
      [0.1, 0.3, 0.6],
      ["left", "left", "left"],
    );
  }
  if (doc.reviewedBy) {
    w.gap(4);
    w.text(`Reviewed by ${doc.reviewedBy}${doc.reviewedAt ? ` on ${stamp(doc.reviewedAt)}` : ""}${doc.reviewNote ? ` - ${doc.reviewNote}` : ""}`);
  }

  const items = itemsOf(doc.docType, fields);
  if (items.length) {
    w.gap(8);
    w.sectionTitle("Line items");
    const cur = fields.currency;
    w.table(
      ["#", "Description", "Qty", "Unit price", "Amount"],
      items.map((it, i) => [
        String(i + 1),
        it.description,
        it.quantity != null ? String(it.quantity) : "",
        it.unitPrice != null ? formatMoney(it.unitPrice, cur) : "",
        formatMoney(it.amount, cur),
      ]),
      [0.06, 0.48, 0.1, 0.18, 0.18],
      ["left", "left", "right", "right", "right"],
    );
  }

  if (opts.includeText !== false && doc.rawText) {
    w.gap(8);
    w.sectionTitle("OCR text");
    w.text(doc.rawText.slice(0, 8000), { size: 8.5 });
  }
  return w.finish();
}

export interface SummaryOptions {
  title?: string;
  filterLabel?: string;
}

export async function summaryReport(docs: DocumentRow[], opts: SummaryOptions = {}): Promise<Uint8Array> {
  const title = opts.title ?? "Documents Summary";
  const w = await PdfWriter.create(title);
  w.header(title, `${opts.filterLabel ?? "All documents"}  -  generated ${stamp(new Date())}`);

  const count = (t: string) => docs.filter((d) => d.docType === t).length;
  const sum = (t: string) =>
    docs
      .filter((d) => d.docType === t && d.status !== "failed" && !isBusy(d.status))
      .reduce((a, d) => a + (headline(d.docType, d.fields as Record<string, unknown>).amount ?? 0), 0);

  const byStatus = (s: string) => String(docs.filter((d) => d.status === s).length);
  w.stats([
    { label: "Documents", value: String(docs.length) },
    { label: "Verified", value: byStatus("verified") },
    { label: "Needs review", value: byStatus("manual_review") },
    { label: "Failed", value: byStatus("failed") },
  ]);
  w.stats([
    { label: "Electricity bills", value: String(count("electricity_bill")) },
    { label: "GST certificates", value: String(count("gst_certificate")) },
    { label: "Bank statements", value: String(count("bank_statement")) },
    { label: "KYC documents", value: String(count("id_card")) },
  ]);
  if (count("invoice") || count("receipt"))
    w.stats([
      { label: "Invoice total", value: formatMoney(sum("invoice")) },
      { label: "Receipt total", value: formatMoney(sum("receipt")) },
    ]);

  w.sectionTitle("Documents");
  if (!docs.length) w.text("No documents match this filter.");
  else
    w.table(
      ["Uploaded", "Type", "Status", "Name / Party", "Amount"],
      docs.map((d) => {
        const f = d.fields as Record<string, unknown>;
        const h = headline(d.docType, f);
        return [
          formatDate(d.createdAt.toISOString()),
          TYPE_LABEL[d.docType],
          STATUS_LABEL[d.status] ?? d.status,
          h.title ?? (d.status === "failed" ? "Failed" : "—"),
          h.amount != null ? formatMoney(h.amount, f.currency) : "",
        ];
      }),
      [0.15, 0.12, 0.3, 0.25, 0.18],
      ["left", "left", "left", "left", "right"],
    );
  return w.finish();
}
