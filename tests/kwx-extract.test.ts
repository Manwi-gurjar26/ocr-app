import { describe, expect, it } from "vitest";
import { classify } from "@/lib/extract/classify";
import { extractBankStatement } from "@/lib/extract/rules/bank-statement";
import { extractElectricityBill } from "@/lib/extract/rules/electricity-bill";
import { extractGstCertificate, gstinChecksumValid, panFromGstin } from "@/lib/extract/rules/gst-certificate";
import { AADHAAR_CARD, BANK_STATEMENT, ELECTRICITY_BILL, GST_CERTIFICATE } from "./helpers/kwx-fixtures";

const j = (l: string[]) => l.join("\n");

describe("classification of KiloWattX documents", () => {
  it.each([
    [ELECTRICITY_BILL, "electricity_bill"],
    [GST_CERTIFICATE, "gst_certificate"],
    [BANK_STATEMENT, "bank_statement"],
    [AADHAAR_CARD, "id_card"],
  ])("classifies %#", (doc, type) => {
    expect(classify(j(doc)).type).toBe(type);
  });
});

describe("electricity bill extraction", () => {
  it("pulls the blueprint fields", () => {
    expect(extractElectricityBill(j(ELECTRICITY_BILL))).toEqual({
      discom: "MSEDCL",
      consumerName: "ABC Industries",
      consumerNumber: "123456789",
      address: "Plot 14, MIDC Bhosari, Pune 411026",
      billDate: "2026-11-05",
      billingPeriod: "October 2026",
      unitsConsumed: 12500,
      sanctionedLoad: "150 kW",
      amountPayable: 125000,
      dueDate: "2026-11-25",
      currency: "INR",
    });
  });

  it("normalises a date-range billing period", () => {
    const f = extractElectricityBill("Consumer No: 99887766\nBilling Period: 01/10/2026 to 31/10/2026\nUnits Consumed 420 kWh\nNet Amount Payable 3,410.50");
    expect(f).toMatchObject({ billingPeriod: "2026-10-01 to 2026-10-31", unitsConsumed: 420, amountPayable: 3410.5 });
  });
});

describe("GST certificate extraction", () => {
  it("reads REG-06 fields", () => {
    expect(extractGstCertificate(j(GST_CERTIFICATE))).toEqual({
      gstin: "27AABCA1234F1Z9",
      legalName: "ABC Industries Private Limited",
      tradeName: "ABC Solar Works",
      address: "Plot 14, MIDC Bhosari, Pune, Maharashtra 411026",
      constitution: "Private Limited Company",
      registrationType: "Regular",
      dateOfLiability: "2017-07-01",
      dateOfIssue: "2017-07-15",
    });
  });

  it("validates the GSTIN check digit and extracts the PAN", () => {
    expect(gstinChecksumValid("27AAPFU0939F1ZV")).toBe(true); // public sample GSTIN
    expect(gstinChecksumValid("27AABCA1234F1Z9")).toBe(true);
    expect(gstinChecksumValid("27AABCA1234F1Z8")).toBe(false); // one char off
    expect(gstinChecksumValid("27AABCA1234F1X9")).toBe(false); // 14th char must be Z
    expect(panFromGstin("27AABCA1234F1Z9")).toBe("AABCA1234F");
  });
});

describe("bank statement extraction", () => {
  it("reads header, balances and transactions with debit/credit inferred", () => {
    const f = extractBankStatement(j(BANK_STATEMENT));
    expect(f).toMatchObject({
      bankName: "HDFC Bank",
      accountHolder: "ABC Industries",
      accountNumber: "50200012345678",
      ifsc: "HDFC0001234",
      periodFrom: "2026-10-01",
      periodTo: "2026-10-31",
      openingBalance: 200000,
      closingBalance: 200000,
      totalCredits: 125000,
      totalDebits: 125000,
    });
    expect(f.transactions).toEqual([
      { date: "2026-10-02", description: "NEFT CR SUNRISE TEXTILES", debit: null, credit: 50000, balance: 250000 },
      { date: "2026-10-10", description: "MSEDCL BILL PAYMENT DR", debit: 125000, credit: null, balance: 125000 },
      { date: "2026-10-20", description: "RTGS CR KUMAR EXPORTS", debit: null, credit: 75000, balance: 200000 },
    ]);
  });
});
