// Generates demo documents in ./samples for trying the app and for API smoke tests.
import fs from "node:fs/promises";
import { scannedPdf, SAMPLE_INVOICE, textImage } from "../tests/helpers/fixtures.ts";

const RECEIPT = [
  "BIG BAZAAR", "Phoenix Mall, Pune", "Date: 02-04-2024  Time: 18:42", "Cashier: 07",
  "Amul Milk 1L        66.00", "Britannia Bread     45.00", "Tata Salt 1kg       28.00",
  "Sub Total          139.00", "GST                  7.00", "TOTAL              146.00", "Paid by UPI", "Thank you, visit again!",
];
const AADHAAR = ["GOVERNMENT OF INDIA", "Priya Sharma", "DOB: 12/08/1995", "FEMALE", "4821 7365 9012", "Aadhaar - Aam Aadmi ka Adhikar"];
const PAN = ["INCOME TAX DEPARTMENT GOVT. OF INDIA", "Permanent Account Number Card", "ABCDE1234F", "RAMESH KUMAR", "SURESH KUMAR", "Date of Birth", "05/11/1988"];

await fs.mkdir("samples", { recursive: true });
await fs.writeFile("samples/invoice.png", textImage(SAMPLE_INVOICE));
await fs.writeFile("samples/receipt.png", textImage(RECEIPT, { width: 900 }));
await fs.writeFile("samples/aadhaar.png", textImage(AADHAAR, { width: 1000 }));
await fs.writeFile("samples/pan.png", textImage(PAN, { width: 1100 }));
await fs.writeFile("samples/scanned-invoice.pdf", await scannedPdf(SAMPLE_INVOICE));
console.log("samples written");
