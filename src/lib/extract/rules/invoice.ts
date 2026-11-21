import type { InvoiceFields, LineItem } from "../../types";
import { amountAfter, detectCurrency, firstDate, headerName, labeled, lines, normalizeDate, parseAmount } from "../parse";

export const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/;

export const TOTAL_LABELS = [
  /grand\s*total/i,
  /total\s*amount(\s*payable)?/i,
  /amount\s*(due|payable)/i,
  /net\s*(amount|payable|total)/i,
  /(?<!sub[\s-]?)\btotal\b/i,
];

const SUBTOTAL_LABELS = [/sub[\s-]?total/i, /taxable\s*(value|amount)/i];

function taxTotal(text: string): number | null {
  const direct = amountAfter(text, [/total\s*(tax|gst)/i]);
  if (direct !== null) return direct;
  let sum = 0;
  let found = false;
  for (const re of [/\bcgst\b/i, /\bsgst\b/i, /\bigst\b/i, /\butgst\b/i]) {
    const v = amountAfter(text, [re]);
    if (v !== null) {
      sum += v;
      found = true;
    }
  }
  if (found) return Math.round(sum * 100) / 100;
  return amountAfter(text, [/\b(gst|vat|tax)\b/i]);
}

const ITEM_RE = /^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:x|×|\*|@|nos?\.?|pcs?)?\s*(?:₹|rs\.?)?\s*([\d,]+\.\d{2})\s+(?:₹|rs\.?)?\s*([\d,]+\.\d{2})$/i;
const SKIP_ITEM = /total|subtotal|cgst|sgst|igst|tax|gst|discount|round|balance|amount|paid/i;

export function lineItems(text: string): LineItem[] {
  const items: LineItem[] = [];
  for (const l of lines(text)) {
    if (SKIP_ITEM.test(l)) continue;
    const m = l.match(ITEM_RE);
    if (!m) continue;
    const quantity = Number(m[2]);
    const unitPrice = parseAmount(m[3]);
    const amount = parseAmount(m[4]);
    // sanity: qty * price ≈ amount (allow discount/tax noise of 2%)
    if (unitPrice !== null && amount !== null && Math.abs(quantity * unitPrice - amount) > Math.max(1, amount * 0.02)) continue;
    items.push({ description: m[1].replace(/^\d+[.)]\s*/, "").trim(), quantity, unitPrice, amount });
  }
  return items;
}

export function extractInvoice(text: string): InvoiceFields {
  const invoiceNumber = labeled(
    text,
    /\b(invoice|inv|bill)\s*(no\.?|number|num|#)/i,
    /([A-Z0-9][A-Z0-9\-/]{1,30})/i,
  );
  const dateStr = labeled(text, /\b(invoice|bill)\s*date\b|\bdated?\b/i, /(\S.+)/);
  const dueStr = labeled(text, /\bdue\s*date\b/i, /(\S.+)/);
  const customer = labeled(text, /\b(bill(ed)?\s*to|buyer|customer(\s*name)?|consignee|sold\s*to)\b/i, /([A-Za-z][^\n:]{1,60})/);
  const gstin = text.match(GSTIN_RE)?.[0] ?? null;

  return {
    invoiceNumber,
    invoiceDate: (dateStr && (normalizeDate(dateStr) ?? firstDate(dateStr))) || firstDate(text),
    dueDate: dueStr ? (normalizeDate(dueStr) ?? firstDate(dueStr)) : null,
    vendorName: headerName(text),
    vendorGstin: gstin,
    customerName: customer,
    subtotal: amountAfter(text, SUBTOTAL_LABELS),
    tax: taxTotal(text),
    total: amountAfter(text, TOTAL_LABELS),
    currency: detectCurrency(text),
    lineItems: lineItems(text),
  };
}
