/**
 * OCR benchmark: renders every document type in several layouts, degrades them the way real uploads
 * arrive (phone photos, JPEG, blur, noise, skew, sideways scans, low-res, scanned PDFs), runs the real
 * OCR → classify → extract → validate path, and scores every extracted field against ground truth.
 *
 *   npx tsx scripts/ocr-bench.mts [--only=bill-a,gst-b] [--cond=clean,jpeg] [--out=bench.json]
 */
import fs from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { classify } from "../src/lib/extract/classify.ts";
import { extractWithRules } from "../src/lib/extract/rules/index.ts";
import { ocrFile, terminateOcr } from "../src/lib/ocr/index.ts";
import type { DocType } from "../src/lib/types.ts";
import { validateDocument } from "../src/lib/validation/index.ts";

/* ---------------------------------------------------------------- corpus */

interface Doc {
  id: string;
  type: DocType;
  lines: string[];
  expect: Record<string, string | number>;
}

const DOCS: Doc[] = [
  {
    id: "bill-a",
    type: "electricity_bill",
    lines: [
      "MSEDCL",
      "Maharashtra State Electricity Distribution Co. Ltd.",
      "ELECTRICITY BILL",
      "Consumer Name: ABC Industries",
      "Consumer No: 123456789",
      "Address: Plot 14, MIDC Bhosari, Pune 411026",
      "Bill Date: 05-11-2026",
      "Billing Period: October 2026",
      "Sanctioned Load: 150 KW",
      "Previous Reading 84,200  Present Reading 96,700",
      "Units Consumed: 12,500",
      "Amount Payable: Rs. 1,25,000.00",
      "Due Date: 25-11-2026",
    ],
    expect: {
      consumerName: "ABC Industries", consumerNumber: "123456789", billDate: "2026-11-05", billingPeriod: "October 2026",
      unitsConsumed: 12500, amountPayable: 125000, dueDate: "2026-11-25", sanctionedLoad: "150 kW",
    },
  },
  {
    id: "bill-b",
    type: "electricity_bill",
    lines: [
      "BESCOM",
      "Bangalore Electricity Supply Company Limited",
      "Bill of Supply - HT Industrial",
      "Name of Consumer : Sunrise Textiles Pvt Ltd",
      "Account No. : 7712045588",
      "Bill Issue Date : 08.11.2026",
      "Billing Period : 01/10/2026 to 31/10/2026",
      "Contract Demand : 45 kVA",
      "Total Units 4,820 kWh",
      "Net Amount Payable ₹ 38,420.50",
      "Last Date of Payment : 30.11.2026",
    ],
    expect: {
      consumerName: "Sunrise Textiles Pvt Ltd", consumerNumber: "7712045588", billDate: "2026-11-08",
      billingPeriod: "2026-10-01 to 2026-10-31", unitsConsumed: 4820, amountPayable: 38420.5, dueDate: "2026-11-30",
    },
  },
  {
    id: "gst-a",
    type: "gst_certificate",
    lines: [
      "Government of India",
      "Form GST REG-06",
      "Registration Certificate",
      "Registration Number: 27AABCA1234F1Z9",
      "1. Legal Name: ABC Industries Private Limited",
      "2. Trade Name, if any: ABC Solar Works",
      "3. Constitution of Business: Private Limited Company",
      "4. Address of Principal Place of Business: Plot 14, MIDC Bhosari, Pune, Maharashtra 411026",
      "5. Date of Liability: 01/07/2017",
      "6. Type of Registration: Regular",
      "Date of issue of Certificate: 15/07/2017",
    ],
    expect: {
      gstin: "27AABCA1234F1Z9", legalName: "ABC Industries Private Limited", tradeName: "ABC Solar Works",
      constitution: "Private Limited Company", registrationType: "Regular", dateOfLiability: "2017-07-01", dateOfIssue: "2017-07-15",
    },
  },
  {
    id: "gst-b",
    type: "gst_certificate",
    lines: [
      "Government of India",
      "Form GST REG-06",
      "[See Rule 10(1)]",
      "Registration Certificate",
      "Registration Number",
      "27AAPFU0939F1ZV",
      "Legal Name",
      "Kumar Exports",
      "Trade Name, if any",
      "Kumar Solar Exports",
      "Constitution of Business",
      "Partnership",
      "Date of Liability",
      "12/03/2019",
      "Type of Registration",
      "Regular",
    ],
    expect: {
      gstin: "27AAPFU0939F1ZV", legalName: "Kumar Exports", tradeName: "Kumar Solar Exports", constitution: "Partnership",
      dateOfLiability: "2019-03-12", registrationType: "Regular",
    },
  },
  {
    id: "bank-a",
    type: "bank_statement",
    lines: [
      "HDFC Bank",
      "Statement of Account",
      "Account Holder: ABC Industries",
      "Account No: 50200012345678",
      "IFSC: HDFC0001234",
      "Statement Period: 01/10/2026 to 31/10/2026",
      "Opening Balance: 2,00,000.00",
      "02/10/2026 NEFT CR SUNRISE TEXTILES 50,000.00 2,50,000.00",
      "10/10/2026 MSEDCL BILL PAYMENT DR 1,25,000.00 1,25,000.00",
      "20/10/2026 RTGS CR KUMAR EXPORTS 75,000.00 2,00,000.00",
      "Closing Balance: 2,00,000.00",
    ],
    expect: {
      accountHolder: "ABC Industries", accountNumber: "50200012345678", ifsc: "HDFC0001234", periodFrom: "2026-10-01",
      periodTo: "2026-10-31", openingBalance: 200000, closingBalance: 200000, totalCredits: 125000, totalDebits: 125000,
    },
  },
  {
    id: "bank-b",
    type: "bank_statement",
    lines: [
      "State Bank of India",
      "Account Statement",
      "Customer Name : Ravi Kumar",
      "A/c No : 30012345678",
      "IFSC Code : SBIN0004567",
      "For the period 01-10-2026 to 31-10-2026",
      "Balance B/F 1,52,000.00",
      "Date Description Debit Credit Balance",
      "03-10-2026 UPI/PAYTM/GROCERY 2,450.00 1,49,550.00",
      "07-10-2026 SALARY OCT 2026 85,000.00 2,34,550.00",
      "15-10-2026 ATM WDL 10,000.00 2,24,550.00",
      "Closing Balance 2,24,550.00",
    ],
    expect: {
      accountHolder: "Ravi Kumar", accountNumber: "30012345678", ifsc: "SBIN0004567", periodFrom: "2026-10-01", periodTo: "2026-10-31",
      openingBalance: 152000, closingBalance: 224550, totalCredits: 85000, totalDebits: 12450,
    },
  },
  {
    id: "aadhaar",
    type: "id_card",
    lines: ["GOVERNMENT OF INDIA", "Priya Sharma", "DOB: 12/08/1995", "FEMALE", "4821 7365 9012", "Aadhaar - Aam Aadmi ka Adhikar"],
    expect: { idType: "aadhaar", idNumber: "4821 7365 9012", fullName: "Priya Sharma", dateOfBirth: "1995-08-12", gender: "Female" },
  },
  {
    id: "pan",
    type: "id_card",
    lines: ["INCOME TAX DEPARTMENT GOVT. OF INDIA", "Permanent Account Number Card", "AABPK1234C", "RAMESH KUMAR", "SURESH KUMAR", "Date of Birth", "05/11/1988"],
    expect: { idType: "pan", idNumber: "AABPK1234C", fullName: "RAMESH KUMAR", fatherName: "SURESH KUMAR", dateOfBirth: "1988-11-05" },
  },
  {
    id: "invoice",
    type: "invoice",
    lines: [
      "Sharma Electronics Pvt Ltd",
      "TAX INVOICE",
      "GSTIN: 27AABCS1234F1Z5",
      "Invoice No: INV-2024-0457",
      "Invoice Date: 15/03/2024",
      "Bill To: Acme Traders",
      "LED Monitor 24in 2 x 8,500.00 17,000.00",
      "Subtotal 17,000.00",
      "CGST 9% 1,530.00",
      "SGST 9% 1,530.00",
      "Grand Total 20,060.00",
    ],
    expect: { invoiceNumber: "INV-2024-0457", invoiceDate: "2024-03-15", vendorGstin: "27AABCS1234F1Z5", subtotal: 17000, tax: 3060, total: 20060 },
  },
  {
    id: "receipt",
    type: "receipt",
    lines: [
      "BIG BAZAAR",
      "Phoenix Mall, Pune",
      "Date: 02-04-2024  Time: 18:42",
      "Cashier: 07",
      "Amul Milk 1L        66.00",
      "Britannia Bread     45.00",
      "Sub Total          139.00",
      "GST                  7.00",
      "TOTAL              146.00",
      "Paid by UPI",
      "Thank you, visit again!",
    ],
    expect: { merchantName: "BIG BAZAAR", date: "2024-04-02", total: 146, tax: 7, paymentMethod: "UPI" },
  },
];

/* ---------------------------------------------------------------- rendering + degradations */

function render(lines: string[], font = "Arial", size = 32): Buffer {
  const lineH = Math.round(size * 1.55);
  const width = 1500;
  const c = createCanvas(width, lineH * lines.length + 140);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#151515";
  ctx.font = `${size}px "${font}"`;
  lines.forEach((l, i) => ctx.fillText(l, 70, 90 + i * lineH));
  return c.toBuffer("image/png");
}

const shadowSvg = (w: number, h: number) =>
  Buffer.from(
    `<svg width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#b8b2a6"/><stop offset="1" stop-color="#7d776c"/>
    </linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );

async function addNoise(png: Buffer, amount: number): Promise<Buffer> {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let seed = 42;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < data.length; i++) data[i] = Math.max(0, Math.min(255, data[i] + (rand() - 0.5) * amount));
  return sharp(data, { raw: info }).png().toBuffer();
}

async function shadow(png: Buffer): Promise<Buffer> {
  const m = await sharp(png).metadata();
  return sharp(png).composite([{ input: shadowSvg(m.width!, m.height!), blend: "multiply" }]).png().toBuffer();
}

async function imagePdf(png: Buffer): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(png);
  const page = doc.addPage([img.width / 2, img.height / 2]);
  page.drawImage(img, { x: 0, y: 0, width: img.width / 2, height: img.height / 2 });
  return Buffer.from(await doc.save());
}

async function textPdf(lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  lines.forEach((l, i) => page.drawText(l.replace(/₹/g, "Rs."), { x: 40, y: 790 - i * 22, size: 11, font }));
  return Buffer.from(await doc.save());
}

type Input = { bytes: Buffer; mime: string };
const png = (b: Buffer): Input => ({ bytes: b, mime: "image/png" });

const CONDITIONS: Record<string, { label: string; make: (d: Doc) => Promise<Input> }> = {
  "text-pdf": { label: "Digital PDF (text layer)", make: async (d) => ({ bytes: await textPdf(d.lines), mime: "application/pdf" }) },
  clean: { label: "Clean scan PNG (Arial)", make: async (d) => png(render(d.lines)) },
  times: { label: "Serif font (Times)", make: async (d) => png(render(d.lines, "Times New Roman")) },
  courier: { label: "Monospace font (Courier)", make: async (d) => png(render(d.lines, "Courier New")) },
  small: { label: "Small text (16px)", make: async (d) => png(render(d.lines, "Arial", 16)) },
  lowres: { label: "Low resolution (600px wide)", make: async (d) => png(await sharp(render(d.lines)).resize({ width: 600 }).png().toBuffer()) },
  jpeg: { label: "Heavy JPEG (q=30)", make: async (d) => ({ bytes: await sharp(render(d.lines)).jpeg({ quality: 30 }).toBuffer(), mime: "image/jpeg" }) },
  blur: { label: "Blurred (σ=1.6)", make: async (d) => png(await sharp(render(d.lines)).blur(1.6).png().toBuffer()) },
  noise: { label: "Grainy / noisy", make: async (d) => png(await addNoise(render(d.lines), 140)) },
  skew: { label: "Skewed 4°", make: async (d) => png(await sharp(render(d.lines)).rotate(4, { background: "#ffffff" }).png().toBuffer()) },
  shadow: { label: "Shadow + low contrast", make: async (d) => png(await shadow(await sharp(render(d.lines)).linear(0.55, 90).png().toBuffer())) },
  rot90: { label: "Sideways (90°, no EXIF)", make: async (d) => png(await sharp(render(d.lines)).rotate(90).png().toBuffer()) },
  rot180: { label: "Upside down (180°)", make: async (d) => png(await sharp(render(d.lines)).rotate(180).png().toBuffer()) },
  photo: {
    label: "Phone photo (skew+shadow+blur+JPEG)",
    make: async (d) => {
      const s = await shadow(await sharp(render(d.lines)).rotate(2, { background: "#f4f1ea" }).png().toBuffer());
      return { bytes: await sharp(s).blur(0.9).jpeg({ quality: 55 }).toBuffer(), mime: "image/jpeg" };
    },
  },
  "scan-pdf": { label: "Scanned PDF (image only)", make: async (d) => ({ bytes: await imagePdf(render(d.lines)), mime: "application/pdf" }) },
};

/* ---------------------------------------------------------------- scoring */

const norm = (v: unknown) => String(v ?? "").toUpperCase().replace(/[\s.,]+/g, " ").trim();
function same(want: string | number, got: unknown): boolean {
  if (typeof want === "number") return typeof got === "number" && Math.abs(got - want) < 0.01;
  return norm(want) === norm(got);
}

interface Row {
  doc: string;
  cond: string;
  classified: DocType;
  classOk: boolean;
  fieldsOk: number;
  fieldsTotal: number;
  misses: string[];
  confidence: number;
  outcome: string;
  failedChecks: string[];
  ms: number;
  error?: string;
}

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const onlyDocs = args.only?.split(",");
const onlyConds = args.cond?.split(",");
const NOW = new Date("2026-11-23T10:00:00Z");

const rows: Row[] = [];
for (const [condId, cond] of Object.entries(CONDITIONS)) {
  if (onlyConds && !onlyConds.includes(condId)) continue;
  for (const d of DOCS) {
    if (onlyDocs && !onlyDocs.includes(d.id)) continue;
    const t0 = Date.now();
    try {
      const input = await cond.make(d);
      const r = await ocrFile(input.bytes, input.mime);
      if (args.dump) console.log(`----- ${condId}/${d.id}
${r.text}
-----`);
      const detected = classify(r.text).type;
      const type = detected !== "unknown" ? detected : d.type; // pipeline uses the uploader's choice when detection fails
      const fields = extractWithRules(type, r.text) as Record<string, unknown>;
      const v = validateDocument({ docType: type, detectedType: detected, declaredType: d.type, fields, confidence: r.confidence }, { now: NOW });
      const misses = Object.entries(d.expect)
        .filter(([k, want]) => !same(want, fields[k]))
        .map(([k, want]) => `${k}: want ${JSON.stringify(want)} got ${JSON.stringify(fields[k] ?? null)}`);
      rows.push({
        doc: d.id, cond: condId, classified: detected, classOk: detected === d.type,
        fieldsOk: Object.keys(d.expect).length - misses.length, fieldsTotal: Object.keys(d.expect).length, misses,
        confidence: r.confidence, outcome: v.outcome, failedChecks: v.checks.filter((c) => c.status === "fail").map((c) => c.id), ms: Date.now() - t0,
      });
    } catch (e) {
      rows.push({ doc: d.id, cond: condId, classified: "unknown", classOk: false, fieldsOk: 0, fieldsTotal: Object.keys(d.expect).length, misses: [], confidence: 0, outcome: "error", failedChecks: [], ms: Date.now() - t0, error: (e as Error).message });
    }
    const last = rows.at(-1)!;
    process.stdout.write(`${condId.padEnd(9)} ${d.id.padEnd(8)} ${last.classOk ? "type✓" : `type✗(${last.classified})`} fields ${last.fieldsOk}/${last.fieldsTotal} conf ${last.confidence} ${last.outcome} ${last.ms}ms${last.error ? " ERR " + last.error : ""}\n`);
  }
}
await terminateOcr();

/* ---------------------------------------------------------------- report */

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
console.log("\n=== Field accuracy by condition ===");
for (const c of Object.keys(CONDITIONS)) {
  const rs = rows.filter((r) => r.cond === c);
  if (!rs.length) continue;
  const ok = rs.reduce((a, r) => a + r.fieldsOk, 0);
  const tot = rs.reduce((a, r) => a + r.fieldsTotal, 0);
  console.log(`${CONDITIONS[c].label.padEnd(38)} fields ${pct(ok, tot).padStart(4)}  type ${pct(rs.filter((r) => r.classOk).length, rs.length).padStart(4)}  conf ${Math.round(rs.reduce((a, r) => a + r.confidence, 0) / rs.length)}`);
}
console.log("\n=== Field accuracy by document ===");
for (const d of DOCS) {
  const rs = rows.filter((r) => r.doc === d.id);
  if (!rs.length) continue;
  const ok = rs.reduce((a, r) => a + r.fieldsOk, 0);
  const tot = rs.reduce((a, r) => a + r.fieldsTotal, 0);
  console.log(`${d.id.padEnd(8)} fields ${pct(ok, tot).padStart(4)}  type ${pct(rs.filter((r) => r.classOk).length, rs.length).padStart(4)}`);
}
const all = rows.reduce((a, r) => a + r.fieldsOk, 0);
const allT = rows.reduce((a, r) => a + r.fieldsTotal, 0);
console.log(`\nOVERALL fields ${pct(all, allT)} (${all}/${allT}), classification ${pct(rows.filter((r) => r.classOk).length, rows.length)}, runs ${rows.length}`);

console.log("\n=== Misses (most common first) ===");
const missCount = new Map<string, number>();
for (const r of rows) for (const m of r.misses) {
  const key = `${r.doc} ${m.split(":")[0]}`;
  missCount.set(key, (missCount.get(key) ?? 0) + 1);
}
for (const [k, n] of [...missCount].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`${String(n).padStart(3)}× ${k}`);

if (args.out) fs.writeFileSync(args.out, JSON.stringify(rows, null, 2));
