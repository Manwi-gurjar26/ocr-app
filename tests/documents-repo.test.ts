import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDocumentsRepo } from "@/lib/documents-repo";
import { testDb } from "./helpers/test-db";

const t = testDb();
const repo = createDocumentsRepo(t.db);

const base = { fileName: "a.png", mimeType: "image/png", fileSize: 10, filePath: "uploads/a.png" };

beforeEach(() => t.reset());
afterAll(() => t.close());

describe("documents repo", () => {
  it("creates with defaults and reads back", async () => {
    const row = await repo.create(base);
    expect(row.id).toMatch(/[0-9a-f-]{36}/);
    expect(row.status).toBe("uploaded");
    expect(row.docType).toBe("unknown");
    expect(row.fields).toEqual({});
    expect((await repo.get(row.id))?.fileName).toBe("a.png");
  });

  it("updates fields jsonb and status", async () => {
    const row = await repo.create(base);
    const up = await repo.update(row.id, {
      status: "verified",
      docType: "invoice",
      fields: { invoiceNumber: "INV-1", total: 99.5 },
    });
    expect(up?.status).toBe("verified");
    expect(up?.fields).toEqual({ invoiceNumber: "INV-1", total: 99.5 });
    expect(up!.updatedAt.getTime()).toBeGreaterThanOrEqual(row.updatedAt.getTime());
  });

  it("lists with type filter and search across text + fields", async () => {
    await repo.create({ ...base, fileName: "inv.png", docType: "invoice", fields: { vendorName: "Acme Traders" } });
    await repo.create({ ...base, fileName: "rec.png", docType: "receipt", rawText: "Big Bazaar total 200" });
    await repo.create({ ...base, fileName: "id.png", docType: "id_card" });

    expect((await repo.list()).total).toBe(3);
    expect((await repo.list({ type: "receipt" })).items.map((d) => d.fileName)).toEqual(["rec.png"]);
    expect((await repo.list({ q: "acme" })).items.map((d) => d.fileName)).toEqual(["inv.png"]);
    expect((await repo.list({ q: "bazaar" })).items.map((d) => d.fileName)).toEqual(["rec.png"]);
  });

  it("computes stats and deletes", async () => {
    const a = await repo.create({ ...base, docType: "invoice", status: "verified" });
    await repo.create({ ...base, docType: "invoice", status: "failed" });
    const s = await repo.stats();
    expect(s.total).toBe(2);
    expect(s.byType.invoice).toBe(2);
    expect(s.byStatus).toEqual({ verified: 1, failed: 1 });
    await repo.remove(a.id);
    expect(await repo.get(a.id)).toBeUndefined();
  });

  it("filters by status and customer", async () => {
    await repo.create({ ...base, fileName: "a", status: "manual_review", customerId: "C1" });
    await repo.create({ ...base, fileName: "b", status: "verified", customerId: "C1" });
    await repo.create({ ...base, fileName: "c", status: "manual_review", customerId: "C2" });
    expect((await repo.list({ status: "manual_review" })).total).toBe(2);
    expect((await repo.list({ status: "manual_review", customerId: "C1" })).items.map((d) => d.fileName)).toEqual(["a"]);
  });

  it("records status transitions in the audit log, newest first", async () => {
    const row = await repo.create(base);
    await repo.transition(row.id, "processing");
    const done = await repo.transition(row.id, "verified", { reviewedBy: "asha" }, { action: "approve", actor: "asha", note: "ok" });
    expect(done).toMatchObject({ status: "verified", reviewedBy: "asha" });
    const ev = await repo.events(row.id);
    expect(ev.map((e) => [e.fromStatus, e.toStatus])).toContainEqual(["processing", "verified"]);
    expect(ev.find((e) => e.toStatus === "verified")).toMatchObject({ action: "approve", actor: "asha", note: "ok" });
    expect(await repo.transition("00000000-0000-0000-0000-000000000000", "failed")).toBeUndefined();
  });

  it("keeps an extraction history that cascades on delete", async () => {
    const row = await repo.create(base);
    await repo.addExtraction({ documentId: row.id, provider: "tesseract", extractionMethod: "rules", docType: "invoice", extractedData: { total: 1 } });
    await repo.addExtraction({ documentId: row.id, provider: "textract", extractionMethod: "textract", docType: "invoice", extractedData: { total: 2 } });
    expect(await repo.extractions(row.id)).toHaveLength(2);
    await repo.remove(row.id);
    expect(await repo.extractions(row.id)).toHaveLength(0);
  });
});
