import { ocrFile } from "../ocr";
import type { DocumentChecker } from "./types";

/** Local, offline OCR (Tesseract + PDF text layer). Always available; used for dev and as the fallback. */
export const tesseractChecker: DocumentChecker = {
  name: "tesseract",
  available: () => true,
  async analyze({ bytes, mime }) {
    const r = await ocrFile(bytes, mime);
    return { provider: "tesseract", text: r.text, confidence: r.confidence, pages: r.pages, images: r.images };
  },
};
