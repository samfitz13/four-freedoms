/**
 * Cross-feature enums used by the financial workspace's statements roll-up.
 */

export enum AccountClass {
  Cash = "cash",
  Investments = "investments",
  Equity = "equity",
  Debt = "debt",
  Other = "other",
}

export enum StatementFlag {
  BalanceDrift = "balance_drift",
  ContributionDrift = "contribution_drift",
  PaystubMatchDrift = "paystub_match_drift",
}

export enum PaystubKind {
  Regular = "regular",
  Bonus = "bonus",
  Rsu = "rsu",
  Correction = "correction",
  Final = "final",
}

export enum FinancialHealthVerdict {
  Healthier = "healthier",
  Flat = "flat",
  Weaker = "weaker",
  Unknown = "unknown",
}

export enum FinancialFiVerdict {
  OnTrack = "on_track",
  Underfunded = "underfunded",
  MissingAssumptions = "missing_assumptions",
}

export enum FinancialAttentionVerdict {
  Clear = "clear",
  Review = "review",
  MissingData = "missing_data",
}
