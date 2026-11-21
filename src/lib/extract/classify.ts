import type { DocType } from "../types";

type Signal = [RegExp, number];

const SIGNALS: Record<Exclude<DocType, "unknown">, Signal[]> = {
  id_card: [
    [/\b[2-9]\d{3}\s\d{4}\s\d{4}\b/, 4], // Aadhaar number
    [/\b[A-Z]{5}\d{4}[A-Z]\b/, 3], // PAN
    [/unique\s+identification|aadhaa?r|आधार/i, 4],
    [/income\s+tax\s+department|permanent\s+account\s+number/i, 4],
    [/government\s+of\s+india|govt\.?\s+of\s+india|भारत\s+सरकार/i, 2],
    [/republic\s+of\s+india|passport|P<IND/i, 4],
    [/driving\s+licen[cs]e|\bDL\s*No/i, 4],
    [/election\s+commission|elector|EPIC/i, 4],
    [/\b(dob|date\s+of\s+birth|year\s+of\s+birth)\b/i, 2],
    [/\b(male|female|transgender)\b/i, 1],
    [/father'?s?\s+name|s\/o|d\/o|w\/o/i, 1],
  ],
  invoice: [
    [/\btax\s+invoice\b/i, 5],
    [/\binvoice\b/i, 3],
    [/invoice\s*(no|number|#|date)/i, 3],
    [/\bbill(ed)?\s+to\b|\bship(ped)?\s+to\b|\bbuyer\b|\bconsignee\b/i, 2],
    [/\bdue\s+date\b|\bpayment\s+terms\b|\bP\.?O\.?\s*(no|number)\b/i, 2],
    [/\bhsn|\bsac\b/i, 2],
    [/\bgstin\b/i, 1],
    [/\b(cgst|sgst|igst)\b/i, 1],
    [/amount\s+in\s+words|authori[sz]ed\s+signatory/i, 2],
  ],
  receipt: [
    [/\breceipt\b/i, 4],
    [/thank\s+you|visit\s+again|have\s+a\s+nice\s+day/i, 3],
    [/\b(cashier|till|counter|table\s*no|server|pos)\b/i, 2],
    [/\b(change|cash\s+tendered|tendered|paid\s+by)\b/i, 2],
    [/\b(visa|mastercard|rupay|upi|gpay|phonepe|paytm|card\s+no|xxxx)\b/i, 2],
    [/\b\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?\b/i, 1],
    [/\bcash\s*memo\b/i, 3],
    [/\bitems?\s*:?\s*\d+|\bqty\b/i, 1],
  ],
};

export interface Classification {
  type: DocType;
  scores: Record<Exclude<DocType, "unknown">, number>;
}

export function classify(text: string): Classification {
  const scores = { id_card: 0, invoice: 0, receipt: 0 };
  for (const [type, signals] of Object.entries(SIGNALS) as [keyof typeof scores, Signal[]][]) {
    for (const [re, w] of signals) if (re.test(text)) scores[type] += w;
  }
  const ranked = (Object.entries(scores) as [keyof typeof scores, number][]).sort((a, b) => b[1] - a[1]);
  const [bestType, best] = ranked[0];
  return { type: best >= 4 ? bestType : "unknown", scores };
}
