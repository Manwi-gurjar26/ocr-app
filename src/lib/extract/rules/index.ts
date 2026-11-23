import type { DocType, DocumentFields } from "../../types";
import { extractBankStatement } from "./bank-statement";
import { extractElectricityBill } from "./electricity-bill";
import { extractGstCertificate } from "./gst-certificate";
import { extractIdCard } from "./id-card";
import { extractInvoice } from "./invoice";
import { extractReceipt } from "./receipt";

export function extractWithRules(type: DocType, text: string): DocumentFields {
  switch (type) {
    case "electricity_bill":
      return extractElectricityBill(text);
    case "gst_certificate":
      return extractGstCertificate(text);
    case "bank_statement":
      return extractBankStatement(text);
    case "invoice":
      return extractInvoice(text);
    case "receipt":
      return extractReceipt(text);
    case "id_card":
      return extractIdCard(text);
    default:
      return {};
  }
}
