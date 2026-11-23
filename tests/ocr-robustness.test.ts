import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { estimateSkew, noiseLevel, ocrFile, otsuLevel, preprocessImage, terminateOcr } from "@/lib/ocr";
import { SAMPLE_INVOICE, textImage } from "./helpers/fixtures";

afterAll(() => terminateOcr());

const page = textImage(SAMPLE_INVOICE);

async function noisy(png: Buffer, amount: number): Promise<Buffer> {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < data.length; i++) data[i] = Math.max(0, Math.min(255, data[i] + (rand() - 0.5) * amount));
  return sharp(data, { raw: info }).png().toBuffer();
}

describe("image preprocessing", () => {
  it.each([0, 1.5, -3, 6, -9])("estimates a %s° skew within 0.3°", async (deg) => {
    const rotated = await sharp(page).rotate(deg, { background: "#fff" }).png().toBuffer();
    expect(Math.abs((await estimateSkew(rotated)) - deg)).toBeLessThanOrEqual(0.3);
  });

  it("finds the ink/paper split with Otsu", () => {
    const px = Buffer.from([...Array(500).fill(20), ...Array(1500).fill(235)]);
    const t = otsuLevel(px);
    expect(t).toBeGreaterThanOrEqual(20);
    expect(t).toBeLessThan(235);
  });

  it("separates clean scans from grainy photos by noise level", async () => {
    expect(await noiseLevel(await preprocessImage(page))).toBeLessThan(4.5);
    expect(await noiseLevel(await preprocessImage(await noisy(page, 140)))).toBeGreaterThan(4.5);
  });
});

describe("OCR on degraded pages", () => {
  const read = (bytes: Buffer, mime = "image/png") => ocrFile(bytes, mime);

  it("reads a page photographed upside down (no EXIF) and returns an upright preview", async () => {
    const r = await read(await sharp(page).rotate(180).png().toBuffer());
    expect(r.text).toMatch(/INV-2024-0457/);
    expect(r.text).toMatch(/20,060\.00/);
    expect(r.confidence).toBeGreaterThan(80);
  }, 180_000);

  it("reads a sideways page", async () => {
    const r = await read(await sharp(page).rotate(90).png().toBuffer());
    expect(r.text).toMatch(/INV-2024-0457/);
  }, 180_000);

  it("reads a skewed page", async () => {
    const r = await read(await sharp(page).rotate(5, { background: "#fff" }).png().toBuffer());
    expect(r.text).toMatch(/INV-2024-0457/);
    expect(r.text).toMatch(/Grand Total: Rs 20,060\.00/);
  }, 180_000);

  it("reads a grainy photo quickly", async () => {
    const t = Date.now();
    const r = await read(await noisy(page, 140));
    expect(r.text).toMatch(/INV-2024-0457/);
    expect(Date.now() - t).toBeLessThan(30_000); // previously ~90-180 s
  }, 180_000);

  it("reads a page with a heavy shadow across it", async () => {
    const m = await sharp(page).metadata();
    const shade = Buffer.from(
      `<svg width="${m.width}" height="${m.height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#6f6a60"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
    );
    const shaded = await sharp(page).linear(0.55, 90).composite([{ input: shade, blend: "multiply" }]).png().toBuffer();
    const r = await read(shaded);
    expect(r.text).toMatch(/Grand Total: Rs 20,060\.00/);
  }, 180_000);
});
