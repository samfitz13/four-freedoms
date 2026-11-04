/**
 * Helpers for the account subtype taxonomy. The data lives in
 * `ACCOUNT_SUBTYPES` (constants.ts) and the type alias `AccountType`
 * (types.ts). The `AccountClass` enum used to bucket accounts for the
 * statements roll-up lives in enums.ts.
 */

import { ACCOUNT_SUBTYPES } from "./constants";
import { AccountClass } from "./enums";
import type { AccountType } from "./types";

const ALL_SUBTYPES = new Set(Object.values(ACCOUNT_SUBTYPES).flat());

export function isValidSubtype(type: AccountType, subtype: string | null | undefined): boolean {
  if (subtype === null || subtype === undefined || subtype === "") return true;
  const allowed = ACCOUNT_SUBTYPES[type] as readonly string[];
  return allowed.includes(subtype);
}

export function isKnownSubtype(subtype: string | null | undefined): boolean {
  if (!subtype) return false;
  return ALL_SUBTYPES.has(subtype);
}

const UPPERCASE_TOKENS = new Set(["401k", "ira", "hsa", "iso", "nso", "rsu", "espp"]);

export function titleCaseSubtype(s: string): string {
  return s
    .split("_")
    .map((w) => {
      if (w === "401k") return "401(k)";
      if (UPPERCASE_TOKENS.has(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/**
 * Subtypes that can receive employer contributions (the "match" column).
 * Personal IRAs and HSAs don't qualify — only employer-sponsored plans.
 */
const EMPLOYER_SPONSORED_SUBTYPES: ReadonlySet<string> = new Set([
  "traditional_401k",
  "roth_401k",
  "sep_ira",
  "simple_ira",
]);

/**
 * Whether this account is something you actively fund. Checking is a
 * pass-through (paystub in, expenses out) — it never has a "contribution".
 * Equity comp (RSU/ISO/NSO/private_stock) accrues via grants and vesting,
 * not contributions; ESPP would technically qualify but we keep the whole
 * `equity_comp` bucket contribution-free for now to keep the column
 * coherent. Everything else does: savings deposits, brokerage buys,
 * retirement employee contributions, credit-card payments, loan principal.
 */
export function acceptsContribution(type: AccountType): boolean {
  return type !== "checking" && type !== "equity_comp" && type !== "iso_options";
}

export function acceptsEmployerMatch(
  type: AccountType,
  subtype: string | null | undefined,
): boolean {
  if (type !== "retirement") return false;
  if (!subtype) return false;
  return EMPLOYER_SPONSORED_SUBTYPES.has(subtype);
}

/**
 * Bucket an account by `type` for the roll-up. The `subtype` parameter is
 * accepted (for future per-subtype overrides) but ignored today.
 */
export function classifyAccount(type: AccountType): AccountClass {
  switch (type) {
    case "checking":
    case "savings":
      return AccountClass.Cash;
    case "brokerage":
    case "retirement":
    case "crypto":
    case "equity_comp":
    case "iso_options":
      return AccountClass.Investments;
    case "real_estate":
      return AccountClass.Equity;
    case "loan":
    case "credit_card":
      return AccountClass.Debt;
    default:
      return AccountClass.Other;
  }
}
