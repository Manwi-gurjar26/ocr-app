import { describe, expect, it } from "vitest";
import { classify } from "@/lib/extract/classify";
import { amountsIn, detectCurrency, normalizeDate, parseAmount } from "@/lib/extract/parse";
import { extractIdCard, maskIdNumber } from "@/lib/extract/rules/id-card";
import { extractInvoice } from "@/lib/extract/rules/invoice";
import { extractReceipt } from "@/lib/extract/rules/receipt";
import { SAMPLE_INVOICE } from "./helpers/fixtures";

const INVOICE = SAMPLE_INVOICE.join("\n");

const RECEIPT = `BIG BAZAAR
Phoenix Mall, Pune
Date: 02-04-2024  Time: 18:42
Cashier: 07
Amul Milk 1L        66.00
Britannia Bread     45.00
Tata Salt 1kg       28.00
Sub Total          139.00
GST                  7.00
TOTAL              146.00
Paid by UPI
Thank you, visit again!`;

const AADHAAR = `GOVERNMENT OF INDIA
Priya Sharma
DOB: 12/08/1995
FEMALE
4821 7365 9012
Aadhaar - Aam Aadmi ka Adhikar`;

const PAN = `INCOME TAX DEPARTMENT GOVT. OF INDIA
Permanent Account Number Card
ABCDE1234F
RAMESH KUMAR
SURESH KUMAR
Date of Birth
05/11/1988`;

const PASSPORT = `REPUBLIC OF INDIA
Passport No. M1234567
Surname
GUPTA
Given Names
ANITA
Date of Birth 21/07/1990
Female
Date of Expiry 20/07/2030`;

describe("parse helpers", () => {
  it("parses Indian and western amounts", () => {
    expect(parseAmount("Rs 1,20,060.50")).toBe(120060.5);
    expect(parseAmount("₹20,060.00")).toBe(20060);
    expect(parseAmount("$1,234.5")).toBe(1234.5);
    expect(amountsIn("CGST 9%: 1,530.00")).toEqual([1530]);
  });

  it("normalises dates day-first", () => {
    expect(normalizeDate("15/03/2024")).toBe("2024-03-15");
    expect(normalizeDate("02-04-24")).toBe("2024-04-02");
    expect(normalizeDate("03/25/2024")).toBe("2024-03-25"); // impossible day-first → month-first
    expect(normalizeDate("15 Mar 2024")).toBe("2024-03-15");
    expect(normalizeDate("5th Sept 2023")).toBe("2023-09-05");
    expect(normalizeDate("March 15, 2024")).toBe("2024-03-15");
    expect(normalizeDate("2024-03-15")).toBe("2024-03-15");
    expect(normalizeDate("31/02/2024")).toBeNull();
  });
});

describe("classify", () => {
  it.each([
    [INVOICE, "invoice"],
    [RECEIPT, "receipt"],
    [AADHAAR, "id_card"],
    [PAN, "id_card"],
    [PASSPORT, "id_card"],
    ["hello world, nothing to see", "unknown"],
  ])("classifies sample %#", (text, type) => {
    expect(classify(text).type).toBe(type);
  });
});

describe("invoice rules", () => {
  it("extracts header, totals and line items", () => {
    const f = extractInvoice(INVOICE);
    expect(f).toMatchObject({
      invoiceNumber: "INV-2024-0457",
      invoiceDate: "2024-03-15",
      vendorName: "Sharma Electronics Pvt Ltd",
      vendorGstin: "27AABCS1234F1Z5",
      customerName: "Rahul Verma",
      subtotal: 17000,
      tax: 3060,
      total: 20060,
      currency: "INR",
    });
    expect(f.lineItems).toEqual([{ description: "LED Monitor", quantity: 2, unitPrice: 8500, amount: 17000 }]);
  });
});

describe("receipt rules", () => {
  it("extracts merchant, date/time, payment, totals and items", () => {
    const f = extractReceipt(RECEIPT);
    expect(f).toMatchObject({
      merchantName: "BIG BAZAAR",
      date: "2024-04-02",
      time: "18:42",
      paymentMethod: "UPI",
      subtotal: 139,
      tax: 7,
      total: 146,
      currency: "INR",
    });
    expect(f.items?.map((i) => i.description)).toEqual(["Amul Milk 1L", "Britannia Bread", "Tata Salt 1kg"]);
  });
});

describe("currency detection", () => {
  it("recognises Indian signals beyond the rupee sign", () => {
    expect(detectCurrency("GST 7.00\nTOTAL 146.00")).toBe("INR");
    expect(detectCurrency("Paid by UPI")).toBe("INR");
    expect(detectCurrency("Paid via PhonePe")).toBe("INR");
    expect(detectCurrency("Rupees one hundred only")).toBe("INR");
    expect(detectCurrency("Total $12.50")).toBe("USD");
    expect(detectCurrency("hello world")).toBeNull();
  });

  it("defaults receipts and invoices with amounts but no currency clue to INR", () => {
    expect(extractReceipt("CORNER SHOP\nBread  40.00\nTOTAL  40.00").currency).toBe("INR");
    expect(extractReceipt("STORE\nTotal $12.50").currency).toBe("USD");
    expect(extractInvoice("ACME LTD\nInvoice No: A-1\nTotal: 500.00").currency).toBe("INR");
  });
});

describe("id card rules", () => {
  it("extracts Aadhaar", () => {
    expect(extractIdCard(AADHAAR)).toMatchObject({
      idType: "aadhaar",
      idNumber: "4821 7365 9012",
      fullName: "Priya Sharma",
      dateOfBirth: "1995-08-12",
      gender: "Female",
    });
    expect(maskIdNumber("aadhaar", "4821 7365 9012")).toBe("XXXX XXXX 9012");
  });

  it("extracts PAN with father's name", () => {
    expect(extractIdCard(PAN)).toMatchObject({
      idType: "pan",
      idNumber: "ABCDE1234F",
      fullName: "RAMESH KUMAR",
      fatherName: "SURESH KUMAR",
      dateOfBirth: "1988-11-05",
    });
  });

  it("extracts passport", () => {
    expect(extractIdCard(PASSPORT)).toMatchObject({
      idType: "passport",
      idNumber: "M1234567",
      fullName: "ANITA GUPTA",
      dateOfBirth: "1990-07-21",
      expiryDate: "2030-07-20",
      gender: "Female",
    });
  });
});
