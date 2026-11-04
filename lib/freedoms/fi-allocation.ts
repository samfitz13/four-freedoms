import type { InvestmentSnapshotView } from "@/lib/financial/portfolio/types";
import { EMPTY_ALLOCATION, FI_ASSETS, type FiAsset, type FiPlanSettings } from "./fi-plan-settings";

import type { FiAccountInput, FiStatementInput, FiAccountCoverage } from "./types";
export type { FiAccountInput, FiStatementInput, FiAccountCoverage } from "./types";

export function isFiAccountEligible(type: string): boolean {
  return type === "brokerage" || type === "retirement" || type === "savings";
}

export function classifyFiEtf(symbol: string): FiAsset | null {
  switch (symbol.toUpperCase()) {
    case "IUSV":
    case "IUSG":
    case "VTWO":
      return "usEquity";
    case "VEA":
      return "developedEquity";
    case "VWO":
      return "emergingEquity";
    case "MUB":
      return "bonds";
    default:
      return null;
  }
}
export function fiSnapshotKey(snapshot: InvestmentSnapshotView): string {
  // Invalidate confirmation if a snapshot's contents or dates change.
  let hash = 2166136261;
  for (const char of JSON.stringify(snapshot))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${snapshot.id}:${(hash >>> 0).toString(16)}`;
}

export function buildFiAllocation(input: {
  accounts: FiAccountInput[];
  statements: FiStatementInput[];
  snapshots: InvestmentSnapshotView[];
  currency: string;
  settings: FiPlanSettings | null;
}) {
  const { settings } = input;
  const selected =
    settings?.includedAccountIds ??
    input.accounts
      .filter((a) => a.type === "brokerage" || a.type === "retirement")
      .map((a) => a.id);
  const included = new Set(selected);
  const statements = input.statements.filter((s) => included.has(s.accountId));
  const anchorMonth =
    statements
      .map((s) => s.month)
      .sort()
      .at(-1) ?? null;
  const errors: string[] = [];
  if (!selected.length) errors.push("Include a brokerage, retirement, or savings account.");
  if (selected.some((id) => !input.accounts.some((a) => a.id === id)))
    errors.push("An included account is unavailable. Confirm included accounts again.");
  const coverage: FiAccountCoverage[] = input.accounts.map((a) => {
    const eligible = isFiAccountEligible(a.type);
    const latest = input.statements
      .filter((s) => s.accountId === a.id)
      .sort((x, y) => y.month.localeCompare(x.month))[0];
    const snapshot =
      a.type === "savings" ? undefined : input.snapshots.find((s) => s.accountId === a.id);
    const row: FiAccountCoverage = {
      id: a.id,
      name: a.name,
      included: included.has(a.id),
      eligible,
      cashOnly: a.type === "savings",
      archived: a.isArchived === true,
      balance: latest?.balance ?? null,
      statementMonth: latest?.month ?? null,
      snapshotDate: snapshot?.preparedOn ?? null,
      quoteDate: snapshot?.data.priceAsOf ?? null,
      cashDate: snapshot?.data.cash.asOf ?? null,
      confirmationKey: snapshot ? fiSnapshotKey(snapshot) : null,
      warnings: [],
      allocation: null,
      expenseRate: 0,
      source: null,
    };
    if (snapshot) {
      if (!snapshot.data.priceAsOf) row.warnings.push("Quote date unknown");
      row.warnings.push(`${snapshot.data.cash.basis} cash`);
      if (
        snapshot.preparedOn.slice(0, 7) !== anchorMonth?.slice(0, 7) ||
        snapshot.data.cash.asOf?.slice(0, 7) !== anchorMonth?.slice(0, 7)
      )
        row.warnings.push("Snapshot and statement months differ");
    }
    if (!row.included) return row;
    if (!eligible)
      errors.push(`${a.name}: this account type is excluded from the spendable projection.`);
    if (a.currency !== input.currency || (snapshot && snapshot.currency !== input.currency))
      errors.push(`${a.name}: currency must be ${input.currency}; no FX conversion is modeled.`);
    if (!latest || (!row.archived && latest.month !== anchorMonth))
      errors.push(
        `${a.name}: add a statement for ${anchorMonth?.slice(0, 7) ?? "the projection month"}.`,
      );
    if (latest && (!Number.isFinite(latest.balance) || latest.balance < 0))
      errors.push(`${a.name}: enter a nonnegative statement balance.`);
    if (row.cashOnly) {
      row.allocation = { ...EMPTY_ALLOCATION, cash: 1 };
      row.source = "cash";
      return row;
    }
    const manual = settings?.manualAllocations[a.id];
    if (manual) {
      row.allocation = manual.weights;
      row.expenseRate = manual.expenseRate;
      row.source = "manual";
      return row;
    }
    if (!snapshot) {
      row.warnings.push("No allocation snapshot. Enter this account's allocation.");
      return row;
    }
    if (settings?.confirmedSnapshots[a.id] !== row.confirmationKey) return row;
    const amounts = { ...EMPTY_ALLOCATION, cash: snapshot.data.cash.amount };
    let expenses = 0;
    for (const fund of snapshot.data.funds) {
      const asset = classifyFiEtf(fund.symbol);
      if (!asset) {
        errors.push(`${a.name}: unsupported holding ${fund.symbol}.`);
        return row;
      }
      const value = fund.shares * fund.price;
      amounts[asset] += value;
      expenses += (value * fund.expense) / 100;
    }
    const total = Object.values(amounts).reduce((sum, n) => sum + n, 0);
    if (total > 0) {
      row.allocation = { ...EMPTY_ALLOCATION };
      for (const key of FI_ASSETS) row.allocation[key] = amounts[key] / total;
      row.expenseRate = expenses / total;
      row.source = "snapshot";
    }
    return row;
  });
  const rows = coverage.filter((a) => a.included);
  const balance = rows.reduce((sum, a) => sum + (a.balance ?? 0), 0);
  const coveredBalance = rows
    .filter((a) => a.allocation)
    .reduce((sum, a) => sum + (a.balance ?? 0), 0);
  const weights = { ...EMPTY_ALLOCATION };
  let expenseRate = 0;
  if (balance > 0)
    for (const row of rows) {
      if (!row.allocation) continue;
      const weight = (row.balance ?? 0) / balance;
      for (const asset of FI_ASSETS) weights[asset] += row.allocation[asset] * weight;
      expenseRate += row.expenseRate * weight;
    }
  // A zero-balance account still requires its own allocation, never a household extrapolation.
  const complete = rows.length > 0 && rows.every((a) => a.allocation !== null);
  if (balance === 0 && settings?.returnMode === "portfolio")
    errors.push("A positive statement balance is needed to weight the portfolio allocation.");
  return { coverage, anchorMonth, balance, coveredBalance, weights, expenseRate, complete, errors };
}
