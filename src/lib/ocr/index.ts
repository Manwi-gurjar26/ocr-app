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

/** Normalise a photo/scan for OCR: auto-rotate, grayscale, contrast stretch, upscale small images. */
export async function preprocessImage(input: Buffer): Promise<Buffer> {
  const img = sharp(input, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const pipeline = img.grayscale().normalize();
  if (width && width < 1600) pipeline.resize({ width: 1600, kernel: "lanczos3" });
  else if (width > 3500) pipeline.resize({ width: 3500 });
  return pipeline.png().toBuffer();
}

export async function ocrImage(input: Buffer): Promise<{ text: string; confidence: number }> {
  const prepared = await preprocessImage(input);
  const worker = await getWorker();
  const { data } = await worker.recognize(prepared);
  return { text: cleanText(data.text), confidence: Math.round(data.confidence ?? 0) };
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
  const r = await ocrImage(input);
  const png = await sharp(input, { failOn: "none" }).rotate().png().toBuffer();
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
