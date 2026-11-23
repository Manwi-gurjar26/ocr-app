import type { Block } from "@aws-sdk/client-textract";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runChecker, selectChecker, type CheckerRegistry, type DocumentChecker } from "@/lib/providers";
import { createPerfiosChecker } from "@/lib/providers/perfios";
import { blocksToText, createTextractChecker } from "@/lib/providers/textract";

function fake(name: DocumentChecker["name"], available: boolean, impl?: DocumentChecker["analyze"]): DocumentChecker {
  return {
    name,
    available: () => available,
    analyze: impl ?? (async () => ({ provider: name, text: `${name} text`, confidence: 90, pages: 1, images: [] })),
  };
}

const input = { bytes: Buffer.from("x"), mime: "image/png" };

describe("provider routing (blueprint §11)", () => {
  const reg = (textract: boolean, perfios: boolean): CheckerRegistry => ({
    tesseract: fake("tesseract", true),
    textract: fake("textract", textract),
    perfios: fake("perfios", perfios),
  });

  it("sends bills/GST to Textract and KYC/bank to Perfios when configured", () => {
    const r = reg(true, true);
    expect(selectChecker("electricity_bill", r).name).toBe("textract");
    expect(selectChecker("gst_certificate", r).name).toBe("textract");
    expect(selectChecker("id_card", r).name).toBe("perfios");
    expect(selectChecker("bank_statement", r).name).toBe("perfios");
    expect(selectChecker("invoice", r).name).toBe("tesseract");
    expect(selectChecker(null, r).name).toBe("tesseract");
  });

  it("uses local OCR when a provider isn't configured", () => {
    expect(selectChecker("electricity_bill", reg(false, false)).name).toBe("tesseract");
  });

  it("falls back to local OCR when the external provider errors", async () => {
    const log = vi.fn();
    const r: CheckerRegistry = {
      tesseract: fake("tesseract", true),
      textract: fake("textract", true, () => Promise.reject(new Error("ThrottlingException"))),
      perfios: fake("perfios", false),
    };
    const out = await runChecker({ ...input, docType: "electricity_bill" }, r, log);
    expect(out.provider).toBe("tesseract");
    expect(log).toHaveBeenCalledOnce();
  });
});

describe("Textract adapter", () => {
  const blocks: Block[] = [
    { BlockType: "LINE", Id: "l1", Text: "MSEDCL ELECTRICITY BILL", Confidence: 99 },
    { BlockType: "LINE", Id: "l2", Text: "Consumer No 123456789", Confidence: 95 },
    { BlockType: "WORD", Id: "w1", Text: "Consumer" },
    { BlockType: "WORD", Id: "w2", Text: "No" },
    { BlockType: "WORD", Id: "w3", Text: "123456789" },
    { BlockType: "KEY_VALUE_SET", Id: "k1", EntityTypes: ["KEY"], Relationships: [{ Type: "CHILD", Ids: ["w1", "w2"] }, { Type: "VALUE", Ids: ["v1"] }] },
    { BlockType: "KEY_VALUE_SET", Id: "v1", EntityTypes: ["VALUE"], Relationships: [{ Type: "CHILD", Ids: ["w3"] }] },
  ];

  it("builds reading-order text plus key/value lines", () => {
    const r = blocksToText(blocks);
    expect(r.keyValues).toEqual({ "Consumer No": "123456789" });
    expect(r.text).toBe("MSEDCL ELECTRICITY BILL\nConsumer No 123456789\n\nConsumer No: 123456789");
    expect(r.confidence).toBe(97);
  });

  it("calls AnalyzeDocument through the injected sender", async () => {
    const send = vi.fn().mockResolvedValue({ Blocks: blocks, DocumentMetadata: { Pages: 1 } });
    const out = await createTextractChecker(send).analyze(input);
    expect(send).toHaveBeenCalledWith(new Uint8Array(input.bytes));
    expect(out).toMatchObject({ provider: "textract", confidence: 97, pages: 1 });
  });

  afterEach(() => vi.unstubAllEnvs());
  it("is available only when enabled with a region", () => {
    const c = createTextractChecker(vi.fn());
    vi.stubEnv("TEXTRACT_ENABLED", "");
    expect(c.available()).toBe(false);
    vi.stubEnv("TEXTRACT_ENABLED", "true");
    vi.stubEnv("AWS_REGION", "ap-south-1");
    expect(c.available()).toBe(true);
  });
});

describe("Perfios adapter", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("posts the file with the mapped document type and normalises the response", async () => {
    vi.stubEnv("PERFIOS_OCR_URL", "https://perfios.example/ocr");
    vi.stubEnv("PERFIOS_API_KEY", "k");
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({ text: "PAN", confidence: 88, fields: { idType: "pan", idNumber: "AABPA1234C" }, tamper: [{ code: "edit", message: "Edited region", severity: "medium" }] }),
    );
    const c = createPerfiosChecker(fetchImpl as unknown as typeof fetch);
    expect(c.available()).toBe(true);
    const out = await c.analyze({ ...input, docType: "id_card" });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://perfios.example/ocr");
    expect((init.body as FormData).get("documentType")).toBe("KYC");
    expect(init.headers).toEqual({ Authorization: "Bearer k" });
    expect(out).toMatchObject({ provider: "perfios", confidence: 88, fields: { idNumber: "AABPA1234C" }, tamper: [{ code: "edit" }] });
  });

  it("throws on HTTP errors so the router can fall back", async () => {
    vi.stubEnv("PERFIOS_OCR_URL", "https://perfios.example/ocr");
    vi.stubEnv("PERFIOS_API_KEY", "k");
    const c = createPerfiosChecker((async () => new Response("no", { status: 503 })) as typeof fetch);
    await expect(c.analyze(input)).rejects.toThrow(/503/);
  });
});
