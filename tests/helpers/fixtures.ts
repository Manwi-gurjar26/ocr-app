import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument, StandardFonts } from "pdf-lib";

/** Render lines of text to a PNG, like a clean scan. */
export function textImage(lines: string[], opts: { width?: number; fontSize?: number } = {}): Buffer {
  const fontSize = opts.fontSize ?? 34;
  const lineH = Math.round(fontSize * 1.5);
  const width = opts.width ?? 1400;
  const height = lineH * lines.length + 120;
  const c = createCanvas(width, height);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#111";
  ctx.font = `${fontSize}px Arial`;
  lines.forEach((l, i) => ctx.fillText(l, 60, 80 + i * lineH));
  return c.toBuffer("image/png");
}

/** PDF with a real text layer. */
export async function textPdf(lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  lines.forEach((l, i) => page.drawText(l, { x: 50, y: 790 - i * 22, size: 13, font }));
  return Buffer.from(await doc.save());
}

/** PDF containing only an image (a "scanned" PDF, no text layer). */
export async function scannedPdf(lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const png = await doc.embedPng(textImage(lines));
  const page = doc.addPage([png.width / 2, png.height / 2]);
  page.drawImage(png, { x: 0, y: 0, width: png.width / 2, height: png.height / 2 });
  return Buffer.from(await doc.save());
}

export const SAMPLE_INVOICE = [
  "TAX INVOICE",
  "Sharma Electronics Pvt Ltd",
  "GSTIN: 27AABCS1234F1Z5",
  "Invoice No: INV-2024-0457",
  "Invoice Date: 15/03/2024",
  "Bill To: Rahul Verma",
  "LED Monitor 2 x 8,500.00 17,000.00",
  "Subtotal: 17,000.00",
  "CGST 9%: 1,530.00",
  "SGST 9%: 1,530.00",
  "Grand Total: Rs 20,060.00",
];
