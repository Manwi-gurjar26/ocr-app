import type { ElectricityBillFields } from "../../types";
import { amountAfter, DATE_RE, labeled, lines, normalizeDate, parseAmount } from "../parse";

const DISCOM_RE =
  /\b(MSEDCL|MSEB|BESCOM|TANGEDCO|TNEB|TSSPDCL|APSPDCL|APEPDCL|BSES\s+(?:Rajdhani|Yamuna)|Tata\s+Power|Adani\s+Electricity|CESC|PSPCL|UHBVN|DHBVN|JVVNL|AVVNL|JdVVNL|MPPKVVCL|MPMKVVCL|PGVCL|UGVCL|MGVCL|DGVCL|Torrent\s+Power|KSEB|WBSEDCL|CSPDCL|UPPCL|BESL|HESCOM|GESCOM|MESCOM|CHESCOM|TPDDL)\b/i;

function dateIn(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(DATE_RE);
  return m ? normalizeDate(m[1]) : null;
}

/** "Oct 2026", "October-2026", "10/2026", or "01-10-2026 to 31-10-2026". */
function billingPeriod(text: string): string | null {
  const raw = labeled(text, /\b(billing\s*(period|month|cycle)|bill\s*(month|period)|period\s*of\s*bill)\b/i, /(\S.{2,60})/);
  if (!raw) return null;
  const range = raw.match(new RegExp(`(${DATE_RE.source})\\s*(?:to|-|–)\\s*(${DATE_RE.source})`, "i"));
  if (range) {
    const a = normalizeDate(range[1]);
    const b = normalizeDate(range[3]);
    if (a && b) return `${a} to ${b}`;
  }
  const month = raw.match(/\b([A-Za-z]{3,9})[\s,\-']+(\d{2,4})\b/);
  if (month) return `${month[1][0].toUpperCase()}${month[1].slice(1).toLowerCase()} ${month[2].length === 2 ? `20${month[2]}` : month[2]}`;
  return raw.replace(/\s+/g, " ").trim();
}

function units(text: string): number | null {
  for (const re of [
    /\b(units?\s*consumed|total\s*units|net\s*units|consumption\s*\(?\s*kwh\s*\)?|energy\s*consumed|billed\s*units|units\s*billed)\b/i,
  ]) {
    const v = labeled(text, re, /([\d,]+(?:\.\d+)?)/);
    if (v) return parseAmount(v);
  }
  const kwh = text.match(/([\d,]+(?:\.\d+)?)\s*(?:kwh|units)\b/i);
  return kwh ? parseAmount(kwh[1]) : null;
}

export function extractElectricityBill(text: string): ElectricityBillFields {
  const consumerNumber = labeled(
    text,
    /\b(consumer\s*(no\.?|number|id|a\/c\s*no\.?)|ca\s*(no\.?|number)|service\s*(connection\s*)?(no\.?|number)|account\s*(no\.?|number)|k\s*no\.?|bp\s*no\.?)\b/i,
    /([A-Z0-9][A-Z0-9\-/]{4,24})/i,
  );
  const consumerName = labeled(text, /\b(consumer\s*name|name\s*of\s*(the\s*)?consumer|customer\s*name|^name)\b/i, /([A-Za-z][A-Za-z0-9 .&'()/-]{2,80})/);
  const address = labeled(text, /\b(supply\s*address|service\s*address|premises\s*address|address)\b/i, /(.{5,200})/);
  const amountPayable = amountAfter(text, [
    /\b(net\s*amount\s*payable|total\s*amount\s*payable|amount\s*payable|bill\s*amount|net\s*payable|total\s*due|amount\s*due|payable\s*amount)\b/i,
  ]);
  const load = labeled(text, /\b(sanctioned|connected|contract)\s*(load|demand)\b/i, /([\d.]+\s*(?:kw|kva|hp)\b)/i);
  const discom = text.match(DISCOM_RE)?.[1] ?? lines(text)[0] ?? null;

  return {
    discom: discom?.replace(/\s+/g, " ").trim() ?? null,
    consumerName: consumerName?.trim() ?? null,
    consumerNumber,
    address: address?.trim() ?? null,
    billDate: dateIn(labeled(text, /\b(bill\s*(issue\s*)?date|date\s*of\s*(bill|issue)|issue\s*date)\b/i, /(\S.+)/)),
    billingPeriod: billingPeriod(text),
    unitsConsumed: units(text),
    sanctionedLoad: load?.replace(/\s+/g, " ").toUpperCase().replace("KW", "kW") ?? null,
    amountPayable,
    dueDate: dateIn(labeled(text, /\b(due\s*date|pay\s*by|last\s*date(\s*of\s*payment)?)\b/i, /(\S.+)/)),
    currency: amountPayable != null ? "INR" : null,
  };
}
