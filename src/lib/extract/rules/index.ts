import type { DocType, DocumentFields } from "../../types";
import { extractIdCard } from "./id-card";
import { extractInvoice } from "./invoice";
import { extractReceipt } from "./receipt";

export function extractWithRules(type: DocType, text: string): DocumentFields {
  switch (type) {
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
