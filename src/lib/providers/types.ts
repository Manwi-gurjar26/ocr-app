import type { DocType, DocumentFields, OcrProviderName } from "../types";

export interface TamperSignal {
  code: string;
  message: string;
  severity: "low" | "medium" | "high";
}

/** Normalised output every OCR provider must return. */
export interface CheckerOutput {
  provider: OcrProviderName;
  /** Full reading-order text. Key/value pairs a provider detects are appended as "Key: Value" lines. */
  text: string;
  /** 0–100. */
  confidence: number;
  pages: number;
  /** Page images (PNG) for AI vision and previews; may be empty. */
  images: Buffer[];
  /** Structured fields when the provider extracts them itself (e.g. Perfios). Otherwise our rules run on `text`. */
  fields?: DocumentFields;
  /** Document type the provider detected, if any. */
  docType?: DocType;
  /** Document-tamper / behavioural findings (Perfios). */
  tamper?: TamperSignal[];
}

/**
 * The common integration interface from the blueprint: every external OCR / verification
 * service sits behind this, so swapping a provider never touches the pipeline.
 */
export interface DocumentChecker {
  readonly name: OcrProviderName;
  /** True when credentials/config are present. */
  available(): boolean;
  analyze(input: { bytes: Buffer; mime: string; docType?: DocType | null }): Promise<CheckerOutput>;
}
