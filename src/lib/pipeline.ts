import type { DocumentRow } from "@/db/schema";
import type { DocumentsRepo } from "./documents-repo";
import { aiAvailable, extractWithAi, type AiResult } from "./extract/ai";
import { classify } from "./extract/classify";
import { extractWithRules } from "./extract/rules";
import { ocrFile, SUPPORTED_MIME, type OcrResult } from "./ocr";
import { readUpload, saveUpload } from "./storage";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface PipelineDeps {
  repo: DocumentsRepo;
  ocr?: (bytes: Buffer, mime: string) => Promise<OcrResult>;
  /** Pass null to force rules-only extraction. */
  ai?: ((images: Buffer[], text: string) => Promise<AiResult>) | null;
  log?: (msg: string, err?: unknown) => void;
}

export class UploadError extends Error {}

export function validateUpload(name: string, mime: string, size: number): void {
  if (!(SUPPORTED_MIME as readonly string[]).includes(mime))
    throw new UploadError(`"${name}": only PNG, JPG, WEBP and PDF files are supported`);
  if (size === 0) throw new UploadError(`"${name}" is empty`);
  if (size > MAX_UPLOAD_BYTES) throw new UploadError(`"${name}" is larger than 10 MB`);
}

/** Save the file and create a `processing` row. Call `processDocument` afterwards (e.g. in the background). */
export async function ingestUpload(
  deps: Pick<PipelineDeps, "repo">,
  file: { name: string; mime: string; bytes: Buffer },
): Promise<DocumentRow> {
  validateUpload(file.name, file.mime, file.bytes.length);
  const filePath = await saveUpload(file.bytes, file.mime);
  return deps.repo.create({ fileName: file.name, mimeType: file.mime, fileSize: file.bytes.length, filePath });
}

export async function processDocument(deps: PipelineDeps, id: string): Promise<DocumentRow | undefined> {
  const { repo, ocr = ocrFile, log = console.error } = deps;
  const ai = deps.ai === undefined ? (aiAvailable() ? extractWithAi : null) : deps.ai;
  const doc = await repo.get(id);
  if (!doc) return undefined;
  await repo.update(id, { status: "processing", error: null });

  try {
    const bytes = await readUpload(doc.filePath);
    const result = await ocr(bytes, doc.mimeType);

    let extracted: AiResult | null = null;
    if (ai) {
      try {
        extracted = await ai(result.images, result.text);
      } catch (err) {
        log(`AI extraction failed for ${id}, falling back to rules`, err);
      }
    }
    const method = extracted ? "ai" : "rules";
    if (!extracted) {
      const type = classify(result.text).type;
      extracted = { docType: type, fields: extractWithRules(type, result.text) };
    }

    return repo.update(id, {
      status: "done",
      docType: extracted.docType,
      fields: extracted.fields,
      extractionMethod: method,
      rawText: result.text,
      ocrConfidence: result.confidence,
    });
  } catch (err) {
    log(`Processing failed for ${id}`, err);
    return repo.update(id, { status: "failed", error: err instanceof Error ? err.message : String(err) });
  }
}
