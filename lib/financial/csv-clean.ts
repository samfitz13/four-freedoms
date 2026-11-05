import "server-only";
import type { StatementMeta } from "./types";

const DATE_PATTERNS: Array<(s: string) => string | null> = [
  // ISO YYYY-MM-DD
  (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null),
  // MM/DD/YYYY or M/D/YYYY
  (s) => {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const [, mo, d, y] = m;
    return `${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  },
  // YYYY/MM/DD
  (s) => {
    const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return null;
    const [, y, mo, d] = m;
    return `${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  },
];

/** Normalize a date-ish string to YYYY-MM-DD, or null if it doesn't look like a date. */
export function normalizeDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();
  for (const fn of DATE_PATTERNS) {
    const out = fn(s);
    if (out) return out;
  }
  return null;
}

/**
 * Parse a number string accepting bank-style formats:
 * - thousands separators: `1,234.56`
 * - dollar signs: `$1,234.56`
 * - parens-as-negative: `(1,234.56)` → -1234.56
 * - leading minus: `-1,234.56`
 * Returns NaN if it can't parse.
 */
export function parseLooseNumber(input: string | null | undefined): number {
  if (input == null) return Number.NaN;
  let s = String(input).trim();
  if (s === "") return Number.NaN;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,\s]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? sign * n : Number.NaN;
}

const HEADER_RX = /(date|posted|posting|transaction)/i;
const AMOUNT_RX = /(amount|debit|credit)/i;
const SUMMARY_RX = /^(beginning|ending|opening|closing)\s+balance/i;

/**
 * Strip a leading "summary block" preamble (e.g. Bank of America style:
 * "Description,,Summary Amt." followed by Beginning balance / Total credits
 * / Total debits / Ending balance lines), then return only the body that
 * starts with the canonical transaction header.
 *
 * Captures beginning + ending balance into `meta` when present.
 */
export function preprocessTransactionCsv(text: string): {
  body: string;
  meta: StatementMeta;
} {
  // Strip BOM if any.
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r\n|\n|\r/);
  const meta: StatementMeta = {};

  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i] ?? "";
    const lower = line.toLowerCase();
    // Crude but effective: a header line has both a date-ish token and an amount-ish token.
    if (HEADER_RX.test(lower) && AMOUNT_RX.test(lower) && !SUMMARY_RX.test(line)) {
      headerIdx = i;
      break;
    }
    // Capture summary lines for meta.
    const sm = line.match(
      /^([^,]*beginning|[^,]*ending|[^,]*opening|[^,]*closing)\s+balance[^,]*/i,
    );
    if (sm) {
      // Try to find a date inside the line.
      const dateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{2}-\d{2})/);
      const balanceMatch = line.match(/"?(-?[\d,]+\.\d{2})"?\s*$/);
      const date = dateMatch ? normalizeDate(dateMatch[0]) : null;
      const balance = balanceMatch ? parseLooseNumber(balanceMatch[1] ?? "") : Number.NaN;
      if (date && Number.isFinite(balance)) {
        const key = sm[1]!.toLowerCase().includes("end")
          ? "endingBalance"
          : sm[1]!.toLowerCase().includes("clos")
            ? "endingBalance"
            : "beginningBalance";
        meta[key] = { date, balance };
      }
    }
  }

  if (headerIdx === -1) {
    // No preamble detected; still run the bare-quote repair pass.
    return { body: repairBareQuotes(cleaned), meta };
  }
  const body = repairBareQuotes(lines.slice(headerIdx).join("\n"));
  return { body, meta };
}

/**
 * Bank exports sometimes embed unescaped double quotes inside a quoted
 * field — e.g. `"...for "Remaining balance of center stone"; Conf# ..."`.
 * RFC 4180 requires those inner quotes to be doubled (`""`), and csv-parse
 * (rightly) rejects them. We fix it line-by-line: any `"` that isn't at the
 * start/end of a field (i.e. not preceded by `,` or start-of-line and not
 * followed by `,` or end-of-line) gets doubled.
 */
function repairBareQuotes(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      let out = "";
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]!;
        if (ch !== '"') {
          out += ch;
          continue;
        }
        const prev = i === 0 ? "," : line[i - 1]!;
        const next = i === line.length - 1 ? "," : line[i + 1]!;
        const atFieldEdge = prev === "," || next === ",";
        if (atFieldEdge) {
          out += ch;
        } else {
          // Bare inner quote → double it so csv-parse treats it as literal.
          out += '""';
        }
      }
      return out;
    })
    .join("\n");
}

/**
 * Map a header token (already lowercased + snake_cased) to our internal key.
 * Returns the original key if no synonym applies.
 */
export function normalizeHeader(key: string): string {
  switch (key) {
    case "date":
    case "posted_date":
    case "posting_date":
    case "transaction_date":
    case "post_date":
      return "date";
    case "description":
    case "memo":
    case "details":
    case "payee":
    case "name":
      return "description";
    case "amount":
      return "amount";
    case "running_bal":
    case "running_bal.":
    case "running_balance":
    case "balance":
      return "running_balance";
    case "debit":
      return "debit";
    case "credit":
      return "credit";
    case "category":
      return "category";
    case "account":
    case "account_name":
      return "account";
    case "external_id":
    case "id":
    case "transaction_id":
      return "external_id";
    case "currency":
    case "iso_currency":
      return "currency";
    default:
      return key;
  }
}

/** Treat description as a "balance" pseudo-row (no amount, just an anchor). */
export function isBalancePseudoRow(description: string | null | undefined): boolean {
  if (!description) return false;
  return SUMMARY_RX.test(description.trim());
}
