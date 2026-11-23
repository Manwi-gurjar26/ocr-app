import type { GstCertificateFields } from "../../types";
import { DATE_RE, labeled, normalizeDate } from "../parse";
import { GSTIN_RE } from "./invoice";

function dateAfter(text: string, label: RegExp): string | null {
  const v = labeled(text, label, DATE_RE);
  return v ? normalizeDate(v) : null;
}

/** Form GST REG-06 (Registration Certificate). */
export function extractGstCertificate(text: string): GstCertificateFields {
  const gstin =
    labeled(text, /\b(registration\s*number|gstin|gstin\s*\/\s*uin)\b/i, new RegExp(`(${GSTIN_RE.source.replace(/\\b/g, "")})`)) ??
    text.match(GSTIN_RE)?.[0] ??
    null;
  const clean = (s: string | null) => s?.replace(/^\d+\.\s*/, "").replace(/\s+/g, " ").trim() || null;
  return {
    gstin,
    legalName: clean(labeled(text, /\blegal\s*name(\s*of\s*(the\s*)?business)?\b/i, /([A-Za-z0-9][^\n]{1,100})/)),
    tradeName: clean(labeled(text, /\btrade\s*name(,?\s*if\s*any)?\b/i, /([A-Za-z0-9][^\n]{1,100})/)),
    address: clean(labeled(text, /\b(address\s*of\s*principal\s*place\s*of\s*business|principal\s*place\s*of\s*business|address)\b/i, /(.{5,250})/)),
    constitution: clean(labeled(text, /\bconstitution\s*of\s*business\b/i, /([A-Za-z][^\n]{1,60})/)),
    registrationType: clean(labeled(text, /\btype\s*of\s*registration\b/i, /([A-Za-z][^\n]{1,40})/)),
    dateOfLiability: dateAfter(text, /\bdate\s*of\s*liability\b/i),
    dateOfIssue: dateAfter(text, /\bdate\s*of\s*issue(\s*of\s*certificate)?\b/i),
  };
}

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
  const check = GSTIN_CHARS[(36 - (sum % 36)) % 36];
  return check === g[14];
}

/** The PAN embedded in a GSTIN (characters 3–12). */
export function panFromGstin(gstin: string): string {
  return gstin.slice(2, 12).toUpperCase();
}
