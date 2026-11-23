import type { DocType, OcrProviderName } from "../types";
import { perfiosChecker } from "./perfios";
import { tesseractChecker } from "./tesseract";
import { textractChecker } from "./textract";
import type { CheckerOutput, DocumentChecker } from "./types";

export type { CheckerOutput, DocumentChecker, TamperSignal } from "./types";

/** Blueprint §11 routing: which provider handles which document category. */
export const PROVIDER_FOR: Partial<Record<DocType, OcrProviderName>> = {
  electricity_bill: "textract",
  gst_certificate: "textract",
  id_card: "perfios",
  bank_statement: "perfios",
};

export type CheckerRegistry = Record<OcrProviderName, DocumentChecker>;

export const defaultRegistry: CheckerRegistry = {
  tesseract: tesseractChecker,
  textract: textractChecker,
  perfios: perfiosChecker,
};

/** The provider for a document type, falling back to local Tesseract when the preferred one isn't configured. */
export function selectChecker(docType: DocType | null | undefined, registry: CheckerRegistry = defaultRegistry): DocumentChecker {
  const preferred = docType ? PROVIDER_FOR[docType] : undefined;
  if (preferred && registry[preferred].available()) return registry[preferred];
  return registry.tesseract;
}

/** Run the selected provider; if an external provider errors, retry locally so the document still gets processed. */
export async function runChecker(
  input: { bytes: Buffer; mime: string; docType?: DocType | null },
  registry: CheckerRegistry = defaultRegistry,
  log: (msg: string, err?: unknown) => void = console.error,
): Promise<CheckerOutput> {
  const checker = selectChecker(input.docType, registry);
  try {
    return await checker.analyze(input);
  } catch (err) {
    if (checker.name === "tesseract") throw err;
    log(`${checker.name} failed, falling back to local OCR`, err);
    return registry.tesseract.analyze(input);
  }
}
