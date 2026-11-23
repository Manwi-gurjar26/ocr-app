import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDocumentsRepo } from "@/lib/documents-repo";
import { toResult } from "@/lib/extract/ai";
import { terminateOcr } from "@/lib/ocr";
import { ingestUpload, processDocument, reviewDocument, ReviewError, revalidate, UploadError } from "@/lib/pipeline";
import { SAMPLE_INVOICE, textImage, textPdf } from "./helpers/fixtures";
import { ELECTRICITY_BILL, GST_CERTIFICATE } from "./helpers/kwx-fixtures";
import { testDb } from "./helpers/test-db";

const t = testDb();
const repo = createDocumentsRepo(t.db);
const quiet = () => {};
const now = () => new Date("2026-11-23T10:00:00Z");

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
    expect(doc.status).toBe("uploaded");
    const done = await processDocument({ repo, ai: null, log: quiet }, doc.id);
    expect(done).toMatchObject({ status: "verified", docType: "invoice", extractionMethod: "rules", ocrProvider: "tesseract" });
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
    expect(done).toMatchObject({ status: "verified", docType: "invoice", extractionMethod: "rules" });
  });

  it("marks the document failed when OCR crashes", async () => {
    const doc = await ingestUpload({ repo }, { name: "x.png", mime: "image/png", bytes: textImage(["x"]) });
    const done = await processDocument({ repo, ai: null, log: quiet, ocr: () => Promise.reject(new Error("boom")) }, doc.id);
    expect(done).toMatchObject({ status: "failed", error: "boom" });
  });

  it("rejects a file whose contents don't match its declared type", async () => {
    await expect(
      ingestUpload({ repo }, { name: "fake.pdf", mime: "application/pdf", bytes: textImage(["x"]) }),
    ).rejects.toThrow(/do not match/);
  });

  it("verifies an electricity bill end-to-end and keeps an audit trail + extraction history", async () => {
    const doc = await ingestUpload(
      { repo },
      {
        name: "bill.pdf",
        mime: "application/pdf",
        bytes: await textPdf(ELECTRICITY_BILL),
        customerId: "CUST-1",
        declaredType: "electricity_bill",
        declared: { consumerNumber: "123456789", consumerName: "ABC Industries" },
      },
    );
    const done = await processDocument({ repo, ai: null, log: quiet, now }, doc.id);
    expect(done).toMatchObject({ status: "verified", docType: "electricity_bill", customerId: "CUST-1" });
    expect(done!.fields).toMatchObject({ consumerNumber: "123456789", unitsConsumed: 12500, amountPayable: 125000 });
    expect(done!.validation?.outcome).toBe("verified");

    const statuses = (await repo.events(doc.id)).map((e) => e.toStatus).reverse();
    expect(statuses).toEqual(["uploaded", "processing", "extracted", "validation_pending", "verified"]);
    const ex = await repo.extractions(doc.id);
    expect(ex).toHaveLength(1);
    expect(ex[0]).toMatchObject({ provider: "tesseract", docType: "electricity_bill", confidenceScore: 100 });
    expect(ex[0].validationResult?.outcome).toBe("verified");
  });

  it("sends a mismatching document to manual review, and a reviewer resolves it", async () => {
    const doc = await ingestUpload(
      { repo },
      { name: "gst.pdf", mime: "application/pdf", bytes: await textPdf(GST_CERTIFICATE), declaredType: "electricity_bill" },
    );
    const done = await processDocument({ repo, ai: null, log: quiet, now }, doc.id);
    expect(done).toMatchObject({ status: "manual_review", docType: "gst_certificate" });
    expect(done!.validation!.reasons.join()).toMatch(/looks like gst certificate/);

    await expect(reviewDocument({ repo }, doc.id, { action: "reject", reviewer: "asha" })).rejects.toBeInstanceOf(ReviewError);
    const rejected = await reviewDocument({ repo }, doc.id, { action: "request_reupload", reviewer: "asha", note: "Please upload the electricity bill" });
    expect(rejected).toMatchObject({ status: "failed", reviewedBy: "asha", error: "Re-upload requested: Please upload the electricity bill" });
    const approved = await reviewDocument({ repo }, doc.id, { action: "approve", reviewer: "ravi" });
    expect(approved).toMatchObject({ status: "verified", reviewedBy: "ravi", error: null });
    expect((await repo.events(doc.id))[0]).toMatchObject({ action: "approve", actor: "ravi", fromStatus: "failed", toStatus: "verified" });
  });

  it("re-validates after a reviewer corrects a field", async () => {
    const doc = await ingestUpload({ repo }, { name: "bill.pdf", mime: "application/pdf", bytes: await textPdf(ELECTRICITY_BILL) });
    await processDocument({ repo, ai: null, log: quiet, now }, doc.id);
    await repo.update(doc.id, { fields: { ...(await repo.get(doc.id))!.fields, billDate: "2026-08-01" } });
    expect(await revalidate({ repo, now }, doc.id)).toMatchObject({ status: "manual_review" });
  });

  it("won't review a document that is still processing", async () => {
    const doc = await ingestUpload({ repo }, { name: "x.png", mime: "image/png", bytes: textImage(["x"]) });
    await expect(reviewDocument({ repo }, doc.id, { action: "approve", reviewer: "a" })).rejects.toThrow(/still uploaded/);
  });
});
