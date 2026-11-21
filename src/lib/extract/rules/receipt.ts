import type { LineItem, ReceiptFields } from "../../types";
import { amountAfter, firstDate, headerName, lines, moneyCurrency, parseAmount } from "../parse";
import { TOTAL_LABELS } from "./invoice";

const PAYMENT: [RegExp, string][] = [
  [/\bupi\b|gpay|google\s*pay|phonepe|paytm|bhim/i, "UPI"],
  [/\bvisa\b/i, "Card (Visa)"],
  [/master\s*card/i, "Card (Mastercard)"],
  [/\brupay\b/i, "Card (RuPay)"],
  [/\bamex|american\s+express/i, "Card (Amex)"],
  [/\b(credit|debit)\s*card|\bcard\b/i, "Card"],
  [/\bcash\b/i, "Cash"],
];

const SKIP = /total|subtotal|tax|gst|vat|change|cash|card|tender|balance|discount|round|paid|upi|thank|qty|item/i;
const ITEM = /^(.+?)\s+(?:\d+\s*(?:x|@)\s*)?(?:₹|rs\.?)?\s*([\d,]+\.\d{2})$/i;

export function receiptItems(text: string): LineItem[] {
  const items: LineItem[] = [];
  for (const l of lines(text)) {
    if (SKIP.test(l)) continue;
    const m = l.match(ITEM);
    if (!m || m[1].length < 2 || /^\d+$/.test(m[1])) continue;
    items.push({ description: m[1].trim(), amount: parseAmount(m[2]) });
  }
  return items;
}

export function extractReceipt(text: string): ReceiptFields {
  const time = text.match(/\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)\b/i)?.[1] ?? null;
  const subtotal = amountAfter(text, [/sub[\s-]?total/i]);
  const total = amountAfter(text, TOTAL_LABELS);
  const items = receiptItems(text);
  return {
    merchantName: headerName(text),
    date: firstDate(text),
    time: time ? time.trim().toUpperCase().replace(/\s+/g, " ") : null,
    paymentMethod: PAYMENT.find(([re]) => re.test(text))?.[1] ?? null,
    subtotal,
    tax: amountAfter(text, [/total\s*(tax|gst)/i, /\b(gst|vat|tax)\b/i]),
    total,
    currency: moneyCurrency(text, total != null || subtotal != null || items.length > 0),
    items,
  };
}
