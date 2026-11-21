import type { IdCardFields, IdType } from "../../types";
import { DATE_RE, labeled, lines, normalizeDate } from "../parse";

const PATTERNS = {
  aadhaar: /\b([2-9]\d{3}\s?\d{4}\s?\d{4})\b/,
  pan: /\b([A-Z]{5}\d{4}[A-Z])\b/,
  passport: /\b([A-Z][0-9]{7})\b/,
  driving_license: /\b([A-Z]{2}[-\s]?\d{2}[-\s]?(?:19|20)\d{2}\s?\d{7}|[A-Z]{2}\d{13})\b/,
  voter_id: /\b([A-Z]{3}\d{7})\b/,
};

export function detectIdType(text: string): IdType {
  if (/unique\s+identification|aadhaa?r|आधार/i.test(text) || PATTERNS.aadhaar.test(text)) {
    if (!/income\s+tax|permanent\s+account|passport|driving|election/i.test(text)) return "aadhaar";
  }
  if (/income\s+tax|permanent\s+account/i.test(text)) return "pan";
  if (/passport|P<IND|republic\s+of\s+india/i.test(text)) return "passport";
  if (/driving\s+licen[cs]e|\bDL\s*No/i.test(text)) return "driving_license";
  if (/election\s+commission|elector|EPIC/i.test(text)) return "voter_id";
  if (PATTERNS.pan.test(text)) return "pan";
  return "other";
}

const DOB_LABEL = /\b(dob|d\.o\.b|date\s+of\s+birth|birth\s+date|year\s+of\s+birth|जन्म\s*तिथि)\b/i;
const NOT_NAME =
  /government|govt|india|income|tax|department|unique|identification|authority|republic|passport|licen[cs]e|election|commission|card|dob|birth|male|female|address|signature|father|valid|issue|^\W*$/i;

function looksLikeName(l: string): boolean {
  return /^[A-Za-z][A-Za-z .']{2,50}$/.test(l) && !NOT_NAME.test(l) && l.split(/\s+/).length <= 5;
}

function dateNear(text: string, label: RegExp): string | null {
  const v = labeled(text, label, DATE_RE);
  if (v) return normalizeDate(v);
  const yob = labeled(text, /year\s+of\s+birth/i, /(\d{4})/);
  return yob ? `${yob}-01-01` : null;
}

function nameFor(text: string, idType: IdType): string | null {
  const explicit = labeled(text, /^(name|नाम\s*\/?\s*name)\b/i, /([A-Za-z][A-Za-z .']{2,50})/);
  if (explicit && looksLikeName(explicit)) return explicit.trim();

  if (idType === "passport") {
    const surname = labeled(text, /\bsurname\b/i, /([A-Z][A-Z ]{1,40})/);
    const given = labeled(text, /\bgiven\s+names?\b/i, /([A-Z][A-Z ]{1,40})/);
    if (surname || given) return [given, surname].filter(Boolean).join(" ").trim();
  }

  const ls = lines(text);
  // PAN: holder's name is the first name-like line; the father's name follows it.
  if (idType === "pan") return ls.find(looksLikeName) ?? null;
  // Aadhaar and others: name is usually the line right before the DOB line.
  const dobIdx = ls.findIndex((l) => DOB_LABEL.test(l));
  if (dobIdx > 0) {
    for (let i = dobIdx - 1; i >= Math.max(0, dobIdx - 3); i--) if (looksLikeName(ls[i])) return ls[i];
  }
  return ls.find(looksLikeName) ?? null;
}

export function extractIdCard(text: string): IdCardFields {
  const idType = detectIdType(text);
  const pattern = idType in PATTERNS ? PATTERNS[idType as keyof typeof PATTERNS] : undefined;
  let idNumber = pattern ? (text.match(pattern)?.[1] ?? null) : null;
  if (!idNumber) {
    for (const p of Object.values(PATTERNS)) {
      const m = text.match(p);
      if (m) {
        idNumber = m[1];
        break;
      }
    }
  }
  if (idNumber && idType === "aadhaar") idNumber = idNumber.replace(/\s/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");

  const fullName = nameFor(text, idType);
  const ls = lines(text);
  let fatherName = labeled(text, /father'?s?\s+name|\bs\/o\b|\bd\/o\b|\bw\/o\b/i, /([A-Za-z][A-Za-z .']{2,50})/);
  if (!fatherName && idType === "pan" && fullName) {
    // PAN cards print the father's name on the line after the holder's name.
    const i = ls.indexOf(fullName);
    if (i >= 0 && ls[i + 1] && looksLikeName(ls[i + 1])) fatherName = ls[i + 1];
  }

  const gender = text.match(/\b(male|female|transgender)\b/i)?.[1];
  const address = labeled(text, /\baddress\b/i, /(.{5,200})/);

  return {
    idType,
    idNumber,
    fullName,
    dateOfBirth: dateNear(text, DOB_LABEL),
    gender: gender ? gender[0].toUpperCase() + gender.slice(1).toLowerCase() : null,
    fatherName: fatherName?.trim() ?? null,
    address: address ?? null,
    expiryDate: dateNear(text, /date\s+of\s+expiry|valid\s+(till|upto|until)|expiry|expires/i),
  };
}

/** Mask Aadhaar to last 4 digits for display. */
export function maskIdNumber(idType: string | null | undefined, n: string | null | undefined): string | null {
  if (!n) return null;
  if (idType === "aadhaar") return `XXXX XXXX ${n.replace(/\s/g, "").slice(-4)}`;
  return n;
}
