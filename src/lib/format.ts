import { maskIdNumber } from "./extract/rules/id-card";
import type { DocType, LineItem } from "./types";

export const TYPE_LABEL: Record<DocType, string> = {
  invoice: "Invoice",
  receipt: "Receipt",
  id_card: "ID Card",
  unknown: "Unknown",
};

export const ID_TYPE_LABEL: Record<string, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN Card",
  passport: "Passport",
  driving_license: "Driving Licence",
  voter_id: "Voter ID",
  other: "Other ID",
};

type FieldKind = "text" | "money" | "date" | "idType";
export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
}

export const FIELD_DEFS: Record<Exclude<DocType, "unknown">, FieldDef[]> = {
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
    else if (def.kind === "idType") value = typeof v === "string" ? (ID_TYPE_LABEL[v] ?? v) : "—";
    else if (def.key === "idNumber" && !opts.reveal) value = maskIdNumber(fields.idType as string, v as string) ?? "—";
    else value = v === null || v === undefined || v === "" ? "—" : String(v);
    return { label: def.label, value };
  });
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
    default:
      return { title: null, amount: null };
  }
}
