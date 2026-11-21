import { PDFDocument } from "pdf-lib";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import type { DocumentRow } from "@/db/schema";
import { displayFields, formatMoney } from "@/lib/format";
import { documentReport, summaryReport } from "@/lib/reports";
import { safe } from "@/lib/reports/pdf-kit";

function row(p: Partial<DocumentRow>): DocumentRow {
  return {
    id: "00000000-0000-0000-0000-000000000001", fileName: "f.png", mimeType: "image/png", fileSize: 1, filePath: "f.png",
    docType: "unknown", status: "done", rawText: null, ocrConfidence: 90, extractionMethod: "rules", fields: {}, error: null,
    createdAt: new Date("2024-03-15T10:00:00Z"), updatedAt: new Date(), ...p,
  };
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(bytes)), { mergePages: true });
  return text as string;
}

const invoice = row({
  docType: "invoice",
  fileName: "inv-457.png",
  rawText: "TAX INVOICE ₹ 20,060 — Sharma Electronics",
  fields: {
    invoiceNumber: "INV-2024-0457", vendorName: "Sharma Electronics", total: 20060, tax: 3060, currency: "INR",
    lineItems: [{ description: "LED Monitor", quantity: 2, unitPrice: 8500, amount: 17000 }],
  },
});
const aadhaar = row({ docType: "id_card", fields: { idType: "aadhaar", idNumber: "4821 7365 9012", fullName: "Priya Sharma" } });

describe("formatting", () => {
  it("formats INR with Indian grouping and masks Aadhaar", () => {
    expect(formatMoney(120060.5)).toBe("₹1,20,060.50");
    const f = displayFields("id_card", aadhaar.fields as Record<string, unknown>);
    expect(f.find((r) => r.label === "ID Number")?.value).toBe("XXXX XXXX 9012");
    expect(f.find((r) => r.label === "ID Type")?.value).toBe("Aadhaar");
  });

  it("makes text safe for standard PDF fonts", () => {
    expect(safe("₹ 100 — “ok” नमस्ते")).toBe('Rs. 100 - "ok" ');
  });
});

describe("reports", () => {
  it("builds a document report with fields and line items", async () => {
    const bytes = await documentReport(invoice);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe("Invoice Report");
    const text = await pdfText(bytes);
    for (const s of ["INV-2024-0457", "Sharma Electronics", "LED Monitor", "Rs.20,060", "OCR TEXT"]) expect(text).toContain(s);
  });

  it("never prints the full Aadhaar number", async () => {
    const text = await pdfText(await documentReport(aadhaar));
    expect(text).toContain("XXXX XXXX 9012");
    expect(text).not.toContain("4821");
  });

  it("builds a multi-page summary with totals", async () => {
    const docs = Array.from({ length: 60 }, (_, i) => (i % 2 ? invoice : row({ docType: "receipt", fields: { merchantName: "Mart", total: 100 } })));
    const bytes = await summaryReport(docs, { filterLabel: "March 2024" });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    const text = await pdfText(bytes);
    expect(text).toContain("March 2024");
    expect(text).toContain("Rs.6,01,800"); // 30 invoices x 20,060
    expect(text).toContain("Rs.3,000"); // 30 receipts x 100
    expect(text).toMatch(/Page 2 of \d/);
  });
});
