import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDocumentsRepo } from "@/lib/documents-repo";
import { toResult } from "@/lib/extract/ai";
import { terminateOcr } from "@/lib/ocr";
import { ingestUpload, processDocument, UploadError } from "@/lib/pipeline";
import { SAMPLE_INVOICE, textImage, textPdf } from "./helpers/fixtures";
import { testDb } from "./helpers/test-db";

const t = testDb();
const repo = createDocumentsRepo(t.db);
const quiet = () => {};

beforeAll(async () => {
  process.env.UPLOAD_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-uploads-"));
});
beforeEach(() => t.reset());
afterAll(async () => {
  await terminateOcr();
  await t.close();
  await fs.rm(process.env.UPLOAD_DIR!, { recursive: true, force: true });
});

describe("pipeline", () => {
  it("rejects unsupported and oversized uploads", async () => {
    await expect(ingestUpload({ repo }, { name: "a.txt", mime: "text/plain", bytes: Buffer.from("x") })).rejects.toBeInstanceOf(UploadError);
    await expect(
      ingestUpload({ repo }, { name: "big.png", mime: "image/png", bytes: Buffer.alloc(11 * 1024 * 1024) }),
    ).rejects.toThrow(/10 MB/);
  });

  it("OCRs an image and extracts invoice fields with rules", async () => {
    const doc = await ingestUpload({ repo }, { name: "inv.png", mime: "image/png", bytes: textImage(SAMPLE_INVOICE) });
    expect(doc.status).toBe("processing");
    const done = await processDocument({ repo, ai: null, log: quiet }, doc.id);
    expect(done).toMatchObject({ status: "done", docType: "invoice", extractionMethod: "rules" });
    expect(done!.fields).toMatchObject({ invoiceNumber: "INV-2024-0457", total: 20060, vendorGstin: "27AABCS1234F1Z5" });
    expect(done!.ocrConfidence).toBeGreaterThan(70);
  }, 180_000);

  it("uses AI result when available", async () => {
    const doc = await ingestUpload({ repo }, { name: "inv.pdf", mime: "application/pdf", bytes: await textPdf(SAMPLE_INVOICE) });
    const ai = vi.fn().mockResolvedValue(
      toResult({ docType: "receipt", invoice: null, idCard: null, receipt: { merchantName: "AI Mart", date: null, time: null, paymentMethod: null, subtotal: null, tax: null, total: 5, currency: "INR", items: [] } }),
    );
    const done = await processDocument({ repo, ai, log: quiet }, doc.id);
    expect(ai).toHaveBeenCalledOnce();
    expect(ai.mock.calls[0][0][0]).toBeInstanceOf(Buffer); // page image passed to vision
    expect(done).toMatchObject({ docType: "receipt", extractionMethod: "ai", fields: { merchantName: "AI Mart" } });
  });

  it("falls back to rules when AI throws", async () => {
    const doc = await ingestUpload({ repo }, { name: "inv.pdf", mime: "application/pdf", bytes: await textPdf(SAMPLE_INVOICE) });
    const done = await processDocument({ repo, ai: () => Promise.reject(new Error("rate limited")), log: quiet }, doc.id);
    expect(done).toMatchObject({ status: "done", docType: "invoice", extractionMethod: "rules" });
  });

  it("marks the document failed when OCR crashes", async () => {
    const doc = await ingestUpload({ repo }, { name: "x.png", mime: "image/png", bytes: textImage(["x"]) });
    const done = await processDocument({ repo, ai: null, log: quiet, ocr: () => Promise.reject(new Error("boom")) }, doc.id);
    expect(done).toMatchObject({ status: "failed", error: "boom" });
  });
});
