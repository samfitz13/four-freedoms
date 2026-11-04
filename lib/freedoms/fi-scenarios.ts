import { planMonthlySeries } from "./fi-projection";
import type { FiReturnHistory, FiReturnScenario } from "./types";
import type { FiAllocation, FiPlanSettings } from "./fi-plan-settings";

export function nominalToRealReturn(nominal: number, inflation: number): number | null {
  if (!Number.isFinite(nominal) || !Number.isFinite(inflation) || nominal <= -1 || inflation <= -1)
    return null;
  const result = (1 + nominal) / (1 + inflation) - 1;
  return Number.isFinite(result) ? result : null;
}

export function portfolioRealReturn(
  weights: FiAllocation,
  assumptions: FiPlanSettings["assumptions"],
  expenseRate: number,
  sensitivity: -1 | 0 | 1,
  shock = false,
): number {
  const equity = weights.usEquity + weights.developedEquity + weights.emergingEquity;
  const nominal = shock
    ? equity * -0.35 + weights.bonds * -0.1
    : equity * (assumptions.equities + sensitivity * 0.02) +
      weights.bonds * (assumptions.bonds + sensitivity * 0.01) +
      weights.cash * (assumptions.cash + sensitivity * 0.005);
  // Expense ratios and the additional fee are annual percentage-point deductions, each once.
  return nominalToRealReturn(
    nominal - expenseRate - assumptions.additionalFee,
    assumptions.inflation,
  )!;
}

/** History is accepted for legacy callers but never feeds any forecast. */
export function buildFiReturnScenarios(input: {
  projection: Parameters<typeof planMonthlySeries>[0];
  history?: FiReturnHistory;
  inflationRate?: number;
  downsideReduction?: number;
  portfolio?: {
    weights: FiAllocation;
    assumptions: FiPlanSettings["assumptions"];
    expenseRate: number;
  };
}): FiReturnScenario[] {
  const reduction = input.downsideReduction ?? 0.02;
  return (
    [
      ["base", "Base", 0],
      ["downside", "Downside", -1],
      ["upside", "Upside", 1],
    ] as const
  ).map(([kind, title, sensitivity]) => {
    const realReturn = input.portfolio
      ? portfolioRealReturn(
          input.portfolio.weights,
          input.portfolio.assumptions,
          input.portfolio.expenseRate,
          sensitivity,
        )
      : input.projection.realReturn + sensitivity * reduction;
    return {
      kind,
      title,
      realReturn,
      plan: planMonthlySeries({ ...input.projection, realReturn }),
    };
  });
}
