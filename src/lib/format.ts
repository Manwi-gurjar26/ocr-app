import { maskIdNumber } from "./extract/rules/id-card";
import type { BankTransaction, DocStatus, DocType, LineItem } from "./types";

export const TYPE_LABEL: Record<DocType, string> = {
  electricity_bill: "Electricity Bill",
  gst_certificate: "GST Certificate",
  bank_statement: "Bank Statement",
  invoice: "Invoice",
  receipt: "Receipt",
  id_card: "KYC Document",
  unknown: "Unknown",
};

export const STATUS_LABEL: Record<DocStatus, string> = {
  uploaded: "Uploaded",
  processing: "Processing",
  extracted: "Extracted",
  validation_pending: "Validating",
  verified: "Verified",
  manual_review: "Manual review",
  failed: "Failed",
};

export const ID_TYPE_LABEL: Record<string, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN Card",
  passport: "Passport",
  driving_license: "Driving Licence",
  voter_id: "Voter ID",
  other: "Other ID",
};

type FieldKind = "text" | "money" | "date" | "idType" | "number" | "masked";
export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
}

export const FIELD_DEFS: Record<Exclude<DocType, "unknown">, FieldDef[]> = {
  electricity_bill: [
    { key: "discom", label: "DISCOM", kind: "text" },
    { key: "consumerName", label: "Consumer Name", kind: "text" },
    { key: "consumerNumber", label: "Consumer No.", kind: "text" },
    { key: "address", label: "Address", kind: "text" },
    { key: "billDate", label: "Bill Date", kind: "date" },
    { key: "billingPeriod", label: "Billing Period", kind: "text" },
    { key: "unitsConsumed", label: "Units (kWh)", kind: "number" },
    { key: "sanctionedLoad", label: "Sanctioned Load", kind: "text" },
    { key: "amountPayable", label: "Amount Payable", kind: "money" },
    { key: "dueDate", label: "Due Date", kind: "date" },
  ],
  gst_certificate: [
    { key: "gstin", label: "GSTIN", kind: "text" },
    { key: "legalName", label: "Legal Name", kind: "text" },
    { key: "tradeName", label: "Trade Name", kind: "text" },
    { key: "address", label: "Principal Place", kind: "text" },
    { key: "constitution", label: "Constitution", kind: "text" },
    { key: "registrationType", label: "Registration Type", kind: "text" },
    { key: "dateOfLiability", label: "Date of Liability", kind: "date" },
    { key: "dateOfIssue", label: "Date of Issue", kind: "date" },
  ],
  bank_statement: [
    { key: "bankName", label: "Bank", kind: "text" },
    { key: "accountHolder", label: "Account Holder", kind: "text" },
    { key: "accountNumber", label: "Account No.", kind: "masked" },
    { key: "ifsc", label: "IFSC", kind: "text" },
    { key: "periodFrom", label: "Period From", kind: "date" },
    { key: "periodTo", label: "Period To", kind: "date" },
    { key: "openingBalance", label: "Opening Balance", kind: "money" },
    { key: "totalCredits", label: "Total Credits", kind: "money" },
    { key: "totalDebits", label: "Total Debits", kind: "money" },
    { key: "closingBalance", label: "Closing Balance", kind: "money" },
  ],
  invoice: [
    { key: "invoiceNumber", label: "Invoice No.", kind: "text" },
    { key: "invoiceDate", label: "Invoice Date", kind: "date" },
    { key: "dueDate", label: "Due Date", kind: "date" },
    { key: "vendorName", label: "Vendor", kind: "text" },
    { key: "vendorGstin", label: "Vendor GSTIN", kind: "text" },
    { key: "customerName", label: "Customer", kind: "text" },
    { key: "subtotal", label: "Subtotal", kind: "money" },
    { key: "tax", label: "Tax", kind: "money" },
    { key: "total", label: "Total", kind: "money" },
    { key: "currency", label: "Currency", kind: "text" },
  ],
  receipt: [
    { key: "merchantName", label: "Merchant", kind: "text" },
    { key: "date", label: "Date", kind: "date" },
    { key: "time", label: "Time", kind: "text" },
    { key: "paymentMethod", label: "Payment", kind: "text" },
    { key: "subtotal", label: "Subtotal", kind: "money" },
    { key: "tax", label: "Tax", kind: "money" },
    { key: "total", label: "Total", kind: "money" },
    { key: "currency", label: "Currency", kind: "text" },
  ],
  id_card: [
    { key: "idType", label: "ID Type", kind: "idType" },
    { key: "idNumber", label: "ID Number", kind: "text" },
    { key: "fullName", label: "Full Name", kind: "text" },
    { key: "dateOfBirth", label: "Date of Birth", kind: "date" },
    { key: "gender", label: "Gender", kind: "text" },
    { key: "fatherName", label: "Father's Name", kind: "text" },
    { key: "address", label: "Address", kind: "text" },
    { key: "expiryDate", label: "Expiry Date", kind: "date" },
  ],
};

export function formatMoney(n: unknown, currency?: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const cur = typeof currency === "string" && currency ? currency : "INR";
  const locale = cur === "INR" ? "en-IN" : "en-US";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

export function formatDate(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Field rows ready for display. Aadhaar numbers are masked unless `reveal` is set. */
export function displayFields(
  type: DocType,
  fields: Record<string, unknown>,
  opts: { reveal?: boolean } = {},
): { label: string; value: string }[] {
  if (type === "unknown") return [];
  return FIELD_DEFS[type].map((def) => {
    const v = fields[def.key];
    let value: string;
    if (def.kind === "money") value = formatMoney(v, fields.currency);
    else if (def.kind === "date") value = formatDate(v);
    else if (def.kind === "number") value = typeof v === "number" ? v.toLocaleString("en-IN") : "—";
    else if (def.kind === "masked") value = typeof v === "string" && v ? (opts.reveal ? v : maskAccount(v)) : "—";
    else if (def.kind === "idType") value = typeof v === "string" ? (ID_TYPE_LABEL[v] ?? v) : "—";
    else if (def.key === "idNumber" && !opts.reveal) value = maskIdNumber(fields.idType as string, v as string) ?? "—";
    else value = v === null || v === undefined || v === "" ? "—" : String(v);
    return { label: def.label, value };
  });
}

/** Show only the last 4 digits of an account number. */
export function maskAccount(n: string): string {
  const clean = n.replace(/\s/g, "");
  return clean.length <= 4 ? clean : `${"X".repeat(Math.min(clean.length - 4, 8))}${clean.slice(-4)}`;
}

export function transactionsOf(type: DocType, fields: Record<string, unknown>): BankTransaction[] {
  return type === "bank_statement" && Array.isArray(fields.transactions) ? (fields.transactions as BankTransaction[]) : [];
}

export function itemsOf(type: DocType, fields: Record<string, unknown>): LineItem[] {
  const arr = type === "invoice" ? fields.lineItems : type === "receipt" ? fields.items : undefined;
  return Array.isArray(arr) ? (arr as LineItem[]) : [];
}

/** The headline amount and title for list rows and summaries. */
export function headline(type: DocType, fields: Record<string, unknown>): { title: string | null; amount: number | null } {
  switch (type) {
    case "invoice":
      return { title: (fields.vendorName as string) ?? null, amount: (fields.total as number) ?? null };
    case "receipt":
      return { title: (fields.merchantName as string) ?? null, amount: (fields.total as number) ?? null };
    case "id_card":
      return { title: (fields.fullName as string) ?? null, amount: null };
    case "electricity_bill":
      return { title: (fields.consumerName as string) ?? null, amount: (fields.amountPayable as number) ?? null };
    case "gst_certificate":
      return { title: (fields.legalName as string) ?? (fields.gstin as string) ?? null, amount: null };
    case "bank_statement":
      return { title: (fields.accountHolder as string) ?? (fields.bankName as string) ?? null, amount: (fields.closingBalance as number) ?? null };
    default:
      return { title: null, amount: null };
  }
}

/** Customer-entered details collected at upload for each category, cross-checked by validation. */
export const DECLARED_FIELDS: Partial<Record<DocType, { key: string; label: string; placeholder: string }[]>> = {
  electricity_bill: [
    { key: "consumerName", label: "Consumer name", placeholder: "ABC Industries" },
    { key: "consumerNumber", label: "Consumer number", placeholder: "123456789" },
  ],
  gst_certificate: [
    { key: "legalName", label: "Legal business name", placeholder: "ABC Industries Pvt Ltd" },
    { key: "gstin", label: "GSTIN", placeholder: "27AABCA1234F1Z5" },
    { key: "pan", label: "Business PAN", placeholder: "AABCA1234F" },
  ],
  bank_statement: [
    { key: "accountHolder", label: "Account holder", placeholder: "ABC Industries" },
    { key: "accountNumber", label: "Account number", placeholder: "Last 4 digits are enough" },
  ],
  id_card: [
    { key: "fullName", label: "Full name", placeholder: "As on the document" },
    { key: "idNumber", label: "Document number", placeholder: "PAN / Aadhaar / passport no." },
    { key: "dateOfBirth", label: "Date of birth (yyyy-mm-dd)", placeholder: "1990-04-21" },
  ],
};

export const UPLOAD_TYPES: { value: DocType | "auto"; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "electricity_bill", label: "Electricity bill" },
  { value: "gst_certificate", label: "GST certificate" },
  { value: "bank_statement", label: "Bank statement" },
  { value: "id_card", label: "KYC document" },
];
