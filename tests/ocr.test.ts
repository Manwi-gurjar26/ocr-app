import { afterAll, describe, expect, it } from "vitest";
import { cleanText, ocrFile, terminateOcr } from "@/lib/ocr";
import { SAMPLE_INVOICE, scannedPdf, textImage, textPdf } from "./helpers/fixtures";

afterAll(() => terminateOcr());

describe("ocr", () => {
  it("cleans whitespace", () => {
    expect(cleanText("  a   b \r\n\n\n\n c ")).toBe("a b\n\nc");
  });

  it("reads text from a PNG image", async () => {
    const r = await ocrFile(textImage(SAMPLE_INVOICE), "image/png");
    expect(r.source).toBe("image");
    expect(r.text).toMatch(/TAX INVOICE/i);
    expect(r.text).toMatch(/INV-2024-0457/);
    expect(r.text).toMatch(/20,060\.00/);
    expect(r.confidence).toBeGreaterThan(70);
    expect(r.images).toHaveLength(1);
  }, 180_000);

  it("uses the text layer of a digital PDF", async () => {
    const r = await ocrFile(await textPdf(SAMPLE_INVOICE), "application/pdf");
    expect(r.source).toBe("pdf-text");
    expect(r.confidence).toBe(100);
    expect(r.text).toContain("INV-2024-0457");
    expect(r.images.length).toBe(1);
  });

  it("OCRs a scanned (image-only) PDF", async () => {
    const r = await ocrFile(await scannedPdf(SAMPLE_INVOICE), "application/pdf");
    expect(r.source).toBe("pdf-scan");
    expect(r.text).toMatch(/INV-2024-0457/);
  }, 180_000);

  it("rejects unsupported types", async () => {
    await expect(ocrFile(Buffer.from("x"), "text/plain")).rejects.toThrow(/Unsupported/);
  });
});
