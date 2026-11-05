/**
 * Computes the monthly statements roll-up for a household + month. This is
 * the source the Statements page reads from — net worth, composition, flow,
 * FI metrics, and per-account rows with reconciliation flags.
 */
import "server-only";
import {
  getMonthlySummary,
  listPaystubsForMonth,
  listStatementsForMonth,
  monthEnd,
  priorMonthlySummary,
  shiftMonth,
  sumTaggedContributionsForMonth,
} from "@/lib/db/queries/statements";
import { cashflowByMonth, listAccounts, toNumber } from "@/lib/db/queries/financial";
import { isIsoOptionAccount, isoOptionAccountValues } from "@/lib/db/queries/iso-options";
import { acceptsEmployerMatch, classifyAccount } from "@/lib/freedoms/account-subtypes";
import { AccountClass, StatementFlag } from "@/lib/freedoms/enums";
import { getFiGoalAssumptions } from "@/lib/freedoms/financial-settings";
import type {
  AccountClassSeries,
  AccountStatementRow,
  CompositionPoint,
  MonthlyRollup,
} from "@/lib/freedoms/types";

const FLAG_TOLERANCE = 1; // dollars

export async function computeMonthlyRollup(
  householdId: string,
  month: string,
): Promise<MonthlyRollup> {
  const prevMonth = shiftMonth(month, -1);

  const [
    rows,
    prevRows,
    tagged,
    paystubsThis,
    summary,
    summaryPrev,
    fiAssumptions,
    cashflowMonths,
    accounts,
    isoValues,
    isoPrevValues,
  ] = await Promise.all([
    listStatementsForMonth(householdId, month),
    listStatementsForMonth(householdId, prevMonth),
    sumTaggedContributionsForMonth(householdId, month),
    listPaystubsForMonth(householdId, month),
    getMonthlySummary(householdId, month),
    priorMonthlySummary(householdId, month),
    getFiGoalAssumptions(householdId),
    cashflowByMonth(householdId, 24),
    listAccounts(householdId, { includeArchived: true }),
    isoOptionAccountValues(householdId, monthEnd(month)),
    isoOptionAccountValues(householdId, monthEnd(prevMonth)),
  ]);

  const effectiveRows = applyIsoDerivedRows(rows, accounts, isoValues, month);
  const effectivePrevRows = applyIsoDerivedRows(prevRows, accounts, isoPrevValues, prevMonth);
  const prevById = new Map(effectivePrevRows.map((r) => [r.accountId, r] as const));

  // Per-account computed rows
  const enriched: AccountStatementRow[] = effectiveRows.map((r) => {
    const klass = classifyAccount(r.type);
    const prior = prevById.get(r.accountId)?.endingBalance ?? null;
    const gain =
      prior === null ? 0 : r.endingBalance - prior - r.employeeContribution - r.employerMatch;

    const flags: AccountStatementRow["flags"] = [];

    // Balance drift: sanity-check the entered ending against
    //   prior_ending + tagged_cashflow_in + employee_contribution + employer_match.
    // Only run when a prior statement exists *and* something flowed in
    // (tagged cashflow or contributions). Pure investment growth doesn't
    // get flagged because we have no signal for it here.
    const tag = tagged.get(r.accountId);
    if (
      prior !== null &&
      (tag !== undefined || r.employeeContribution !== 0 || r.employerMatch !== 0)
    ) {
      const expected = prior + (tag ?? 0) + r.employeeContribution + r.employerMatch;
      if (Math.abs(expected - r.endingBalance) > FLAG_TOLERANCE) {
        flags.push({
          kind: StatementFlag.BalanceDrift,
          expected,
          actual: r.endingBalance,
          delta: r.endingBalance - expected,
        });
      }
    }

    // Contribution drift: tagged transactions sum vs entered employee contribution.
    if (tag !== undefined && Math.abs(tag - r.employeeContribution) > FLAG_TOLERANCE) {
      flags.push({
        kind: StatementFlag.ContributionDrift,
        expected: tag,
        actual: r.employeeContribution,
        delta: r.employeeContribution - tag,
      });
    }

    return { ...r, klass, gain, flags };
  });

  // Paystub-side employer match drift: aggregate, not per row.
  const paystubMatchTotal = paystubsThis.reduce((s, p) => s + toNumber(p.employerMatch), 0);
  const enteredMatchTotal = enriched.reduce((s, r) => s + r.employerMatch, 0);
  if (paystubMatchTotal > 0 && Math.abs(paystubMatchTotal - enteredMatchTotal) > FLAG_TOLERANCE) {
    // Mark every employer-sponsored row so the user can see _where_ to fix it.
    for (const r of enriched) {
      if (acceptsEmployerMatch(r.type, r.subtype)) {
        r.flags.push({
          kind: StatementFlag.PaystubMatchDrift,
          expected: paystubMatchTotal,
          actual: enteredMatchTotal,
          delta: enteredMatchTotal - paystubMatchTotal,
        });
      }
    }
  }

  // Net worth + delta
  const netWorthCurrent = sumNetWorth(enriched);
  const prevEnriched = effectivePrevRows.map((r) => ({
    ...r,
    klass: classifyAccount(r.type),
  }));
  const netWorthPrev = effectivePrevRows.length > 0 ? sumNetWorth(prevEnriched) : null;
  const delta = netWorthPrev !== null ? netWorthCurrent - netWorthPrev : null;
  const deltaPct =
    netWorthPrev !== null && netWorthPrev !== 0 ? delta! / Math.abs(netWorthPrev) : null;

  // Composition (current month)
  const composition: CompositionPoint[] = (
    [
      AccountClass.Cash,
      AccountClass.Investments,
      AccountClass.Equity,
      AccountClass.Debt,
      AccountClass.Other,
    ] as const
  ).map((klass) => ({
    klass,
    value: enriched.filter((r) => r.klass === klass).reduce((s, r) => s + r.endingBalance, 0),
  }));

  // Flow
  const cf = cashflowMonths.find((m) => m.month.slice(0, 7) === month.slice(0, 7));
  const netIncomeFromCashflow = cf?.income ?? 0;
  const netIncomeFromPaystubs = paystubsThis.reduce((s, p) => s + toNumber(p.net), 0);
  // Prefer paystubs when present; fall back to cashflow income.
  const netIncome = netIncomeFromPaystubs > 0 ? netIncomeFromPaystubs : netIncomeFromCashflow;
  const expenses = cf?.expense ?? 0;
  const totalSaved = enriched.reduce(
    (s, r) =>
      r.klass === AccountClass.Investments || r.klass === AccountClass.Cash
        ? s + r.employeeContribution + r.employerMatch
        : s,
    0,
  );
  const savingsRate = netIncome > 0 ? totalSaved / netIncome : null;
  const savingsRateGoal =
    summary?.savingsRateGoal !== null && summary?.savingsRateGoal !== undefined
      ? Number(summary.savingsRateGoal)
      : summaryPrev?.savingsRateGoal !== null && summaryPrev?.savingsRateGoal !== undefined
        ? Number(summaryPrev.savingsRateGoal)
        : null;

  // FI
  const investedNow = composition.find((c) => c.klass === AccountClass.Investments)?.value ?? 0;
  const fiNumber =
    fiAssumptions.annualSpend !== undefined
      ? fiAssumptions.annualSpend / (fiAssumptions.withdrawalRate ?? 0.04)
      : null;
  const fiPercent = fiNumber !== null && fiNumber > 0 ? investedNow / fiNumber : null;

  let fiPercentDelta: number | null = null;
  if (fiPercent !== null) {
    const prevInvested =
      prevEnriched
        .filter((r) => r.klass === AccountClass.Investments)
        .reduce((s, r) => s + r.endingBalance, 0) || null;
    const prevFiPct =
      prevInvested !== null && fiNumber !== null && fiNumber > 0 ? prevInvested / fiNumber : null;
    if (prevFiPct !== null) fiPercentDelta = fiPercent - prevFiPct;
  }

  const wr = fiAssumptions.withdrawalRate ?? 0.04;
  const swYearly = netWorthCurrent > 0 ? netWorthCurrent * wr : null;
  const swMonthly = swYearly !== null ? swYearly / 12 : null;

  const totalGains = enriched
    .filter((r) => r.klass === AccountClass.Investments)
    .reduce((s, r) => s + r.gain, 0);

  // Filter rows to active accounts only (drop archived w/o statements).
  const activeIds = new Set(accounts.map((a) => a.id));
  const finalRows = enriched.filter((r) => activeIds.has(r.accountId));

  return {
    month,
    hasData: effectiveRows.length > 0,
    netWorth: netWorthCurrent,
    netWorthPrev,
    delta,
    deltaPct,
    composition,
    netIncome,
    netIncomeFromPaystubs,
    netIncomeFromCashflow,
    expenses,
    totalSaved,
    savingsRate,
    savingsRateGoal,
    fiNumber,
    fiPercent,
    fiPercentDelta,
    swMonthly,
    swYearly,
    totalGains,
    rows: finalRows,
  };
}

function sumNetWorth(rows: Array<{ klass: AccountClass; endingBalance: number }>): number {
  // Liabilities (debt) subtract from net worth; everything else adds.
  return rows.reduce(
    (s, r) => s + (r.klass === AccountClass.Debt ? -Math.abs(r.endingBalance) : r.endingBalance),
    0,
  );
}

type StatementRow = Awaited<ReturnType<typeof listStatementsForMonth>>[number];
type FinancialAccountRow = Awaited<ReturnType<typeof listAccounts>>[number];

function applyIsoDerivedRows(
  rows: StatementRow[],
  accounts: FinancialAccountRow[],
  isoValues: Map<string, number>,
  month: string,
): StatementRow[] {
  const rowsByAccount = new Map(rows.map((row) => [row.accountId, row] as const));
  const next = rows.map((row) =>
    isIsoOptionAccount(row.type, row.subtype)
      ? { ...row, endingBalance: isoValues.get(row.accountId) ?? 0 }
      : row,
  );

  for (const account of accounts) {
    if (!isIsoOptionAccount(account.type, account.subtype) || rowsByAccount.has(account.id)) {
      continue;
    }
    const value = isoValues.get(account.id) ?? 0;
    if (value === 0) continue;
    next.push({
      id: `derived:${account.id}:${month}`,
      accountId: account.id,
      accountName: account.name,
      isArchived: account.isArchived,
      type: account.type,
      subtype: account.subtype,
      currency: account.currency,
      month,
      endingBalance: value,
      employeeContribution: 0,
      employerMatch: 0,
      notes: null,
    });
  }

  return next;
}

/** 12-month time series per account class, summed across accounts in the class. */
export async function getCompositionHistory(
  householdId: string,
  anchorMonth: string,
  months = 12,
): Promise<AccountClassSeries[]> {
  // Build N months oldest→newest centered on anchor.
  const monthsList: string[] = [];
  for (let i = months - 1; i >= 0; i--) monthsList.push(shiftMonth(anchorMonth, -i));

  const buckets: Record<AccountClass, Array<{ month: string; value: number }>> = {
    [AccountClass.Cash]: [],
    [AccountClass.Investments]: [],
    [AccountClass.Equity]: [],
    [AccountClass.Debt]: [],
    [AccountClass.Other]: [],
  };

  for (const m of monthsList) {
    const [rows, accounts, isoValues] = await Promise.all([
      listStatementsForMonth(householdId, m),
      listAccounts(householdId, { includeArchived: true }),
      isoOptionAccountValues(householdId, monthEnd(m)),
    ]);
    const effectiveRows = applyIsoDerivedRows(rows, accounts, isoValues, m);
    const sums: Record<AccountClass, number> = {
      [AccountClass.Cash]: 0,
      [AccountClass.Investments]: 0,
      [AccountClass.Equity]: 0,
      [AccountClass.Debt]: 0,
      [AccountClass.Other]: 0,
    };
    for (const r of effectiveRows) {
      sums[classifyAccount(r.type)] += r.endingBalance;
    }
    for (const k of Object.keys(buckets) as AccountClass[]) {
      buckets[k].push({ month: m, value: sums[k] });
    }
  }

  return (
    [AccountClass.Cash, AccountClass.Investments, AccountClass.Equity, AccountClass.Debt] as const
  ).map((klass) => ({
    klass,
    points: buckets[klass],
  }));
}

// `monthEnd` is re-exported here so callers don't have to reach for the
// queries module just to format an ISO date.
export { monthEnd };
