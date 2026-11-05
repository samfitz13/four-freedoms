/**
 * Derived financial values computed from the typed source-of-truth tables
 * (`monthly_statements`, `paystubs`, `cashflow_transactions`). These are
 * read-only helpers used to pre-fill the Goals tab — they never write back
 * to the goals row. Explicit manual contribution overrides win; otherwise
 * the FI forecast uses the past 12 completed months of contributions.
 */
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { financialAccounts, monthlyStatements } from "@/lib/db/schema";
import { toNumber, cashflowByMonth } from "@/lib/db/queries/financial";
import { listAllPaystubs } from "@/lib/db/queries/statements";
import { classifyAccount } from "@/lib/freedoms/account-subtypes";
import { AccountClass } from "@/lib/freedoms/enums";
import { summarizeFiContributions } from "./fi-contributions";
import { estimateFiReturnHistory } from "./fi-return-history";
import type { AccountType, DerivedFiInputs, SavingsRatePoint } from "@/lib/freedoms/types";

export type { DerivedFiInputs, SavingsRatePoint };

/**
 * Pull every monthly statement on invested-class accounts, group by month,
 * and report all-history return diagnostics alongside a separate contribution
 * average for the past 12 completed calendar months.
 */
export async function getDerivedFiInputs(
  householdId: string,
  asOf = new Date(),
): Promise<DerivedFiInputs> {
  const rows = await db
    .select({
      accountId: monthlyStatements.accountId,
      month: monthlyStatements.month,
      type: financialAccounts.type,
      endingBalance: monthlyStatements.endingBalance,
      employeeContribution: monthlyStatements.employeeContribution,
      employerMatch: monthlyStatements.employerMatch,
    })
    .from(monthlyStatements)
    .innerJoin(financialAccounts, eq(financialAccounts.id, monthlyStatements.accountId))
    .where(
      and(
        eq(monthlyStatements.householdId, householdId),
        eq(financialAccounts.householdId, householdId),
      ),
    )
    .orderBy(asc(monthlyStatements.month));

  const empty: DerivedFiInputs = {
    avgMonthlyContribution: null,
    realizedAnnualReturn: null,
    monthsObserved: 0,
    oldestMonth: null,
    latestMonth: null,
    trailingContributions: summarizeFiContributions([], asOf),
    returnHistory: estimateFiReturnHistory([], asOf),
  };

  if (rows.length === 0) return empty;

  // Roll up per month across invested-class accounts.
  const byMonth = new Map<string, { invested: number; contribution: number }>();
  for (const r of rows) {
    const klass = classifyAccount(r.type as AccountType);
    if (klass !== AccountClass.Investments) continue;

    const m = r.month as unknown as string;
    const slot = byMonth.get(m) ?? { invested: 0, contribution: 0 };
    slot.invested += toNumber(r.endingBalance);
    slot.contribution += toNumber(r.employeeContribution) + toNumber(r.employerMatch);
    byMonth.set(m, slot);
  }

  const months = [...byMonth.keys()].sort();
  if (months.length === 0) return empty;

  const oldestMonth = months[0]!;
  const latestMonth = months[months.length - 1]!;

  const contributions = months.map((m) => byMonth.get(m)!.contribution);
  const avgMonthlyContribution = contributions.reduce((s, c) => s + c, 0) / contributions.length;

  const returnHistory = estimateFiReturnHistory(
    rows
      .filter((row) => classifyAccount(row.type as AccountType) === AccountClass.Investments)
      .map((row) => ({
        accountId: row.accountId,
        month: row.month as unknown as string,
        balance: toNumber(row.endingBalance),
        contribution: toNumber(row.employeeContribution) + toNumber(row.employerMatch),
      })),
    asOf,
  );

  return {
    avgMonthlyContribution,
    realizedAnnualReturn: returnHistory.annualNominalReturn,
    returnHistory,
    monthsObserved: months.length,
    oldestMonth,
    latestMonth,
    trailingContributions: summarizeFiContributions(
      months.map((month) => ({ month, contribution: byMonth.get(month)!.contribution })),
      asOf,
    ),
  };
}

/**
 * Time series of total invested-class balance per month, oldest → newest.
 * Used by the FI projection chart to render the past behind the projection.
 */
export async function getInvestedBalanceSeries(
  householdId: string,
): Promise<Array<{ month: string; value: number }>> {
  const rows = await db
    .select({
      month: monthlyStatements.month,
      type: financialAccounts.type,
      endingBalance: monthlyStatements.endingBalance,
    })
    .from(monthlyStatements)
    .innerJoin(financialAccounts, eq(financialAccounts.id, monthlyStatements.accountId))
    .where(
      and(
        eq(monthlyStatements.householdId, householdId),
        eq(financialAccounts.householdId, householdId),
      ),
    )
    .orderBy(asc(monthlyStatements.month));

  if (rows.length === 0) return [];

  const totals = new Map<string, number>();
  for (const r of rows) {
    const klass = classifyAccount(r.type as AccountType);
    if (klass !== AccountClass.Investments) continue;
    const m = r.month as unknown as string;
    totals.set(m, (totals.get(m) ?? 0) + toNumber(r.endingBalance));
  }
  return [...totals.entries()]
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Trailing savings rate: Σ(employee + employer contributions to cash &
 * invested classes) / Σ(net income) over the trailing `window` months.
 *
 * Net income prefers paystub `net` when available for the month, otherwise
 * falls back to cashflow income. Returns null when there is no income to
 * divide by.
 */
export async function getSavingsRateSeries(
  householdId: string,
  windowMonths = 24,
): Promise<SavingsRatePoint[]> {
  const stmtRows = await db
    .select({
      month: monthlyStatements.month,
      type: financialAccounts.type,
      employeeContribution: monthlyStatements.employeeContribution,
      employerMatch: monthlyStatements.employerMatch,
    })
    .from(monthlyStatements)
    .innerJoin(financialAccounts, eq(financialAccounts.id, monthlyStatements.accountId))
    .where(
      and(
        eq(monthlyStatements.householdId, householdId),
        eq(financialAccounts.householdId, householdId),
      ),
    )
    .orderBy(asc(monthlyStatements.month));

  // monthly contributions in cash + invested classes
  const savedByMonth = new Map<string, number>();
  for (const r of stmtRows) {
    const klass = classifyAccount(r.type as AccountType);
    if (klass !== AccountClass.Cash && klass !== AccountClass.Investments) continue;
    const m = r.month as unknown as string;
    savedByMonth.set(
      m,
      (savedByMonth.get(m) ?? 0) + toNumber(r.employeeContribution) + toNumber(r.employerMatch),
    );
  }

  // monthly net income from paystubs (preferred) and cashflow (fallback)
  const paystubs = await listAllPaystubs(householdId);
  const paystubByMonth = new Map<string, number>();
  for (const p of paystubs) {
    const month = monthFromDate(p.payDate as unknown as string);
    paystubByMonth.set(month, (paystubByMonth.get(month) ?? 0) + toNumber(p.net));
  }

  const cf = await cashflowByMonth(householdId, windowMonths, { fromEarliest: true });
  const cfByMonth = new Map(cf.map((m) => [m.month.slice(0, 7) + "-01", m.income] as const));

  // Universe of months: union of statement, paystub, cashflow keys.
  const months = new Set<string>();
  for (const m of savedByMonth.keys()) months.add(m);
  for (const m of paystubByMonth.keys()) months.add(m);
  for (const m of cfByMonth.keys()) months.add(m);

  const sorted = [...months].sort();
  // Trim to the trailing window.
  const trimmed = sorted.slice(-windowMonths);

  return trimmed.map((m) => {
    const totalSaved = savedByMonth.get(m) ?? 0;
    const netIncome = paystubByMonth.get(m) ?? cfByMonth.get(m) ?? 0;
    const savingsRate = netIncome > 0 ? totalSaved / netIncome : null;
    return { month: m, totalSaved, netIncome, savingsRate };
  });
}

/** Trailing savings rate as a single ratio over the trailing window. */
export async function getTrailingSavingsRate(
  householdId: string,
  windowMonths = 12,
): Promise<{ rate: number | null; totalSaved: number; netIncome: number; months: number }> {
  const series = await getSavingsRateSeries(householdId, windowMonths);
  const window = series.slice(-windowMonths);
  const totalSaved = window.reduce((s, p) => s + p.totalSaved, 0);
  const netIncome = window.reduce((s, p) => s + p.netIncome, 0);
  return {
    rate: netIncome > 0 ? totalSaved / netIncome : null,
    totalSaved,
    netIncome,
    months: window.length,
  };
}

function monthFromDate(d: string): string {
  // Accepts YYYY-MM-DD (Drizzle date column round-tripped as ISO).
  return d.slice(0, 7) + "-01";
}
