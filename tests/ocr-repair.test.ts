import { describe, expect, it } from "vitest";
import { lines, parseAmount } from "@/lib/extract/parse";
import { coerce, findGstin, findIfsc, gstinChecksumValid, repairDigits, repairPan } from "@/lib/extract/repair";
import { extractBankStatement } from "@/lib/extract/rules/bank-statement";
import { extractGstCertificate } from "@/lib/extract/rules/gst-certificate";
import { extractIdCard } from "@/lib/extract/rules/id-card";

/** Every case below is a misread actually produced by Tesseract in scripts/ocr-bench.mts. */
describe("GSTIN repair", () => {
  it.each([
    ["Z read as 2", "27AAPFU0939F12V", "27AAPFU0939F1ZV"],
    ["0 read as Q", "27AAPFUQ939F1ZV", "27AAPFU0939F1ZV"],
    ["Z read as 2 with a space inserted", "Registration Number: 27AABCA1234F 129", "27AABCA1234F1Z9"],
    ["exact", "GSTIN: 27AABCA1234F1Z9", "27AABCA1234F1Z9"],
  ])("%s", (_, text, want) => {
    expect(findGstin(text)).toBe(want);
  });

  it("prefers a checksum-valid repair, otherwise returns the closest well-formed reading", () => {
    // Fixture GSTIN with a wrong check digit: still surfaced (validation will flag it).
    expect(findGstin("GSTIN: 27AABCS1234F 125")).toBe("27AABCS1234F1Z5");
    expect(gstinChecksumValid("27AABCS1234F1Z5")).toBe(false);
  });

  it("does not invent GSTINs from ordinary words or bad state codes", () => {
    expect(findGstin("Registration Certificate\nConstitution of Business")).toBeNull();
    expect(findGstin("55AABCA1234F1Z9")).toBeNull(); // 55 is not a state code
  });

  it("is used by the GST certificate extractor", () => {
    expect(extractGstCertificate("Form GST REG-06\nRegistration Number\n27AAPFUQ939F12V .").gstin).toBe("27AAPFU0939F1ZV");
  });
});

describe("other identifier repair", () => {
  it("IFSC with a doubled zero-like glyph", () => {
    expect(findIfsc("IFSC Code : SBIN0O004567")).toBe("SBIN0004567");
    expect(findIfsc("IFSC: HDFC0001234")).toBe("HDFC0001234");
    expect(findIfsc("Statement of Account")).toBeNull();
  });

  it("PAN with digit/letter swaps, rejecting impossible holder types", () => {
    expect(repairPan("AABPK12S4C")).toBe("AABPK1254C");
    expect(repairPan("AABPKI234C")).toBe("AABPK1234C");
    expect(repairPan("ABCDE1234F")).toBeNull(); // 4th char D is not a valid holder type
  });

  it("account numbers and Aadhaar digits", () => {
    expect(repairDigits("3001 2345 678")).toBe("30012345678");
    expect(repairDigits("30O1234S678")).toBe("30012345678");
    expect(repairDigits("XXXX1234")).toBe("XXXX1234");
    expect(repairDigits("ABC")).toBeNull();
    expect(extractBankStatement("A/c No : 30O12345678").accountNumber).toBe("30012345678");
    // Verhoeff decides between look-alike readings.
    expect(extractIdCard("GOVERNMENT OF INDIA\nPriya Sharma\nDOB: 12/08/1995\n4821 7365 9O12\nAadhaar").idNumber).toBe("4821 7365 9012");
  });

  it("coerce respects position classes", () => {
    expect(coerce("2O", "DD")).toEqual({ value: "20", edits: 1 });
    expect(coerce("A1", "LL")).toEqual({ value: "AI", edits: 1 });
    expect(coerce("#1", "DD")).toBeNull();
  });
});

describe("parsing robustness", () => {
  it("reads amounts whose grouping comma OCR turned into a dot", () => {
    expect(parseAmount("1,52.000.00")).toBe(152000);
    expect(parseAmount("1,25,000.00")).toBe(125000);
    expect(parseAmount("17,000.00")).toBe(17000);
    expect(parseAmount("38,420.5")).toBe(38420.5);
    expect(parseAmount("Rs. 4,820")).toBe(4820);
  });

  it("strips trailing OCR speckle from lines", () => {
    expect(lines("Priya Sharma : - ; .\nKumar Solar Exports :\nTotal: 5")).toEqual(["Priya Sharma", "Kumar Solar Exports", "Total: 5"]);
  });
});
