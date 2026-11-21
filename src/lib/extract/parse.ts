/** Shared parsing helpers for OCR'd text (Indian formats first: day-first dates, lakh grouping, ₹). */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

export const AMOUNT_RE = /(?:₹|rs\.?|inr|\$|€|£)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d+)/gi;

export function parseAmount(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.replace(/\s/g, "").match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** All money-looking numbers in a string, in order. Prefers values with decimals or grouping. */
export function amountsIn(s: string): number[] {
  const out: number[] = [];
  for (const m of s.matchAll(AMOUNT_RE)) {
    const raw = m[1];
    // Skip bare percentages like "9%" and tiny bare integers that are likely quantities.
    const after = s.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 1);
    if (after === "%") continue;
    const v = parseAmount(raw);
    if (v !== null) out.push(v);
  }
  return out;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += y > 50 ? 1900 : 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export const DATE_RE =
  /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}(?:st|nd|rd|th)?[\s-]+[A-Za-z]{3,9}\.?[\s,-]+\d{2,4}|[A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/;

/** Normalise many date formats to ISO yyyy-mm-dd. Numeric dates are read day-first. */
export function normalizeDate(s: string | undefined | null): string | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    // day-first, unless that is impossible and month-first works
    return a > 12 || b <= 12 ? iso(+m[3], b, a) : iso(+m[3], a, b);
  }
  m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?[\s,-]+(\d{2,4})$/);
  if (m && monthOf(m[2])) return iso(+m[3], monthOf(m[2])!, +m[1]);
  m = t.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  if (m && monthOf(m[1])) return iso(+m[3], monthOf(m[1])!, +m[2]);
  return null;
}

function monthOf(name: string): number | undefined {
  const k = name.toLowerCase();
  return MONTHS[k.slice(0, 4)] ?? MONTHS[k.slice(0, 3)];
}

export function firstDate(s: string): string | null {
  const m = s.match(DATE_RE);
  return m ? normalizeDate(m[1]) : null;
}

export function lines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

/**
 * Find the value following any of the labels, on the same line (after ":" / "-" / "#")
 * or on the next line if the label stands alone.
 */
export function labeled(text: string, labels: RegExp, value: RegExp = /(.+)/): string | null {
  const ls = lines(text);
  for (let i = 0; i < ls.length; i++) {
    const m = ls[i].match(labels);
    if (!m) continue;
    const rest = ls[i].slice((m.index ?? 0) + m[0].length).replace(/^\s*[:\-#.]*\s*/, "");
    const v = rest.match(value) ?? (rest === "" && ls[i + 1] ? ls[i + 1].match(value) : null);
    if (v) return (v[1] ?? v[0]).trim();
  }
  return null;
}

/** Last amount on the line where a label matches. Searches labels in priority order; within a label, the last line wins. */
export function amountAfter(text: string, labelsInPriority: RegExp[]): number | null {
  const ls = lines(text);
  for (const re of labelsInPriority) {
    for (let i = ls.length - 1; i >= 0; i--) {
      const m = ls[i].match(re);
      if (!m) continue;
      const nums = amountsIn(ls[i].slice((m.index ?? 0) + m[0].length));
      if (nums.length) return nums[nums.length - 1];
      const next = ls[i + 1] ? amountsIn(ls[i + 1]) : [];
      if (next.length) return next[next.length - 1];
    }
  }
  return null;
}

export function detectCurrency(text: string): string | null {
  if (/₹|\brs\.?\s*\d|\binr\b|gstin|cgst|sgst/i.test(text)) return "INR";
  if (/\$|\busd\b/i.test(text)) return "USD";
  if (/€|\beur\b/i.test(text)) return "EUR";
  if (/£|\bgbp\b/i.test(text)) return "GBP";
  return null;
}

export const LABEL_WORDS =
  /^(tax\s+)?(invoice|receipt|bill|cash\s*memo|estimate|quotation|original|duplicate|copy|gstin|phone|tel|mob|email|address|date|www\.|http)/i;

/** The business name: first prominent line in the header that isn't a label/number. */
export function headerName(text: string, skip: RegExp = LABEL_WORDS): string | null {
  for (const l of lines(text).slice(0, 6)) {
    if (skip.test(l)) continue;
    if (/^[\d\s,./:+-]+$/.test(l)) continue;
    if (l.length < 3) continue;
    return l.replace(/[|_*]+/g, "").trim();
  }
  return null;
}
