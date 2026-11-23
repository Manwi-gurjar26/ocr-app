import type { DocumentRow } from "@/db/schema";
import type { DocumentsRepo } from "./documents-repo";
import { aiAvailable, extractWithAi, type AiResult } from "./extract/ai";
import { classify } from "./extract/classify";
import { extractWithRules } from "./extract/rules";
import { SUPPORTED_MIME, type OcrResult } from "./ocr";
import { defaultRegistry, runChecker, type CheckerOutput, type CheckerRegistry } from "./providers";
import { readUpload, saveUpload } from "./storage";
import type { DeclaredDetails, DocType, DocumentFields, ExtractionMethod, ReviewAction } from "./types";
import { validateDocument } from "./validation";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface PipelineDeps {
  repo: DocumentsRepo;
  /** Override OCR entirely (tests). Takes precedence over `checkers`. */
  ocr?: (bytes: Buffer, mime: string) => Promise<OcrResult>;
  /** Provider registry (Tesseract / Textract / Perfios). */
  checkers?: CheckerRegistry;
  /** Pass null to force rules-only extraction. */
  ai?: ((images: Buffer[], text: string) => Promise<AiResult>) | null;
  log?: (msg: string, err?: unknown) => void;
  now?: () => Date;
}

export class UploadError extends Error {}

export function validateUpload(name: string, mime: string, size: number): void {
  if (!(SUPPORTED_MIME as readonly string[]).includes(mime))
    throw new UploadError(`"${name}": only PDF, JPG, JPEG, PNG and WEBP files are supported`);
  if (size === 0) throw new UploadError(`"${name}" is empty`);
  if (size > MAX_UPLOAD_BYTES) throw new UploadError(`"${name}" is larger than 10 MB`);
}

/** Magic-byte sniffing: the declared MIME type must match the actual file contents. */
export function sniffMime(bytes: Buffer): string | null {
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (bytes[0] === 0x89 && bytes.subarray(1, 4).toString("latin1") === "PNG") return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export interface UploadInput {
  name: string;
  mime: string;
  bytes: Buffer;
  customerId?: string | null;
  declaredType?: DocType | null;
  declared?: DeclaredDetails | null;
}

/** Validate + store the file and create an `uploaded` row. Call `processDocument` afterwards (e.g. in the background). */
export async function ingestUpload(deps: Pick<PipelineDeps, "repo">, file: UploadInput): Promise<DocumentRow> {
  validateUpload(file.name, file.mime, file.bytes.length);
  const actual = sniffMime(file.bytes);
  if (actual !== file.mime && !(actual === "image/jpeg" && file.mime === "image/jpg"))
    throw new UploadError(`"${file.name}": file contents do not match its ${file.mime} type`);
  const filePath = await saveUpload(file.bytes, file.mime);
  const doc = await deps.repo.create({
    fileName: file.name,
    mimeType: file.mime,
    fileSize: file.bytes.length,
    filePath,
    status: "uploaded",
    customerId: file.customerId ?? null,
    declaredType: file.declaredType && file.declaredType !== "unknown" ? file.declaredType : null,
    declared: file.declared ?? {},
  });
  await deps.repo.transition(doc.id, "uploaded", {}, { note: "Document received" });
  return doc;
}

interface Extracted {
  docType: DocType;
  detectedType: DocType;
  fields: DocumentFields;
  method: ExtractionMethod;
}

async function extract(deps: PipelineDeps, doc: DocumentRow, out: CheckerOutput): Promise<Extracted> {
  const log = deps.log ?? console.error;
  const ai = deps.ai === undefined ? (aiAvailable() ? extractWithAi : null) : deps.ai;
  const declared = doc.declaredType;

  // 1. Provider already returned structured fields (e.g. Perfios).
  if (out.fields && Object.keys(out.fields).length) {
    const t = out.docType ?? declared ?? classify(out.text).type;
    return { docType: t, detectedType: out.docType ?? classify(out.text).type, fields: out.fields, method: out.provider === "perfios" ? "perfios" : "rules" };
  }

  // 2. Claude vision, if configured.
  if (ai && out.images.length) {
    try {
      const r = await ai(out.images, out.text);
      // If AI can't tell but the uploader chose a type, keep the uploader's choice.
      const docType = r.docType === "unknown" && declared ? declared : r.docType;
      return { docType, detectedType: r.docType, fields: r.fields, method: "ai" };
    } catch (err) {
      log(`AI extraction failed for ${doc.id}, falling back to rules`, err);
    }
  }

  // 3. Rules on the OCR text.
  const detectedType = classify(out.text).type;
  const docType = detectedType !== "unknown" ? detectedType : (declared ?? "unknown");
  return {
    docType,
    detectedType,
    fields: extractWithRules(docType, out.text),
    method: out.provider === "textract" ? "textract" : "rules",
  };
}

export async function processDocument(deps: PipelineDeps, id: string): Promise<DocumentRow | undefined> {
  const { repo, log = console.error, now = () => new Date() } = deps;
  const doc = await repo.get(id);
  if (!doc) return undefined;
  await repo.transition(id, "processing", { error: null, reviewedBy: null, reviewedAt: null, reviewNote: null });

  try {
    const bytes = await readUpload(doc.filePath);
    const out: CheckerOutput = deps.ocr
      ? { provider: "tesseract", ...(await deps.ocr(bytes, doc.mimeType)) }
      : await runChecker({ bytes, mime: doc.mimeType, docType: doc.declaredType }, deps.checkers ?? defaultRegistry, log);

    const ex = await extract(deps, doc, out);

    await repo.transition(id, "extracted", {
      docType: ex.docType,
      fields: ex.fields,
      extractionMethod: ex.method,
      ocrProvider: out.provider,
      rawText: out.text,
      ocrConfidence: out.confidence,
    });
    const extraction = await repo.addExtraction({
      documentId: id,
      provider: out.provider,
      extractionMethod: ex.method,
      docType: ex.docType,
      extractedText: out.text,
      extractedData: ex.fields,
      confidenceScore: out.confidence,
    });

    await repo.transition(id, "validation_pending");
    const validation = validateDocument(
      {
        docType: ex.docType,
        detectedType: ex.detectedType,
        declaredType: doc.declaredType,
        fields: ex.fields as Record<string, unknown>,
        declared: doc.declared,
        confidence: out.confidence,
        tamper: out.tamper,
      },
      { now: now() },
    );
    await repo.updateExtraction(extraction.id, { validationResult: validation });
    return repo.transition(
      id,
      validation.outcome,
      { validation },
      { note: validation.outcome === "verified" ? "All checks passed" : validation.reasons.join("; ") },
    );
  } catch (err) {
    log(`Processing failed for ${id}`, err);
    const message = err instanceof Error ? err.message : String(err);
    return repo.transition(id, "failed", { error: message }, { note: message });
  }
}

/** Re-run business rules on the stored fields (e.g. after a reviewer corrects a value). */
export async function revalidate(deps: Pick<PipelineDeps, "repo" | "now">, id: string): Promise<DocumentRow | undefined> {
  const doc = await deps.repo.get(id);
  if (!doc) return undefined;
  const validation = validateDocument(
    {
      docType: doc.docType,
      declaredType: doc.declaredType,
      fields: doc.fields as Record<string, unknown>,
      declared: doc.declared,
      confidence: doc.ocrConfidence,
    },
    { now: (deps.now ?? (() => new Date()))() },
  );
  return deps.repo.transition(id, validation.outcome, { validation }, { note: `Revalidated: ${validation.reasons.join("; ") || "all checks passed"}` });
}

export class ReviewError extends Error {}

const REVIEW_TARGET = { approve: "verified", reject: "failed", request_reupload: "failed" } as const;

/** A reviewer resolves a document. Only documents in manual review (or already resolved) can be reviewed. */
export async function reviewDocument(
  deps: Pick<PipelineDeps, "repo">,
  id: string,
  input: { action: ReviewAction; reviewer: string; note?: string | null },
): Promise<DocumentRow | undefined> {
  const doc = await deps.repo.get(id);
  if (!doc) return undefined;
  if (!["manual_review", "verified", "failed"].includes(doc.status))
    throw new ReviewError(`Document is still ${doc.status.replace(/_/g, " ")}; wait for processing to finish`);
  if (input.action !== "approve" && !input.note?.trim()) throw new ReviewError("A note is required when rejecting or requesting a re-upload");
  const to = REVIEW_TARGET[input.action];
  return deps.repo.transition(
    id,
    to,
    {
      reviewedBy: input.reviewer,
      reviewedAt: new Date(),
      reviewNote: input.note ?? null,
      error: input.action === "approve" ? null : input.action === "reject" ? `Rejected: ${input.note}` : `Re-upload requested: ${input.note}`,
    },
    { action: input.action, actor: input.reviewer, note: input.note ?? null },
  );
}
