import type { FiContributionHistory } from "./types";

/** Last 12 completed calendar months. Missing statements are not zero savings. */
export function summarizeFiContributions(
  points: Array<{ month: string; contribution: number }>,
  asOf = new Date(),
): FiContributionHistory {
  const current = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
  const start = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 12, 1));
  const end = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 1, 1));
  const windowStart = start.toISOString().slice(0, 10);
  const windowEnd = end.toISOString().slice(0, 10);
  const currentMonth = current.toISOString().slice(0, 10);
  const months = new Map<string, number>();
  for (const point of points) {
    if (
      /^\d{4}-(0[1-9]|1[0-2])-01$/.test(point.month) &&
      point.month >= windowStart &&
      point.month < currentMonth &&
      Number.isFinite(point.contribution)
    )
      months.set(point.month, (months.get(point.month) ?? 0) + point.contribution);
  }
  return {
    average: months.size
      ? [...months.values()].reduce((sum, value) => sum + value, 0) / months.size
      : null,
    monthsObserved: months.size,
    windowStart,
    windowEnd,
  };
}

export function resolveFiContribution(
  history: FiContributionHistory,
  manual: boolean,
  manualAmount: number | undefined,
): number | null {
  if (!manual) return history.average;
  return manualAmount !== undefined && Number.isFinite(manualAmount) && manualAmount >= 0
    ? manualAmount
    : null;
}
