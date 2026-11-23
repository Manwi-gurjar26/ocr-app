import type { BankStatementFields, BankTransaction } from "../../types";
import { amountAfter, DATE_RE, headerName, labeled, lines, normalizeDate, parseAmount } from "../parse";

const BANK_RE =
  /\b(State\s+Bank\s+of\s+India|HDFC\s+Bank|ICICI\s+Bank|Axis\s+Bank|Kotak\s+Mahindra\s+Bank|Punjab\s+National\s+Bank|Bank\s+of\s+Baroda|Canara\s+Bank|Union\s+Bank\s+of\s+India|IndusInd\s+Bank|Yes\s+Bank|IDFC\s+FIRST\s+Bank|Bank\s+of\s+India|Indian\s+Bank|Central\s+Bank\s+of\s+India|Federal\s+Bank|[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?\s+Bank)\b/;

const TXN_DATE = new RegExp(`^(${DATE_RE.source})\\s+(.+)$`);
const MONEY_RE = /(\d{1,3}(?:,\d{2,3})+\.\d{2}|\d+\.\d{2})(?:\s*(?:cr|dr))?/gi;

/**
 * Basic transaction lines: "<date> <description> <amount> <balance>".
 * Whether the amount is a debit or credit is inferred from the balance movement.
 * Full analysis (categorisation, bounce detection, credit scoring) belongs to Perfios BSA.
 */
export function transactions(text: string, opening: number | null): BankTransaction[] {
  const out: BankTransaction[] = [];
  let prev = opening;
  for (const l of lines(text)) {
    const m = l.match(TXN_DATE);
    if (!m) continue;
    const rest = m[m.length - 1];
    // Money columns always carry paise ("1,250.00"); bare integers are cheque/ref numbers.
    const money = [...rest.matchAll(MONEY_RE)];
    if (money.length < 2) continue;
    const nums = money.map((x) => parseAmount(x[1])!);
    const balance = nums[nums.length - 1];
    const amount = nums[nums.length - 2];
    const description = rest.slice(0, money[0].index).trim() || rest;
    let debit: number | null = null;
    let credit: number | null = null;
    if (/\b(cr|credit|deposit|neft\s*cr|by\s)/i.test(rest) && !/\bdr\b/i.test(rest)) credit = amount;
    else if (/\b(dr|debit|withdrawal|to\s)/i.test(rest)) debit = amount;
    else if (prev !== null && Math.abs(prev + amount - balance) < 0.01) credit = amount;
    else debit = amount;
    out.push({ date: normalizeDate(m[1]), description, debit, credit, balance });
    prev = balance;
  }
  return out;
}

export function extractBankStatement(text: string): BankStatementFields {
  const opening = amountAfter(text, [/\bopening\s*balance\b/i, /\bbalance\s*b\/?f\b|brought\s*forward/i]);
  const closing = amountAfter(text, [/\bclosing\s*balance\b/i, /\bbalance\s*c\/?f\b|carried\s*forward/i]);
  const txns = transactions(text, opening);
  const sum = (k: "debit" | "credit") => {
    const vals = txns.map((t) => t[k]).filter((v): v is number => typeof v === "number");
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100 : null;
  };
  const period = labeled(text, /\b(statement\s*(period|from)|period|for\s*the\s*period)\b/i, /(\S.+)/);
  const dates = period ? [...period.matchAll(new RegExp(DATE_RE.source, "g"))].map((m) => normalizeDate(m[1])) : [];

  return {
    bankName: text.match(BANK_RE)?.[1] ?? headerName(text),
    accountHolder:
      labeled(text, /\b(account\s*holder(\s*name)?|customer\s*name|a\/c\s*name|name)\b/i, /([A-Za-z][A-Za-z .&'()-]{2,80})/)?.trim() ?? null,
    accountNumber: labeled(text, /\b(account\s*(no\.?|number)|a\/c\s*(no\.?|number))\b/i, /([X*\d][X*\d\s-]{5,24}\d)/i)?.replace(/\s|-/g, "") ?? null,
    ifsc: text.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/)?.[1] ?? null,
    periodFrom: dates[0] ?? null,
    periodTo: dates[1] ?? null,
    openingBalance: opening,
    closingBalance: closing ?? txns.at(-1)?.balance ?? null,
    totalCredits: amountAfter(text, [/\btotal\s*credits?\b/i]) ?? sum("credit"),
    totalDebits: amountAfter(text, [/\btotal\s*debits?\b/i]) ?? sum("debit"),
    currency: "INR",
    transactions: txns,
  };
}
