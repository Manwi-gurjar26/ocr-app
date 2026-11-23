/**
 * Document categories. The first four are the KiloWattX verification documents
 * (blueprint §11); invoice/receipt are kept for general bookkeeping scans.
 * `id_card` is the KYC document category (Aadhaar, PAN, passport, ...).
 */
export const DOC_TYPES = [
  "electricity_bill",
  "gst_certificate",
  "bank_statement",
  "id_card",
  "invoice",
  "receipt",
  "unknown",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

/**
 * Processing lifecycle:
 * UPLOADED → PROCESSING → EXTRACTED → VALIDATION_PENDING → VERIFIED | MANUAL_REVIEW | FAILED
 * FAILED is reserved for real processing failures or a reviewer's rejection — an uncertain
 * OCR result or a failed business rule goes to MANUAL_REVIEW instead of rejecting a genuine customer.
 */
export const DOC_STATUSES = [
  "uploaded",
  "processing",
  "extracted",
  "validation_pending",
  "verified",
  "manual_review",
  "failed",
] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const BUSY_STATUSES: readonly DocStatus[] = ["uploaded", "processing", "extracted", "validation_pending"];
export function isBusy(s: DocStatus): boolean {
  return BUSY_STATUSES.includes(s);
}

export type ExtractionMethod = "ai" | "rules" | "textract" | "perfios";

/** Which OCR backend produced the text. */
export type OcrProviderName = "tesseract" | "textract" | "perfios";

export interface LineItem {
  description: string;
  quantity?: number | null;
  unitPrice?: number | null;
  amount?: number | null;
}

export interface InvoiceFields {
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  vendorName?: string | null;
  vendorGstin?: string | null;
  customerName?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  total?: number | null;
  currency?: string | null;
  lineItems?: LineItem[];
}

export interface ReceiptFields {
  merchantName?: string | null;
  date?: string | null;
  time?: string | null;
  paymentMethod?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  total?: number | null;
  currency?: string | null;
  items?: LineItem[];
}

export type IdType = "aadhaar" | "pan" | "passport" | "driving_license" | "voter_id" | "other";

export interface IdCardFields {
  idType?: IdType | null;
  idNumber?: string | null;
  fullName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  fatherName?: string | null;
  address?: string | null;
  expiryDate?: string | null;
}

export interface ElectricityBillFields {
  discom?: string | null;
  consumerName?: string | null;
  consumerNumber?: string | null;
  address?: string | null;
  billDate?: string | null;
  billingPeriod?: string | null;
  unitsConsumed?: number | null;
  sanctionedLoad?: string | null;
  amountPayable?: number | null;
  dueDate?: string | null;
  currency?: string | null;
}

export interface GstCertificateFields {
  gstin?: string | null;
  legalName?: string | null;
  tradeName?: string | null;
  address?: string | null;
  constitution?: string | null;
  registrationType?: string | null;
  dateOfLiability?: string | null;
  dateOfIssue?: string | null;
}

export interface BankTransaction {
  date: string | null;
  description: string;
  debit?: number | null;
  credit?: number | null;
  balance?: number | null;
}

export interface BankStatementFields {
  bankName?: string | null;
  accountHolder?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  openingBalance?: number | null;
  closingBalance?: number | null;
  totalCredits?: number | null;
  totalDebits?: number | null;
  currency?: string | null;
  transactions?: BankTransaction[];
}

export type DocumentFields =
  | InvoiceFields
  | ReceiptFields
  | IdCardFields
  | ElectricityBillFields
  | GstCertificateFields
  | BankStatementFields
  | Record<string, unknown>;

/** Details the customer typed in (KYB form etc.), used for field-consistency checks. */
export type DeclaredDetails = Record<string, string | number | null | undefined>;

export type CheckStatus = "pass" | "warn" | "fail";
export interface ValidationCheck {
  id: string;
  label: string;
  status: CheckStatus;
  message: string;
}
export interface ValidationResult {
  outcome: "verified" | "manual_review";
  checks: ValidationCheck[];
  /** Plain-language reasons the document needs a human, empty when verified. */
  reasons: string[];
  validatedAt: string;
}

export const REVIEW_ACTIONS = ["approve", "reject", "request_reupload"] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];
