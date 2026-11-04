/** Deterministic, monthly, real-dollar projection. No FX or success probabilities. */

import type {
  FiProjection,
  FiProjectionInput,
  FiYear,
  MonthlyBalancePoint,
  PlanResult,
} from "./types";
import { fiMonthDistance, shiftFiMonth } from "./fi-plan-settings";
import { fiMonthlyCashFlow } from "./fi-cashflows";

/**
 * Monthly-resolution plan series anchored at a specific calendar month.
 * Converts the effective annual real return to its monthly equivalent.
 * Compounds `startBalance` plus end-of-month `monthlyContribution`
 * through the full horizon, recording the first crossing of `fiNumber`
 * (default 50 years). Returned `series` includes the anchor as point 0.
 */
export function planMonthlySeries(input: {
  startMonth: string;
  startBalance: number;
  monthlyContribution: number;
  realReturn: number;
  withdrawalRate: number;
  targetAnnualSpend: number;
  horizonYears?: number;
  endMonth?: string | null;
  retirementMonth?: string | null;
  monthlyRetirementIncome?: number;
  incomeStartMonth?: string | null;
  annualReturnForMonth?: (month: string) => number;
}): PlanResult {
  const horizonYears = input.horizonYears ?? 50;
  const horizonMonths = input.endMonth
    ? fiMonthDistance(input.startMonth, input.endMonth)
    : horizonYears * 12;
  if (!Number.isInteger(horizonMonths) || horizonMonths < 0 || horizonMonths > 1800)
    throw new Error("Plan end must be after the statement anchor and within 150 years.");
  if (!Number.isFinite(input.realReturn) || input.realReturn <= -1)
    throw new Error("Invalid planning return.");
  const fiNumber =
    input.withdrawalRate > 0 ? input.targetAnnualSpend / input.withdrawalRate : Infinity;

  const series: MonthlyBalancePoint[] = [];
  let balance = Math.max(0, input.startBalance);
  let monthsToFi: number | null = null;
  let fiMonth: string | null = null;
  let depletionMonth: string | null = null;
  let firstShortfallMonth: string | null = null;
  let cumulativeShortfall = 0;

  series.push({ month: input.startMonth, balance });

  if (Number.isFinite(fiNumber) && balance >= fiNumber) {
    monthsToFi = 0;
    fiMonth = input.startMonth;
  }

  for (let m = 1; m <= horizonMonths; m++) {
    const month = shiftFiMonth(input.startMonth, m);
    const annualRate = input.annualReturnForMonth?.(month) ?? input.realReturn;
    if (!Number.isFinite(annualRate) || annualRate <= -1)
      throw new Error("Invalid monthly return.");
    const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
    const { retired, income, spending, contribution } = fiMonthlyCashFlow({ ...input, month });
    const available = balance * (1 + monthlyRate) + contribution + income;
    const shortfall = Math.max(0, spending - available);
    cumulativeShortfall += shortfall;
    if (shortfall > 1e-8 && firstShortfallMonth === null) firstShortfallMonth = month;
    balance = Math.max(0, available - spending);
    if (retired && balance === 0 && depletionMonth === null) depletionMonth = month;
    series.push(
      retired
        ? { month, balance, spending, income, shortfall, cumulativeShortfall }
        : { month, balance },
    );
    if (monthsToFi === null && Number.isFinite(fiNumber) && balance >= fiNumber) {
      monthsToFi = m;
      fiMonth = month;
    }
  }

  return {
    series,
    fiNumber,
    monthsToFi,
    fiMonth,
    retirementMonth: input.retirementMonth ?? null,
    depletionMonth,
    firstShortfallMonth,
    cumulativeShortfall,
  };
}

export function projectFi(input: FiProjectionInput): FiProjection {
  const realReturn = input.realReturn ?? 0.05;
  const withdrawalRate = input.withdrawalRate ?? 0.04;
  const horizonYears = input.horizonYears ?? 50;
  const plan = planMonthlySeries({
    startMonth: "2000-01-01",
    startBalance: input.currentInvested,
    monthlyContribution: input.monthlyContribution,
    realReturn,
    withdrawalRate,
    targetAnnualSpend: input.targetAnnualSpend,
    horizonYears,
  });
  const years: FiYear[] = plan.series
    .filter((_, i) => i % 12 === 0)
    .map((point, year) => {
      const rawProgress =
        Number.isFinite(plan.fiNumber) && plan.fiNumber > 0 ? point.balance / plan.fiNumber : 0;
      return {
        year,
        balance: point.balance,
        fiNumber: plan.fiNumber,
        progress: clamp(rawProgress, 0, 1),
        rawProgress,
      };
    });
  return {
    fiNumber: plan.fiNumber,
    realReturn,
    withdrawalRate,
    years,
    yearsToFi: plan.monthsToFi === null ? null : Math.ceil(plan.monthsToFi / 12),
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
