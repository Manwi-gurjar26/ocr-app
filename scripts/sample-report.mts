// Dev helper: writes sample reports + PNG previews to the given folder.
import fs from "node:fs/promises";
import path from "node:path";
import { renderPageAsImage } from "unpdf";
import { documentReport, summaryReport } from "../src/lib/reports/index.ts";

const out = process.argv[2] ?? ".";
const base = {
  id: "1", mimeType: "image/png", fileSize: 1, filePath: "x", status: "verified" as const, customerId: null, declaredType: null, declared: {}, ocrProvider: "tesseract" as const, validation: null, reviewedBy: null, reviewedAt: null, reviewNote: null, ocrConfidence: 94,
  extractionMethod: "rules" as const, error: null, createdAt: new Date(), updatedAt: new Date(),
};
const inv = {
  ...base, fileName: "sharma-invoice.png", docType: "invoice" as const,
  rawText: "TAX INVOICE\nSharma Electronics Pvt Ltd\nGSTIN: 27AABCS1234F1Z5\nInvoice No: INV-2024-0457",
  fields: {
    invoiceNumber: "INV-2024-0457", invoiceDate: "2024-03-15", vendorName: "Sharma Electronics Pvt Ltd",
    vendorGstin: "27AABCS1234F1Z5", customerName: "Rahul Verma", subtotal: 17000, tax: 3060, total: 20060, currency: "INR",
    lineItems: [
      { description: "LED Monitor 24 inch", quantity: 2, unitPrice: 8500, amount: 17000 },
    ],
  },
};
const one = await documentReport(inv);
const sum = await summaryReport([inv, { ...inv, docType: "receipt" as const, fileName: "bazaar.jpg", fields: { merchantName: "Big Bazaar", total: 146 } }]);
await fs.writeFile(path.join(out, "document-report.pdf"), one);
await fs.writeFile(path.join(out, "summary-report.pdf"), sum);
for (const [name, bytes] of [["document", one], ["summary", sum]] as const) {
  const png = await renderPageAsImage(new Uint8Array(bytes), 1, { canvasImport: () => import("@napi-rs/canvas"), scale: 1.2 });
  await fs.writeFile(path.join(out, `${name}-report.png`), Buffer.from(png as Uint8Array));
}
console.log("written to", out);
