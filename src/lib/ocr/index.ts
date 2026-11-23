import path from "node:path";
import sharp from "sharp";
import { createWorker, type Worker } from "tesseract.js";
import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";

export const SUPPORTED_MIME = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;
export type SupportedMime = (typeof SUPPORTED_MIME)[number];

export interface OcrResult {
  text: string;
  /** 0-100. PDF text-layer pages count as 100. */
  confidence: number;
  pages: number;
  source: "image" | "pdf-text" | "pdf-scan" | "pdf-mixed";
  /** PNG images of up to the first 3 pages; used for AI vision + previews. */
  images: Buffer[];
}

const MAX_PDF_PAGES = 10;
const MIN_TEXT_LAYER_CHARS = 25;

const g = globalThis as unknown as { __ocrWorker?: Promise<Worker> };

function getWorker(): Promise<Worker> {
  if (!g.__ocrWorker) {
    const langs = (process.env.OCR_LANGS ?? "eng").split("+");
    g.__ocrWorker = createWorker(langs, 1, {
      cachePath: path.join(process.cwd(), ".cache", "tesseract"),
    }).catch((e) => {
      g.__ocrWorker = undefined;
      throw e;
    });
  }
  return g.__ocrWorker;
}

export async function terminateOcr(): Promise<void> {
  if (g.__ocrWorker) {
    const w = await g.__ocrWorker;
    g.__ocrWorker = undefined;
    await w.terminate();
  }
}

/**
 * Remove uneven lighting (phone-photo shadows, scanner gradients): divide each pixel by a heavily
 * blurred copy of the page, which approximates the paper's background brightness.
 */
async function flattenIllumination(gray: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(gray).toColourspace("b-w").raw().toBuffer({ resolveWithObject: true });
  const bg = await sharp(gray).toColourspace("b-w").blur(Math.max(15, Math.round(info.width / 60))).raw().toBuffer();
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) out[i] = Math.min(255, Math.round((data[i] / Math.max(bg[i], 1)) * 255));
  return sharp(out, { raw: info }).normalize().png().toBuffer();
}

/**
 * Estimate page skew in degrees with a projection profile: text lines produce the sharpest
 * row-histogram peaks when the page is level. Returns the angle the content is rotated by
 * (clockwise positive), searched within ±10°.
 */
export async function estimateSkew(gray: Buffer): Promise<number> {
  const { data, info } = await sharp(gray)
    .flatten({ background: "#ffffff" })
    .resize({ width: 700 })
    .threshold(140)
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * ch] === 0) {
        xs.push(x);
        ys.push(y);
      }
  if (xs.length < 200) return 0;
  const score = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    const sin = Math.sin(a);
    const cos = Math.cos(a);
    const bins = new Float64Array(h * 2 + w);
    for (let i = 0; i < xs.length; i++) bins[Math.round(ys[i] * cos - xs[i] * sin) + w]++;
    let s = 0;
    for (const b of bins) s += b * b;
    return s;
  };
  let best = 0;
  let bestScore = score(0);
  for (let d = -10; d <= 10; d += 0.5) {
    const s = score(d);
    if (s > bestScore * 1.0001) {
      best = d;
      bestScore = s;
    }
  }
  for (let d = best - 0.4; d <= best + 0.4; d += 0.1) {
    const s = score(d);
    if (s > bestScore) {
      best = d;
      bestScore = s;
    }
  }
  return Math.round(best * 10) / 10;
}

/**
 * Normalise a photo/scan for OCR: EXIF auto-rotate, grayscale, flatten shadows, deskew,
 * contrast stretch, and scale to a resolution Tesseract reads well.
 */
export async function preprocessImage(input: Buffer): Promise<Buffer> {
  const img = sharp(input, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const g = img.flatten({ background: "#ffffff" }).grayscale();
  if (width && width < 1600) g.resize({ width: 1600, kernel: "lanczos3" });
  else if (width > 3500) g.resize({ width: 3500 });
  let page = await flattenIllumination(await g.png().toBuffer());
  const skew = await estimateSkew(page);
  if (Math.abs(skew) >= 0.6)
    page = await sharp(page).rotate(-skew, { background: "#ffffff" }).flatten({ background: "#ffffff" }).toColourspace("b-w").png().toBuffer();
  // Tesseract warns about (and guesses) missing DPI; scans at this width are ~300 dpi.
  return sharp(page).withMetadata({ density: 300 }).png().toBuffer();
}

/** Below this, the first read is treated as doubtful and alternatives are tried. */
const RETRY_CONFIDENCE = 75;
/** Below this, the page may be sideways or upside down. */
const ORIENTATION_CONFIDENCE = 60;

async function recognize(img: Buffer): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker();
  const { data } = await worker.recognize(img);
  return { text: cleanText(data.text), confidence: Math.round(data.confidence ?? 0) };
}

/** Score a reading: confidence, discounted when almost no text came out. */
const quality = (r: { text: string; confidence: number }) => r.confidence * Math.min(1, r.text.replace(/\s/g, "").length / 40);

/** Otsu's method: the gray level that best separates ink from paper. */
export function otsuLevel(gray: Uint8Array | Buffer): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumB = 0, wB = 0, best = 0, level = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      level = t;
    }
  }
  return level;
}

/** Remove speckle (median filter) and binarise at the Otsu level: clean black text on white. */
async function binarize(img: Buffer): Promise<Buffer> {
  const med = sharp(img).median(3).toColourspace("b-w");
  const { data } = await med.clone().raw().toBuffer({ resolveWithObject: true });
  return med.threshold(otsuLevel(data)).withMetadata({ density: 300 }).png().toBuffer();
}

/**
 * Mean absolute difference between the page and its median-filtered copy, on a downscaled view.
 * Clean scans score ~1–3; grainy photos 5 and up.
 */
export async function noiseLevel(img: Buffer): Promise<number> {
  const small = sharp(img).resize({ width: 800 }).toColourspace("b-w");
  const [a, b] = await Promise.all([small.clone().raw().toBuffer(), small.clone().median(3).raw().toBuffer()]);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}
// Calibrated: clean/JPEG/blurred scans measure 0.8–2.7, grainy photos 5+.
const NOISY = 4.5;

export async function ocrImage(input: Buffer): Promise<{ text: string; confidence: number; rotation: number }> {
  const prepared = await preprocessImage(input);
  const noisy = (await noiseLevel(prepared)) > NOISY;
  // Grainy photos: OCR on a grey, speckled page is both wrong and very slow — binarise first.
  const primary = noisy ? await binarize(prepared) : prepared;
  let best = { ...(await recognize(primary)), rotation: 0 };
  if (best.confidence >= RETRY_CONFIDENCE) return best;

  if (!noisy) {
    const r = { ...(await recognize(await binarize(prepared))), rotation: 0 };
    if (quality(r) > quality(best)) best = r;
    if (best.confidence >= RETRY_CONFIDENCE) return best;
  }

  // Sideways / upside-down scans without EXIF orientation: probe each angle on a half-size copy
  // (cheap), then read only the winner at full resolution.
  if (best.confidence < ORIENTATION_CONFIDENCE) {
    const base = await binarize(prepared);
    const meta = await sharp(base).metadata();
    const half = await sharp(base).resize({ width: Math.round((meta.width ?? 1600) / 2) }).png().toBuffer();
    let winner = { rotation: 0, q: -1 };
    for (const rotation of [0, 180, 90, 270]) {
      const r = await recognize(await sharp(half).rotate(rotation).png().toBuffer());
      if (quality(r) > winner.q) winner = { rotation, q: quality(r) };
    }
    if (winner.rotation) {
      const r = { ...(await recognize(await sharp(base).rotate(winner.rotation).png().toBuffer())), rotation: winner.rotation };
      if (quality(r) > quality(best)) best = r;
    }
  }
  return best;
}

async function renderPdfPage(pdfBytes: Uint8Array, page: number): Promise<Buffer> {
  // PDF.js takes ownership of the buffer, so pass a copy each time.
  const out = await renderPageAsImage(new Uint8Array(pdfBytes), page, {
    canvasImport: () => import("@napi-rs/canvas"),
    scale: 2.5,
  });
  return Buffer.from(out as Uint8Array);
}

export async function ocrPdf(input: Buffer): Promise<OcrResult> {
  const bytes = new Uint8Array(input);
  const pdf = await getDocumentProxy(new Uint8Array(bytes), { maxImageSize: 16_777_216 });
  const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const { text: pageTexts } = await extractText(pdf, { mergePages: false });

  const texts: string[] = [];
  const confs: number[] = [];
  const images: Buffer[] = [];
  let scanned = 0;

  for (let p = 1; p <= pages; p++) {
    const layer = cleanText((pageTexts as string[])[p - 1] ?? "");
    const needImage = layer.length < MIN_TEXT_LAYER_CHARS || p <= 3;
    const img = needImage ? await renderPdfPage(bytes, p) : undefined;
    if (img && p <= 3) images.push(img);

    if (layer.length >= MIN_TEXT_LAYER_CHARS) {
      texts.push(layer);
      confs.push(100);
    } else {
      const r = await ocrImage(img!);
      texts.push(r.text);
      confs.push(r.confidence);
      scanned++;
    }
  }

  const source = scanned === 0 ? "pdf-text" : scanned === pages ? "pdf-scan" : "pdf-mixed";
  const confidence = Math.round(confs.reduce((a, b) => a + b, 0) / Math.max(confs.length, 1));
  return { text: texts.join("\n\n").trim(), confidence, pages, source, images };
}

export async function ocrFile(input: Buffer, mime: string): Promise<OcrResult> {
  if (mime === "application/pdf") return ocrPdf(input);
  if (!(SUPPORTED_MIME as readonly string[]).includes(mime)) throw new Error(`Unsupported file type: ${mime}`);
  const { rotation, ...r } = await ocrImage(input);
  let png = await sharp(input, { failOn: "none" }).rotate().png().toBuffer();
  if (rotation) png = await sharp(png).rotate(rotation).png().toBuffer();
  return { ...r, pages: 1, source: "image", images: [png] };
}

export function cleanText(s: string): string {
  return s
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
