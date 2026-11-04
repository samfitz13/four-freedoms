/**
 * Sole source of truth for the Financial freedom's headline metrics and
 * score. Reads only from the typed financial tables; no `entries` jsonb.
 *
 * Used by:
 *   - Financial dashboard card (`/dashboard`)
 *   - Financial Overview tab (`/financial`)
 *
 * All downstream computation flows through `computeFinancialSummary`; the
 * scoring rubric is private to this module.
 */
import "server-only";
import {
  cashflowByMonth,
  currentInvestedBalance,
  latestBalances,
  netWorthSeries,
} from "@/lib/db/queries/financial";
import { monthStart } from "@/lib/db/queries/statements";
import { computeRunwayEstimate } from "@/lib/freedoms/financial-runway";
import { getFiGoalAssumptions } from "@/lib/freedoms/financial-settings";
import type { DailyPoint, FinancialSummary } from "@/lib/freedoms/types";

export async function computeFinancialSummary(
  householdId: string,
  today: Date = new Date(),
): Promise<FinancialSummary> {
  const [series12, months, balances, invested, fi] = await Promise.all([
    netWorthSeries(householdId, 12),
    cashflowByMonth(householdId, 6),
    latestBalances(householdId),
    currentInvestedBalance(householdId),
    getFiGoalAssumptions(householdId),
  ]);

  const netWorth = series12.length ? series12[series12.length - 1]!.netWorth : null;
  const netWorth30 = pickNetWorthDaysAgo(series12, 30);
  const delta30 = netWorth !== null && netWorth30 !== null ? netWorth - netWorth30 : null;

  const savingsRate = computeSavingsRate(months);
  const runway = computeRunwayEstimate({
    balances,
    months,
    currentMonth: monthStart(today),
  });
  const runwayMonths = runway.months;

  const avgMonthlyExpense = averageExpense(months);
  const fiNumber =
    fi.annualSpend !== undefined
      ? fi.annualSpend / (fi.withdrawalRate ?? 0.04)
      : avgMonthlyExpense > 0
        ? (avgMonthlyExpense * 12) / (fi.withdrawalRate ?? 0.04)
        : null;
  const fiProgress = fiNumber !== null && fiNumber > 0 ? Math.max(0, invested / fiNumber) : null;

  // Score: rubric against current snapshot. Series: score each of the last 14
  // days using the net-worth series up to that day and the running metrics;
  // for simplicity the series uses the same savingsRate/runway/fiProgress as
  // today (they're slow-moving) but the netWorth point varies day to day, so
  // the line expresses recent wealth motion.
  const todayScore = scoreRubric({ savingsRate, runwayMonths, fiProgress });

  const series = buildSeries(series12, today, {
    savingsRate,
    runwayMonths,
    fiProgress,
  });

  const thisWeek = nonNull(series.slice(7));
  const lastWeek = nonNull(series.slice(0, 7));
  const trend =
    thisWeek.length && lastWeek.length ? Math.round(mean(thisWeek) - mean(lastWeek)) : 0;

  const { entriesThisWeek, streak } = computeActivity(series12, months, today);

  return {
    netWorth,
    netWorth30,
    delta30,
    savingsRate,
    runwayMonths,
    fiProgress,
    invested,
    score: todayScore ?? 0,
    trend,
    series,
    entriesThisWeek,
    streak,
  };
}

// ---------------------------------------------------------------------------
// Rubric (private — single call site)
// ---------------------------------------------------------------------------
function scoreRubric({
  savingsRate,
  runwayMonths,
  fiProgress,
}: {
  savingsRate: number | null;
  runwayMonths: number | null;
  fiProgress: number | null;
}): number | null {
  let score = 0;
  let present = false;

  if (savingsRate !== null) {
    present = true;
    if (savingsRate <= 0.3) {
      score += (Math.max(0, savingsRate) / 0.3) * 45;
    } else {
      score += 45 + clamp((savingsRate - 0.3) / 0.2, 0, 1) * 15;
    }
  }

  if (runwayMonths !== null) {
    present = true;
    if (runwayMonths <= 12) {
      score += (runwayMonths / 12) * 25;
    } else {
      score += 25 + clamp((runwayMonths - 12) / 12, 0, 1) * 10;
    }
  }

  if (fiProgress !== null) {
    present = true;
    score += clamp(fiProgress, 0, 1) * 20;
  }

  return present ? Math.round(clamp(score, 0, 100)) : null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function pickNetWorthDaysAgo(
  series: Array<{ date: string; netWorth: number }>,
  days: number,
): number | null {
  if (series.length === 0) return null;
  const target = new Date();
  target.setDate(target.getDate() - days);
  const iso = target.toISOString().slice(0, 10);
  // Series is ascending by date; find the latest point on or before target.
  let hit: number | null = null;
  for (const p of series) {
    if (p.date <= iso) hit = p.netWorth;
    else break;
  }
  // If target predates the series, fall back to the first available point.
  return hit ?? series[0]!.netWorth;
}

function computeSavingsRate(months: Array<{ income: number; expense: number }>): number | null {
  // Use the last fully-represented month (most recent entry in the series).
  // cashflowByMonth always returns the window; weight current-month+prev by
  // summing income/expense to avoid partial-month noise.
  if (months.length === 0) return null;
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);
  if (totalIncome <= 0) return null;
  return clamp((totalIncome - totalExpense) / totalIncome, -1, 1);
}

function averageExpense(months: Array<{ expense: number }>): number {
  const observed = months.filter((m) => m.expense > 0);
  if (observed.length === 0) return 0;
  return observed.reduce((s, m) => s + m.expense, 0) / observed.length;
}

function buildSeries(
  netWorthSeries12mo: Array<{ date: string; netWorth: number }>,
  today: Date,
  metrics: { savingsRate: number | null; runwayMonths: number | null; fiProgress: number | null },
): DailyPoint[] {
  // Map date → netWorth for quick lookup.
  const byDate = new Map(netWorthSeries12mo.map((p) => [p.date, p.netWorth]));
  const out: DailyPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const hasNetWorth = byDate.has(iso);
    // Score the day only if we have *some* signal on that day. For now we
    // gate on net worth presence, since typed-table state is near-instant.
    const score = hasNetWorth ? scoreRubric(metrics) : null;
    out.push({ date: iso, score });
  }
  return out;
}

function computeActivity(
  series12: Array<{ date: string }>,
  months: Array<{ income: number; expense: number }>,
  today: Date,
): { entriesThisWeek: number; streak: number } {
  // Approximate activity from: any day in the 7d with a balance snapshot, or
  // a non-zero cashflow month marker. Good enough for the dashboard blurb.
  const sevenAgo = new Date(today);
  sevenAgo.setDate(today.getDate() - 7);
  const sevenIso = sevenAgo.toISOString().slice(0, 10);
  const snapshotDays = new Set(series12.map((p) => p.date));
  let thisWeek = 0;
  for (const d of snapshotDays) {
    if (d >= sevenIso) thisWeek += 1;
  }
  if (months.some((m) => m.income > 0 || m.expense > 0)) thisWeek += 1;

  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (snapshotDays.has(iso)) streak += 1;
    else if (streak > 0) break;
  }
  return { entriesThisWeek: thisWeek, streak };
}

function nonNull(points: DailyPoint[]): number[] {
  return points.flatMap((p) => (p.score === null ? [] : [p.score]));
}

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
