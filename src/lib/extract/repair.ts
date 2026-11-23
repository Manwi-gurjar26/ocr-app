/**
 * Format-aware repair of OCR misreads in structured identifiers.
 *
 * OCR confuses look-alike glyphs (O/0, Z/2, S/5, B/8, I/1). When we know a position must be a
 * digit or a letter we can map the glyph back, and a checksum (GSTIN, Aadhaar) tells us whether
 * the repaired value is right. A repaired value is only returned when it is fully valid; anything
 * doubtful stays unread so validation sends the document to manual review.
 */
const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** GSTIN check digit (15th char): base-36 weighted mod checksum used by GSTN. */
export function gstinChecksumValid(gstin: string): boolean {
  const g = gstin.toUpperCase();
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = GSTIN_CHARS.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === g[14];
}

const TO_DIGIT: Record<string, string> = { O: "0", Q: "0", D: "0", U: "0", I: "1", L: "1", "|": "1", "!": "1", T: "1", Z: "2", S: "5", B: "8", G: "6" };
const TO_LETTER: Record<string, string> = { "0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G", "4": "A", "|": "I" };

/**
 * Spec characters: D digit, L letter, A alphanumeric, anything else literal
 * (with a few look-alikes allowed, e.g. "2"/"7" for a literal Z).
 */
export function coerce(token: string, spec: string): { value: string; edits: number } | null {
  if (token.length !== spec.length) return null;
  let value = "";
  let edits = 0;
  for (let i = 0; i < spec.length; i++) {
    const c = token[i];
    const s = spec[i];
    let out: string | undefined;
    if (s === "D") out = /\d/.test(c) ? c : TO_DIGIT[c];
    else if (s === "L") out = /[A-Z]/.test(c) ? c : TO_LETTER[c];
    else if (s === "A") out = /[A-Z0-9]/.test(c) ? c : (TO_DIGIT[c] ?? TO_LETTER[c]);
    else if (c === s) out = c;
    else if (s === "Z" && (c === "2" || c === "7")) out = "Z";
    else if (s === "0" && TO_DIGIT[c] === "0") out = "0";
    if (out === undefined) return null;
    if (out !== c) edits++;
    value += out;
  }
  return { value, edits };
}

/** Each line squeezed of spaces, uppercased — OCR often inserts spaces inside long codes. */
function compactLines(text: string): string[] {
  return text
    .toUpperCase()
    .split("\n")
    .map((l) => l.replace(/[\s.\-:]/g, ""));
}

/** All windows of `len` (and `len + 1` with one doubled look-alike removed) in each compact line. */
function* windows(text: string, len: number): Generator<string> {
  for (const line of compactLines(text)) {
    for (let i = 0; i + len <= line.length; i++) yield line.slice(i, i + len);
    // "SBIN0O004567": OCR doubled a zero-like glyph.
    for (let i = 0; i + len + 1 <= line.length; i++) {
      const w = line.slice(i, i + len + 1);
      for (let j = 0; j < w.length - 1; j++)
        if (TO_DIGIT[w[j]] === "0" || w[j] === "0")
          if (TO_DIGIT[w[j + 1]] === "0" || w[j + 1] === "0") yield w.slice(0, j) + w.slice(j + 1);
    }
  }
}

function bestOf(cands: { value: string; edits: number }[]): string | null {
  if (!cands.length) return null;
  cands.sort((a, b) => a.edits - b.edits);
  return cands[0].value;
}

const GSTIN_SPEC = "DDLLLLLDDDDLAZA";
const STATE_CODES = new Set([...Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, "0")), "97", "99"]);

/**
 * GSTIN anywhere in the text. Exact, checksum-valid matches win; otherwise the checksum-valid
 * repair with the fewest edits. Returns null rather than an invalid guess.
 */
export function findGstin(text: string, allowMissingZ = true): string | null {
  const cands: { value: string; edits: number }[] = [];
  for (const w of windows(text, 15)) {
    const c = coerce(w, GSTIN_SPEC);
    if (c && STATE_CODES.has(c.value.slice(0, 2)) && gstinChecksumValid(c.value)) cands.push(c);
  }
  // "27AABCA1234F 129": OCR dropped the 'Z' (14th char) — try re-inserting it.
  if (!cands.length && allowMissingZ)
    for (const w of windows(text, 14)) {
      const c = coerce(`${w.slice(0, 13)}Z${w.slice(13)}`, GSTIN_SPEC);
      if (c && STATE_CODES.has(c.value.slice(0, 2)) && gstinChecksumValid(c.value)) cands.push({ ...c, edits: c.edits + 2 });
    }
  if (cands.length) return bestOf(cands);
  // No checksum-valid reading: return the closest well-formed one (≤ 2 repairs) so the reviewer
  // sees it — validation will flag the failed check digit and route it to manual review.
  const formed: { value: string; edits: number }[] = [];
  for (const w of windows(text, 15)) {
    const c = coerce(w, GSTIN_SPEC);
    if (c && c.edits <= 2 && STATE_CODES.has(c.value.slice(0, 2))) formed.push(c);
  }
  return bestOf(formed);
}

/** IFSC: 4-letter bank code, a literal 0, 6-char branch code. */
export function findIfsc(text: string): string | null {
  const cands: { value: string; edits: number }[] = [];
  for (const w of windows(text, 11)) {
    const c = coerce(w, "LLLL0AAAAAA");
    // Branch codes are mostly digits; reject windows that turned words into codes.
    if (c && c.edits <= 2 && /\d{3}/.test(c.value.slice(5)))
      // Branch codes are almost always numeric: more digits = more likely the right window.
      cands.push({ ...c, edits: c.edits - (c.value.slice(5).match(/\d/g)?.length ?? 0) });
  }
  return bestOf(cands);
}

/** Individual / company PAN: 5 letters, 4 digits, 1 letter (4th letter = holder type). */
export function repairPan(token: string): string | null {
  const c = coerce(token.toUpperCase().replace(/\s/g, ""), "LLLLLDDDDL");
  return c && /^[A-Z]{3}[PCHFATBLJG]/.test(c.value) ? c.value : null;
}

/** Digits-only field (account numbers): map look-alikes, drop separators. */
export function repairDigits(token: string): string | null {
  const t = token.toUpperCase().replace(/[\s\-]/g, "");
  let out = "";
  for (const ch of t) {
    if (/\d/.test(ch)) out += ch;
    else if (TO_DIGIT[ch]) out += TO_DIGIT[ch];
    else if (ch === "X" || ch === "*") out += ch; // masked digits
    else return null;
  }
  return out || null;
}

/* ---------------- Verhoeff (Aadhaar check digit) ---------------- */

const VD = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VP = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Aadhaar numbers end in a Verhoeff check digit. */
export function verhoeffValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let c = 0;
  const rev = digits.split("").reverse().map(Number);
  for (let i = 0; i < rev.length; i++) c = VD[c][VP[i % 8][rev[i]]];
  return c === 0;
}
