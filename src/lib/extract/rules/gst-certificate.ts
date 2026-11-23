import type { GstCertificateFields } from "../../types";
import { DATE_RE, labeled, normalizeDate } from "../parse";
import { findGstin } from "../repair";
import { GSTIN_RE } from "./invoice";

export { gstinChecksumValid } from "../repair";

function dateAfter(text: string, label: RegExp): string | null {
  const v = labeled(text, label, DATE_RE);
  return v ? normalizeDate(v) : null;
}

/** Form GST REG-06 (Registration Certificate). */
export function extractGstCertificate(text: string): GstCertificateFields {
  const gstin =
    findGstin(text) ??
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

/** The PAN embedded in a GSTIN (characters 3–12). */
export function panFromGstin(gstin: string): string {
  return gstin.slice(2, 12).toUpperCase();
}
