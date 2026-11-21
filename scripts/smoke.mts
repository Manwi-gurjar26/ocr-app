// End-to-end API smoke test against a running server: npx tsx scripts/smoke.mts [baseUrl]
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs/promises";
import assert from "node:assert/strict";

const BASE = process.argv[2] ?? "http://localhost:3000";
const files: [string, string][] = [
  ["samples/invoice.png", "image/png"],
  ["samples/receipt.png", "image/png"],
  ["samples/aadhaar.png", "image/png"],
  ["samples/pan.png", "image/png"],
  ["samples/scanned-invoice.pdf", "application/pdf"],
  ["package.json", "application/json"], // must be rejected
];

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/api/stats`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("server not reachable");
}

await waitForServer();
const form = new FormData();
for (const [p, type] of files) form.append("files", new Blob([await fs.readFile(p)], { type }), p.split("/").pop());
const up = await fetch(`${BASE}/api/documents`, { method: "POST", body: form });
assert.equal(up.status, 201);
const { items, errors } = (await up.json()) as { items: { id: string; fileName: string }[]; errors: string[] };
assert.equal(items.length, 5);
assert.match(errors[0], /only PNG, JPG, WEBP and PDF/);
console.log("uploaded", items.length, "rejected:", errors.length);

const ids = new Set(items.map((i) => i.id));
let docs: any[] = [];
for (let i = 0; i < 120; i++) {
  docs = ((await (await fetch(`${BASE}/api/documents?limit=500`)).json()) as any).items.filter((d: any) => ids.has(d.id));
  if (docs.every((d) => d.status !== "processing")) break;
  await new Promise((r) => setTimeout(r, 1000));
}
const by = (n: string) => docs.find((d) => d.fileName === n);
for (const d of docs) console.log(`${d.fileName.padEnd(22)} ${d.status.padEnd(6)} ${d.docType.padEnd(8)} ${d.extractionMethod} conf=${Math.round(d.ocrConfidence)}`);

assert.equal(by("invoice.png").docType, "invoice");
assert.equal(by("invoice.png").fields.invoiceNumber, "INV-2024-0457");
assert.equal(by("invoice.png").fields.total, 20060);
assert.equal(by("receipt.png").docType, "receipt");
assert.equal(by("receipt.png").fields.total, 146);
assert.equal(by("aadhaar.png").fields.idType, "aadhaar");
assert.equal(by("pan.png").fields.idNumber, "ABCDE1234F");
assert.equal(by("scanned-invoice.pdf").fields.total, 20060);

const id = by("invoice.png").id;
const patched = await (await fetch(`${BASE}/api/documents/${id}`, {
  method: "PATCH", headers: { "content-type": "application/json" },
  body: JSON.stringify({ fields: { ...by("invoice.png").fields, customerName: "Edited Name" } }),
})).json() as any;
assert.equal(patched.fields.customerName, "Edited Name");

const report = await fetch(`${BASE}/api/documents/${id}/report`);
assert.equal(report.headers.get("content-type"), "application/pdf");
assert.equal(Buffer.from(await report.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
const summary = await fetch(`${BASE}/api/reports/summary?type=invoice`);
assert.equal(Buffer.from(await summary.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
const file = await fetch(`${BASE}/api/documents/${id}/file`);
assert.equal(file.headers.get("content-type"), "image/png");

assert.equal((await fetch(`${BASE}/api/documents/not-a-uuid`)).status, 404);
assert.equal((await fetch(`${BASE}/api/documents?type=bogus`)).status, 400);
const searched = (await (await fetch(`${BASE}/api/documents?q=Edited`)).json()) as any;
assert.ok(searched.items.some((d: any) => d.id === id));

const stats = (await (await fetch(`${BASE}/api/stats`)).json()) as any;
console.log("stats", JSON.stringify(stats));

for (const d of docs) assert.equal((await fetch(`${BASE}/api/documents/${d.id}`, { method: "DELETE" })).status, 204);
assert.equal((await fetch(`${BASE}/api/documents/${id}`)).status, 404);
console.log("SMOKE OK");
