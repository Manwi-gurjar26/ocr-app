import { describe, expect, it } from "vitest";
import { extractBankStatement } from "@/lib/extract/rules/bank-statement";
import { extractElectricityBill } from "@/lib/extract/rules/electricity-bill";
import { extractGstCertificate } from "@/lib/extract/rules/gst-certificate";
import { extractIdCard } from "@/lib/extract/rules/id-card";
import type { ValidationResult } from "@/lib/types";
import { nameSimilarity, validateDocument, verhoeffValid } from "@/lib/validation";
import { AADHAAR_CARD, BANK_STATEMENT, ELECTRICITY_BILL, GST_CERTIFICATE } from "./helpers/kwx-fixtures";

const NOW = new Date("2026-11-23T10:00:00Z");
const bill = extractElectricityBill(ELECTRICITY_BILL.join("\n")) as Record<string, unknown>;
const gst = extractGstCertificate(GST_CERTIFICATE.join("\n")) as Record<string, unknown>;
const bank = extractBankStatement(BANK_STATEMENT.join("\n")) as Record<string, unknown>;
const aadhaar = extractIdCard(AADHAAR_CARD.join("\n")) as Record<string, unknown>;

const status = (r: ValidationResult, id: string) => r.checks.find((c) => c.id === id)?.status;

describe("electricity bill rules", () => {
  it("verifies a complete, recent bill matching the customer's details", () => {
    const r = validateDocument(
      { docType: "electricity_bill", declaredType: "electricity_bill", fields: bill, confidence: 92, declared: { consumerNumber: "123-456-789", consumerName: "M/s ABC Industries Pvt Ltd" } },
      { now: NOW },
    );
    expect(r.reasons).toEqual([]);
    expect(r.outcome).toBe("verified");
    expect(status(r, "recency")).toBe("pass");
    expect(status(r, "match.consumerNumber")).toBe("pass");
    expect(status(r, "match.consumerName")).toBe("pass");
  });

  it("sends a bill older than 60 days to manual review (blueprint Legal-stage rule)", () => {
    const r = validateDocument({ docType: "electricity_bill", fields: { ...bill, billDate: "2026-09-01" }, confidence: 95 }, { now: NOW });
    expect(r.outcome).toBe("manual_review");
    expect(r.reasons.join()).toMatch(/83 days old/);
  });

  it("falls back to the billing period when there is no bill date", () => {
    const r = validateDocument({ docType: "electricity_bill", fields: { ...bill, billDate: null, billingPeriod: "June 2026" } }, { now: NOW });
    expect(status(r, "recency")).toBe("fail");
    const ok = validateDocument({ docType: "electricity_bill", fields: { ...bill, billDate: null, billingPeriod: "October 2026" } }, { now: NOW });
    expect(status(ok, "recency")).toBe("pass");
  });

  it("flags missing consumer number, negative amount and zero units", () => {
    const r = validateDocument({ docType: "electricity_bill", fields: { ...bill, consumerNumber: null, amountPayable: -5, unitsConsumed: 0 } }, { now: NOW });
    expect(status(r, "required.consumerNumber")).toBe("fail");
    expect(status(r, "amount")).toBe("fail");
    expect(status(r, "units")).toBe("fail");
    expect(r.outcome).toBe("manual_review");
  });

  it("flags a consumer number that doesn't match what the customer entered", () => {
    const r = validateDocument({ docType: "electricity_bill", fields: bill, declared: { consumerNumber: "999999999" } }, { now: NOW });
    expect(status(r, "match.consumerNumber")).toBe("fail");
  });
});

describe("document type and confidence", () => {
  it("fails when the content contradicts the selected type", () => {
    const r = validateDocument({ docType: "gst_certificate", declaredType: "electricity_bill", fields: gst }, { now: NOW });
    expect(status(r, "doctype")).toBe("fail");
    expect(r.reasons[0]).toMatch(/Uploaded as electricity bill but looks like gst certificate/);
  });

  it("warns (not fails) when the type cannot be confirmed but the uploader chose one", () => {
    const r = validateDocument({ docType: "electricity_bill", detectedType: "unknown", declaredType: "electricity_bill", fields: bill, confidence: 90 }, { now: NOW });
    expect(status(r, "doctype")).toBe("warn");
    expect(r.outcome).toBe("verified");
  });

  it("routes low OCR confidence to manual review", () => {
    expect(status(validateDocument({ docType: "electricity_bill", fields: bill, confidence: 41 }, { now: NOW }), "confidence")).toBe("fail");
    expect(status(validateDocument({ docType: "electricity_bill", fields: bill, confidence: 70 }, { now: NOW }), "confidence")).toBe("warn");
  });

  it("turns provider tamper signals into checks", () => {
    const r = validateDocument(
      { docType: "id_card", fields: aadhaar, tamper: [{ code: "font_mismatch", message: "Font inconsistency in name field", severity: "high" }] },
      { now: NOW },
    );
    expect(status(r, "tamper.font_mismatch")).toBe("fail");
  });
});

describe("GST certificate rules", () => {
  it("verifies a well-formed GSTIN whose embedded PAN matches", () => {
    const r = validateDocument({ docType: "gst_certificate", fields: gst, declared: { pan: "AABCA1234F", legalName: "ABC Industries Pvt. Ltd." } }, { now: NOW });
    expect(r.reasons).toEqual([]);
    expect(status(r, "gstin.format")).toBe("pass");
    expect(status(r, "match.pan")).toBe("pass");
  });

  it("catches an OCR-misread GSTIN and a PAN mismatch", () => {
    const r = validateDocument({ docType: "gst_certificate", fields: { ...gst, gstin: "27AABCA1234F1Z8" }, declared: { pan: "AAACB9999K" } }, { now: NOW });
    expect(status(r, "gstin.format")).toBe("fail");
    expect(status(r, "match.pan")).toBe("fail");
  });
});

describe("bank statement rules", () => {
  it("reconciles balances and notes that credit analysis belongs to Perfios", () => {
    const r = validateDocument({ docType: "bank_statement", fields: bank, declared: { accountNumber: "5678" } }, { now: NOW });
    expect(status(r, "balance")).toBe("pass");
    expect(status(r, "perfios")).toBe("warn");
    expect(status(r, "match.accountNumber")).toBe("pass");
    expect(r.outcome).toBe("verified");
  });

  it("fails reconciliation when figures don't add up", () => {
    const r = validateDocument({ docType: "bank_statement", fields: { ...bank, closingBalance: 210000 } }, { now: NOW });
    expect(status(r, "balance")).toBe("fail");
  });
});

describe("KYC rules", () => {
  it("passes a valid Aadhaar and catches a misread digit", () => {
    expect(verhoeffValid("482173659012")).toBe(true);
    expect(verhoeffValid("482173659013")).toBe(false);
    const ok = validateDocument({ docType: "id_card", fields: aadhaar, declared: { fullName: "PRIYA SHARMA" } }, { now: NOW });
    expect(status(ok, "id.format")).toBe("pass");
    expect(status(ok, "match.fullName")).toBe("pass");
    expect(status(ok, "kyc")).toBe("warn");
    const bad = validateDocument({ docType: "id_card", fields: { ...aadhaar, idNumber: "4821 7365 9013" } }, { now: NOW });
    expect(status(bad, "id.format")).toBe("fail");
  });

  it("checks PAN format and expiry", () => {
    const r = validateDocument(
      { docType: "id_card", fields: { idType: "passport", idNumber: "K1234567", fullName: "Ravi Kumar", expiryDate: "2025-01-01" } },
      { now: NOW },
    );
    expect(status(r, "id.format")).toBe("pass");
    expect(status(r, "expiry")).toBe("fail");
    const pan = validateDocument({ docType: "id_card", fields: { idType: "pan", idNumber: "ABCDE1234F", fullName: "Ravi Kumar" } }, { now: NOW });
    expect(status(pan, "id.format")).toBe("fail"); // 4th char must be a valid holder type
  });
});

describe("name matching", () => {
  it("ignores legal suffixes, honorifics and punctuation", () => {
    expect(nameSimilarity("M/s ABC Industries Pvt. Ltd.", "ABC INDUSTRIES PRIVATE LIMITED")).toBe(1);
    expect(nameSimilarity("Shri Ravi Kumar", "RAVI KUMAR")).toBe(1);
    expect(nameSimilarity("ABC Industries", "XYZ Traders")).toBe(0);
  });
});
