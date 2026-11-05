import type { FiReturnHistory, FiReturnStatement } from "./types";

/**
 * Balance-based estimate, assuming contributions arrive at month end.
 * Only consecutive closed months with the same account set are comparable.
 * Unrecorded transfers and cash-flow timing cannot be recovered from these rows.
 */
export function estimateFiReturnHistory(
  statements: FiReturnStatement[],
  asOf = new Date(),
): FiReturnHistory {
  const currentMonth = asOf.toISOString().slice(0, 7) + "-01";
  const byMonth = new Map<string, FiReturnStatement[]>();
  for (const row of statements) {
    if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(row.month) || row.month >= currentMonth) continue;
    const group = byMonth.get(row.month) ?? [];
    group.push(row);
    byMonth.set(row.month, group);
  }
  const months = [...byMonth.keys()].sort();
  let logGrowth = 0;
  let monthsObserved = 0;
  let skippedTransitions = 0;
  let startMonth: string | null = null;
  let endMonth: string | null = null;
  for (let i = 1; i < months.length; i++) {
    const beforeMonth = months[i - 1]!;
    const month = months[i]!;
    const before = byMonth.get(beforeMonth)!;
    const after = byMonth.get(month)!;
    const ids = new Set(before.map((row) => row.accountId));
    const nextIds = new Set(after.map((row) => row.accountId));
    const validRows = [...before, ...after].every(
      (row) =>
        Number.isFinite(row.balance) && row.balance >= 0 && Number.isFinite(row.contribution),
    );
    const opening = before.reduce((sum, row) => sum + row.balance, 0);
    const closing = after.reduce((sum, row) => sum + row.balance - row.contribution, 0);
    const growth = closing / opening;
    if (
      monthIndex(month) - monthIndex(beforeMonth) !== 1 ||
      !validRows ||
      opening <= 0 ||
      !Number.isFinite(growth) ||
      growth <= 0 ||
      ids.size !== before.length ||
      nextIds.size !== after.length ||
      ids.size !== nextIds.size ||
      [...ids].some((id) => !nextIds.has(id))
    ) {
      skippedTransitions++;
      continue;
    }
    logGrowth += Math.log(growth);
    monthsObserved++;
    startMonth ??= beforeMonth;
    endMonth = month;
  }
  const annual = monthsObserved ? Math.expm1((logGrowth * 12) / monthsObserved) : null;
  return {
    annualNominalReturn: annual !== null && Number.isFinite(annual) ? annual : null,
    monthsObserved,
    skippedTransitions,
    startMonth,
    endMonth,
  };
}

function monthIndex(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}
