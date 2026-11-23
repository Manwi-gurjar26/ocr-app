import { panFromGstin } from "../extract/rules/gst-certificate";
import { gstinChecksumValid, verhoeffValid } from "../extract/repair";

export { verhoeffValid };
import type { CheckStatus, DeclaredDetails, DocType, ValidationCheck, ValidationResult } from "../types";

/** Blueprint: an electricity bill must be ≤ 60 days old before a commercial lead moves to Legal. */
export const BILL_MAX_AGE_DAYS = 60;
/** Below this OCR confidence a human must look at the document. */
export const MIN_CONFIDENCE = 60;
/** Below this we pass but flag it. */
export const WARN_CONFIDENCE = 75;

export interface ValidationInput {
  docType: DocType;
  declaredType?: DocType | null;
  /** What classification of the content said (may differ from docType when the uploader's choice was used). */
  detectedType?: DocType | null;
  fields: Record<string, unknown>;
  declared?: DeclaredDetails | null;
  confidence?: number | null;
  tamper?: { code: string; message: string; severity: "low" | "medium" | "high" }[];
}

type Fields = Record<string, unknown>;
const DAY = 86_400_000;

function check(id: string, label: string, status: CheckStatus, message: string): ValidationCheck {
  return { id, label, status, message };
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function required(f: Fields, key: string, label: string): ValidationCheck {
  return str(f[key]) || num(f[key]) !== null
    ? check(`required.${key}`, `${label} present`, "pass", `${label} found`)
    : check(`required.${key}`, `${label} present`, "fail", `${label} could not be read from the document`);
}

/* ---------------- matching helpers ---------------- */

const NAME_NOISE = /\b(M\/S|MS|MESSRS|PVT|PRIVATE|LTD|LIMITED|LLP|CO|COMPANY|AND|THE|INDIA|MR|MRS|MS|SHRI|SMT|KUMARI)\b/g;

export function normalizeName(s: string): string[] {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9/ ]/g, " ")
    .replace(NAME_NOISE, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Token overlap of two names after removing legal suffixes/honorifics. 1 = identical token sets. */
export function nameSimilarity(a: string, b: string): number {
  const A = new Set(normalizeName(a));
  const B = new Set(normalizeName(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}

const alnum = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

type MatchKind = "name" | "exact" | "last4";
function consistency(declared: DeclaredDetails, f: Fields, pairs: [string, string, string, MatchKind][]): ValidationCheck[] {
  const out: ValidationCheck[] = [];
  for (const [dKey, fKey, label, kind] of pairs) {
    const want = str(declared[dKey]);
    if (!want) continue;
    const got = str(f[fKey]);
    const id = `match.${fKey}`;
    const title = `${label} matches customer details`;
    if (!got) {
      out.push(check(id, title, "warn", `Customer entered "${want}" but the document value could not be read`));
      continue;
    }
    let ok: boolean;
    if (kind === "name") ok = nameSimilarity(want, got) >= 0.75;
    else if (kind === "last4") ok = alnum(want).slice(-4) === alnum(got).slice(-4);
    else ok = alnum(want) === alnum(got);
    out.push(
      ok
        ? check(id, title, "pass", `Matches "${want}"`)
        : check(id, title, "fail", `Document says "${got}", customer entered "${want}"`),
    );
  }
  return out;
}

/* ---------------- checksums ---------------- */

/* ---------------- dates ---------------- */

function parseIso(s: unknown): Date | null {
  const v = str(s);
  if (!v) return null;
  const m = v.match(/(\d{4}-\d{2}-\d{2})(?!.*\d{4}-\d{2}-\d{2})/); // last ISO date in the string (period end)
  if (!m) return null;
  const d = new Date(`${m[1]}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** "October 2026" → last day of that month. */
function parseMonthYear(s: unknown): Date | null {
  const v = str(s);
  const m = v?.match(/([A-Za-z]{3,9})\s+(\d{4})/);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
  return mi < 0 ? null : new Date(Date.UTC(+m[2], mi + 1, 0));
}

/* ---------------- per-document rules ---------------- */

function electricityBill(f: Fields, d: DeclaredDetails, now: Date): ValidationCheck[] {
  const out = [required(f, "consumerNumber", "Consumer number"), required(f, "consumerName", "Consumer name")];

  const units = num(f.unitsConsumed);
  out.push(
    units === null
      ? check("units", "Units consumed valid", "warn", "Units consumed (kWh) not found")
      : units > 0
        ? check("units", "Units consumed valid", "pass", `${units.toLocaleString("en-IN")} kWh`)
        : check("units", "Units consumed valid", "fail", `Units consumed must be positive (got ${units})`),
  );

  const amt = num(f.amountPayable);
  out.push(
    amt === null
      ? check("amount", "Amount payable valid", "fail", "Amount payable could not be read")
      : amt >= 0
        ? check("amount", "Amount payable valid", "pass", `₹${amt.toLocaleString("en-IN")}`)
        : check("amount", "Amount payable valid", "fail", `Amount cannot be negative (got ${amt})`),
  );

  // Recency: prefer the bill date, then the end of the billing period, then the due date.
  const ref = parseIso(f.billDate) ?? parseIso(f.billingPeriod) ?? parseMonthYear(f.billingPeriod) ?? parseIso(f.dueDate);
  if (!ref) {
    out.push(check("recency", `Bill within ${BILL_MAX_AGE_DAYS} days`, "fail", "No bill date or billing period found to confirm recency"));
  } else {
    const age = Math.floor((now.getTime() - ref.getTime()) / DAY);
    out.push(
      age > BILL_MAX_AGE_DAYS
        ? check("recency", `Bill within ${BILL_MAX_AGE_DAYS} days`, "fail", `Bill is ${age} days old — a bill from the last ${BILL_MAX_AGE_DAYS} days is required`)
        : age < -45
          ? check("recency", `Bill within ${BILL_MAX_AGE_DAYS} days`, "fail", `Bill date is ${-age} days in the future`)
          : check("recency", `Bill within ${BILL_MAX_AGE_DAYS} days`, "pass", `Bill is ${Math.max(age, 0)} days old`),
    );
  }

  return out.concat(
    consistency(d, f, [
      ["consumerNumber", "consumerNumber", "Consumer number", "exact"],
      ["consumerName", "consumerName", "Consumer name", "name"],
      ["businessName", "consumerName", "Consumer name", "name"],
    ]),
  );
}

function gstCertificate(f: Fields, d: DeclaredDetails): ValidationCheck[] {
  const out = [required(f, "gstin", "GSTIN"), required(f, "legalName", "Legal name")];
  const gstin = str(f.gstin);
  if (gstin) {
    out.push(
      gstinChecksumValid(gstin)
        ? check("gstin.format", "GSTIN format & checksum", "pass", `${gstin} is well-formed (state code ${gstin.slice(0, 2)})`)
        : check("gstin.format", "GSTIN format & checksum", "fail", `${gstin} fails the GSTIN format/checksum — likely an OCR misread or invalid number`),
    );
    const pan = str(d.pan);
    if (pan)
      out.push(
        alnum(pan) === panFromGstin(gstin)
          ? check("match.pan", "PAN matches GSTIN", "pass", `PAN ${pan} is embedded in the GSTIN`)
          : check("match.pan", "PAN matches GSTIN", "fail", `GSTIN contains PAN ${panFromGstin(gstin)}, customer entered ${pan}`),
      );
  }
  return out.concat(
    consistency(d, f, [
      ["gstin", "gstin", "GSTIN", "exact"],
      ["legalName", "legalName", "Legal name", "name"],
      ["businessName", "legalName", "Legal name", "name"],
      ["tradeName", "tradeName", "Trade name", "name"],
    ]),
  );
}

function bankStatement(f: Fields, d: DeclaredDetails): ValidationCheck[] {
  const out = [required(f, "accountNumber", "Account number"), required(f, "accountHolder", "Account holder")];
  const [o, c, cr, dr] = [num(f.openingBalance), num(f.closingBalance), num(f.totalCredits), num(f.totalDebits)];
  if (o !== null && c !== null && cr !== null && dr !== null) {
    const expect = Math.round((o + cr - dr) * 100) / 100;
    out.push(
      Math.abs(expect - c) <= 1
        ? check("balance", "Balances reconcile", "pass", "Opening + credits − debits = closing balance")
        : check("balance", "Balances reconcile", "fail", `Opening + credits − debits = ${expect}, but closing balance reads ${c}`),
    );
  } else {
    out.push(check("balance", "Balances reconcile", "warn", "Not enough balance figures to reconcile"));
  }
  out.push(check("perfios", "Credit analysis", "warn", "Detailed bank statement analysis is done by Perfios BSA, not basic OCR"));
  return out.concat(
    consistency(d, f, [
      ["accountNumber", "accountNumber", "Account number", "last4"],
      ["accountHolder", "accountHolder", "Account holder", "name"],
      ["businessName", "accountHolder", "Account holder", "name"],
    ]),
  );
}

const ID_FORMATS: Record<string, [RegExp, string]> = {
  pan: [/^[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]$/, "PAN"],
  passport: [/^[A-Z][0-9]{7}$/, "passport number"],
  voter_id: [/^[A-Z]{3}\d{7}$/, "EPIC number"],
  driving_license: [/^[A-Z]{2}\d{13}$/, "DL number"],
};

function idCard(f: Fields, d: DeclaredDetails, now: Date): ValidationCheck[] {
  const out = [required(f, "idNumber", "ID number"), required(f, "fullName", "Name")];
  const n = str(f.idNumber);
  const type = str(f.idType);
  if (n && type === "aadhaar") {
    const digits = n.replace(/\s/g, "");
    out.push(
      /^[2-9]\d{11}$/.test(digits) && verhoeffValid(digits)
        ? check("id.format", "Aadhaar number checksum", "pass", "Aadhaar number passes the Verhoeff check")
        : check("id.format", "Aadhaar number checksum", "fail", "Aadhaar number fails the Verhoeff check — likely misread"),
    );
  } else if (n && type && ID_FORMATS[type]) {
    const [re, label] = ID_FORMATS[type];
    out.push(
      re.test(alnum(n))
        ? check("id.format", `${label} format`, "pass", `${n} is a valid ${label} format`)
        : check("id.format", `${label} format`, "fail", `${n} is not a valid ${label} format`),
    );
  }
  const exp = parseIso(f.expiryDate);
  if (exp)
    out.push(
      exp.getTime() >= now.getTime()
        ? check("expiry", "Document not expired", "pass", `Valid until ${f.expiryDate}`)
        : check("expiry", "Document not expired", "fail", `Expired on ${f.expiryDate}`),
    );
  out.push(check("kyc", "Identity verification", "warn", "OCR reads the card only; liveness/face-match and tamper checks are done by the KYC provider"));
  return out.concat(
    consistency(d, f, [
      ["fullName", "fullName", "Name", "name"],
      ["name", "fullName", "Name", "name"],
      ["idNumber", "idNumber", "ID number", "exact"],
      ["pan", "idNumber", "PAN", "exact"],
      ["dateOfBirth", "dateOfBirth", "Date of birth", "exact"],
    ]),
  );
}

function money(f: Fields, totalKey: string): ValidationCheck[] {
  return [required(f, totalKey, "Total amount")];
}

/* ---------------- entry point ---------------- */

export function validateDocument(input: ValidationInput, opts: { now?: Date } = {}): ValidationResult {
  const now = opts.now ?? new Date();
  const f = input.fields ?? {};
  const d = input.declared ?? {};
  const checks: ValidationCheck[] = [];

  // Document type: does the content look like what the customer said it is?
  const detected = input.detectedType ?? input.docType;
  if (input.declaredType && input.declaredType !== "unknown") {
    if (detected === input.declaredType) checks.push(check("doctype", "Document type", "pass", "Content matches the selected document type"));
    else if (detected === "unknown")
      checks.push(check("doctype", "Document type", "warn", "Could not confirm the document type from its content"));
    else
      checks.push(check("doctype", "Document type", "fail", `Uploaded as ${input.declaredType.replace(/_/g, " ")} but looks like ${detected.replace(/_/g, " ")}`));
  } else if (input.docType === "unknown") {
    checks.push(check("doctype", "Document type", "fail", "Document type could not be identified"));
  }

  const conf = num(input.confidence);
  if (conf !== null)
    checks.push(
      conf < MIN_CONFIDENCE
        ? check("confidence", "OCR confidence", "fail", `OCR confidence ${Math.round(conf)}% is below ${MIN_CONFIDENCE}% — image may be blurry`)
        : conf < WARN_CONFIDENCE
          ? check("confidence", "OCR confidence", "warn", `OCR confidence ${Math.round(conf)}% — double-check values`)
          : check("confidence", "OCR confidence", "pass", `OCR confidence ${Math.round(conf)}%`),
    );

  for (const t of input.tamper ?? [])
    checks.push(check(`tamper.${t.code}`, "Tamper check", t.severity === "low" ? "warn" : "fail", t.message));

  switch (input.docType) {
    case "electricity_bill":
      checks.push(...electricityBill(f, d, now));
      break;
    case "gst_certificate":
      checks.push(...gstCertificate(f, d));
      break;
    case "bank_statement":
      checks.push(...bankStatement(f, d));
      break;
    case "id_card":
      checks.push(...idCard(f, d, now));
      break;
    case "invoice":
      checks.push(...money(f, "total"));
      break;
    case "receipt":
      checks.push(...money(f, "total"));
      break;
  }

  const reasons = checks.filter((c) => c.status === "fail").map((c) => c.message);
  return { outcome: reasons.length ? "manual_review" : "verified", checks, reasons, validatedAt: now.toISOString() };
}
