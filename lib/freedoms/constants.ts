import type { AccountType, FreedomKey, FreedomMeta } from "./types";
import type { FiAllocation } from "./types";

export const FI_ASSUMPTION_VERSION = "planning-v1" as const;
export const FI_ASSETS = [
  "usEquity",
  "developedEquity",
  "emergingEquity",
  "bonds",
  "cash",
] as const;
export const EMPTY_ALLOCATION: FiAllocation = {
  usEquity: 0,
  developedEquity: 0,
  emergingEquity: 0,
  bonds: 0,
  cash: 0,
};
export const FI_PLANNING_DEFAULTS = {
  version: FI_ASSUMPTION_VERSION,
  equities: 0.06,
  bonds: 0.04,
  cash: 0.03,
  inflation: 0.03,
  additionalFee: 0,
};

export const FREEDOM_KEYS = ["financial", "location", "time", "health"] as const;

/** Editable planning assumptions, not market forecasts or measured inflation. */
export const FI_RETURN_DEFAULTS = {
  realReturn: 0.05,
  inflationRate: 0.03,
  downsideReduction: 0.02,
  minimumHistoryMonths: 12,
} as const;

/**
 * Allowed second-level account classifications per `account_type`. Stored
 * as free-text in `financial_accounts.subtype`; we validate against this
 * map rather than a pg enum so the taxonomy can evolve without migrations.
 */
export const ACCOUNT_SUBTYPES: Record<AccountType, readonly string[]> = {
  checking: [],
  savings: ["high_yield_savings", "money_market"],
  brokerage: ["taxable_brokerage"],
  retirement: [
    "traditional_401k",
    "roth_401k",
    "traditional_ira",
    "roth_ira",
    "hsa",
    "sep_ira",
    "simple_ira",
  ],
  crypto: [],
  real_estate: ["primary_residence", "investment_property"],
  loan: ["mortgage", "auto_loan", "student_loan", "personal_loan"],
  credit_card: [],
  equity_comp: ["rsu", "iso", "nso", "espp", "private_stock"],
  iso_options: ["private_company"],
  other: [],
} as const;

export const FREEDOM_STATUSES = ["live", "coming-soon"] as const;

export const freedomMetas: Record<FreedomKey, FreedomMeta> = {
  financial: {
    key: "financial",
    label: "Financial",
    question: "Am I building wealth?",
    colorVar: "var(--color-freedom-financial)",
    blurb: "Net worth, cashflow, and progress toward financial independence.",
  },
  location: {
    key: "location",
    label: "Location",
    question: "Am I physically in the places I want to be?",
    colorVar: "var(--color-freedom-location)",
    blurb: "Place, presence, and time spent where it matters.",
  },
  time: {
    key: "time",
    label: "Time",
    question: "Am I spending time on what matters?",
    colorVar: "var(--color-freedom-time)",
    blurb: "Calendar signal, focus, obligation load.",
  },
  health: {
    key: "health",
    label: "Health",
    question: "Is my body trending up?",
    colorVar: "var(--color-freedom-health)",
    blurb: "Movement, sleep, resting signal.",
  },
};

export const FREEDOMS: readonly FreedomMeta[] = [
  freedomMetas.financial,
  freedomMetas.location,
  freedomMetas.time,
  freedomMetas.health,
];
