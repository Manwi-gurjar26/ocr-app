export const DOC_TYPES = ["invoice", "receipt", "id_card", "unknown"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_STATUSES = ["processing", "done", "failed"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export type ExtractionMethod = "ai" | "rules";

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

export type DocumentFields = InvoiceFields | ReceiptFields | IdCardFields | Record<string, unknown>;
