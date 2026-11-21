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
    expect(row.status).toBe("processing");
    expect(row.docType).toBe("unknown");
    expect(row.fields).toEqual({});
    expect((await repo.get(row.id))?.fileName).toBe("a.png");
  });

  it("updates fields jsonb and status", async () => {
    const row = await repo.create(base);
    const up = await repo.update(row.id, {
      status: "done",
      docType: "invoice",
      fields: { invoiceNumber: "INV-1", total: 99.5 },
    });
    expect(up?.status).toBe("done");
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
    const a = await repo.create({ ...base, docType: "invoice", status: "done" });
    await repo.create({ ...base, docType: "invoice", status: "failed" });
    const s = await repo.stats();
    expect(s.total).toBe(2);
    expect(s.byType.invoice).toBe(2);
    expect(s.byStatus).toEqual({ done: 1, failed: 1 });
    await repo.remove(a.id);
    expect(await repo.get(a.id)).toBeUndefined();
  });
});
