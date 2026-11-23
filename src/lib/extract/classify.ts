import type { DocType } from "../types";

type Signal = [RegExp, number];

const SIGNALS: Record<Exclude<DocType, "unknown">, Signal[]> = {
  electricity_bill: [
    [/electricity\s+bill|energy\s+bill|power\s+bill|bill\s+of\s+supply/i, 5],
    [/\bconsumer\s*(no|number|name|id)\b/i, 3],
    [/\bunits?\s*(consumed|billed)|\bkwh\b/i, 4],
    [/sanctioned\s*load|connected\s*load|contract\s*demand|meter\s*(no|number|reading)/i, 3],
    [/\b(MSEDCL|BESCOM|TANGEDCO|TSSPDCL|BSES|Tata\s+Power|Adani\s+Electricity|CESC|PSPCL|DHBVN|UHBVN|PGVCL|Torrent\s+Power|KSEB|WBSEDCL|UPPCL|TPDDL)\b/i, 4],
    [/\b(previous|present|current)\s+reading\b/i, 2],
    [/discom|distribution\s+company|electricity\s+board|vidyut|bijli/i, 2],
  ],
  gst_certificate: [
    [/form\s+gst\s+reg-?\s*06/i, 6],
    [/registration\s+certificate/i, 4],
    [/legal\s+name/i, 2],
    [/trade\s+name/i, 2],
    [/constitution\s+of\s+business/i, 3],
    [/date\s+of\s+liability/i, 3],
    [/principal\s+place\s+of\s+business/i, 2],
    [/goods\s+and\s+services\s+tax/i, 2],
  ],
  bank_statement: [
    [/(account|bank)\s+statement|statement\s+of\s+account/i, 6],
    [/\bopening\s+balance\b/i, 3],
    [/\bclosing\s+balance\b/i, 3],
    [/\bwithdrawals?\b.*\bdeposits?\b|\bdebit\b.*\bcredit\b.*\bbalance\b/i, 3],
    [/\bifsc\b/i, 2],
    [/\b(neft|rtgs|imps|chq|cheque)\b/i, 1],
    [/statement\s+period|for\s+the\s+period/i, 2],
  ],
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
  const scores = { electricity_bill: 0, gst_certificate: 0, bank_statement: 0, id_card: 0, invoice: 0, receipt: 0 };
  for (const [type, signals] of Object.entries(SIGNALS) as [keyof typeof scores, Signal[]][]) {
    for (const [re, w] of signals) if (re.test(text)) scores[type] += w;
  }
  const ranked = (Object.entries(scores) as [keyof typeof scores, number][]).sort((a, b) => b[1] - a[1]);
  const [bestType, best] = ranked[0];
  return { type: best >= 4 ? bestType : "unknown", scores };
}
