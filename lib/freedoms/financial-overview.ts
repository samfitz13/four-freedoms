import "server-only";
import {
  budgetActuals,
  cashflowByMonth,
  latestBalances,
  listAccounts,
  toNumber,
} from "@/lib/db/queries/financial";
import { listPaystubsForMonth, listStatementMonths, monthStart } from "@/lib/db/queries/statements";
import { getSavingsRateSeries } from "@/lib/freedoms/financial-derived";
import { computeRunwayEstimate } from "@/lib/freedoms/financial-runway";
import { computeMonthlyRollup } from "@/lib/freedoms/financial-statements";
import { getHouseholdFiPlan } from "./fi-plan-server";
import {
  AccountClass,
  FinancialAttentionVerdict,
  FinancialFiVerdict,
  FinancialHealthVerdict,
} from "@/lib/freedoms/enums";
import type {
  FinancialOverviewAttention,
  FinancialOverviewBalanceRow,
  FinancialOverviewData,
  FinancialOverviewIncomeQuality,
  FinancialOverviewMovement,
} from "@/lib/freedoms/types";

export async function computeFinancialOverview(
  householdId: string,
  today: Date = new Date(),
): Promise<FinancialOverviewData> {
  const currentMonth = monthStart(today);
  const expectedStatementMonth = statementMonthDue(today);
  const [accounts, balances, months, cashflowMonths, fiView, budget, savingsSeries] =
    await Promise.all([
      listAccounts(householdId),
      latestBalances(householdId),
      listStatementMonths(householdId),
      cashflowByMonth(householdId, 12, { fromEarliest: true }),
      getHouseholdFiPlan(householdId, today),
      budgetActuals(householdId, expectedStatementMonth),
      getSavingsRateSeries(householdId, 6),
    ]);

  const latestMonth = months[0] ?? null;
  const latestRollup = latestMonth ? await computeMonthlyRollup(householdId, latestMonth) : null;
  const paystubsThisMonth = latestMonth ? await listPaystubsForMonth(householdId, latestMonth) : [];
  const monthlyFlow = latestMonth
    ? (cashflowMonths.find((m) => m.month === latestMonth) ?? null)
    : (cashflowMonths.at(-1) ?? null);

  const runway = computeRunwayEstimate({ balances, months: cashflowMonths, currentMonth });
  const fi = fiView.settings;
  const fiNumber = fi ? fi.annualSpend / fi.withdrawalRate : null;
  const invested = fiView.allocation.balance;
  const fiProgress =
    fiNumber !== null && fiNumber > 0 && !fiView.errors.length ? invested / fiNumber : null;
  const monthlyContribution = fiView.contribution;
  const fiPlan = fiView.plan;

  const movementBridge = buildMovementBridge(latestRollup);
  const incomeQuality = buildIncomeQuality({
    latestRollup,
    monthlyFlow,
    paystubRows: paystubsThisMonth.length,
    employerMatch: paystubsThisMonth.reduce((sum, p) => sum + toNumber(p.employerMatch), 0),
    savingsSeries,
  });
  const balanceSheet = buildBalanceSheet(latestRollup, balances);
  const attention = buildAttention({
    expectedStatementMonth,
    latestMonth,
    accountsCount: balances.length,
    balances: balances.filter((b) => accounts.some((a) => a.id === b.accountId)),
    latestRollup,
    budget,
    fiNumber,
    paystubRows: paystubsThisMonth.length,
  });
  const verdict = buildVerdict({
    movementBridge,
    fiProgress,
    monthlyContribution,
    attention,
    latestMonth,
    expectedStatementMonth,
  });

  return {
    month: latestMonth,
    verdict,
    activeAccounts: accounts.length,
    kpis: {
      netWorth: latestRollup?.netWorth ?? null,
      netWorthDelta: latestRollup?.delta ?? null,
      netWorthDeltaPct: latestRollup?.deltaPct ?? null,
      savedThisMonth: latestRollup?.totalSaved ?? null,
      savingsRate: latestRollup?.savingsRate ?? null,
      gainLoss: movementBridge.gainLoss + movementBridge.debtDrag,
      fiProgress,
      runwayMonths: runway.months,
    },
    balanceSheet,
    runway,
    movementBridge,
    incomeQuality,
    fiTrack: {
      fiNumber,
      invested,
      gap: fiNumber !== null ? Math.max(0, fiNumber - invested) : null,
      progress: fiProgress,
      monthsToFi: fiPlan?.monthsToFi ?? null,
      monthlyContribution,
      annualSpend: fi?.annualSpend ?? null,
      withdrawalRate: fi?.withdrawalRate ?? null,
      projection: fiView,
    },
    attention,
  };
}

function buildMovementBridge(
  rollup: Awaited<ReturnType<typeof computeMonthlyRollup>> | null,
): FinancialOverviewMovement {
  if (!rollup) {
    return { start: null, saved: 0, employerMatch: 0, gainLoss: 0, debtDrag: 0, end: null };
  }
  const saved = rollup.rows
    .filter((r) => r.klass === AccountClass.Cash || r.klass === AccountClass.Investments)
    .reduce((sum, r) => sum + r.employeeContribution, 0);
  const employerMatch = rollup.rows
    .filter((r) => r.klass === AccountClass.Cash || r.klass === AccountClass.Investments)
    .reduce((sum, r) => sum + r.employerMatch, 0);
  const debtDrag = rollup.rows
    .filter((r) => r.klass === AccountClass.Debt)
    .reduce((sum, r) => sum - Math.abs(r.gain), 0);
  const gainLoss = rollup.rows
    .filter((r) => r.klass !== AccountClass.Debt)
    .reduce((sum, r) => sum + r.gain, 0);
  return {
    start: rollup.netWorthPrev,
    saved,
    employerMatch,
    gainLoss,
    debtDrag,
    end: rollup.netWorth,
  };
}

function buildIncomeQuality(input: {
  latestRollup: Awaited<ReturnType<typeof computeMonthlyRollup>> | null;
  monthlyFlow: { income: number; expense: number } | null;
  paystubRows: number;
  employerMatch: number;
  savingsSeries: Array<{ month: string; savingsRate: number | null }>;
}): FinancialOverviewIncomeQuality {
  const paystubNet = input.latestRollup?.netIncomeFromPaystubs ?? 0;
  const cashflowIncome =
    input.latestRollup?.netIncomeFromCashflow ?? input.monthlyFlow?.income ?? 0;
  const expenses = input.latestRollup?.expenses ?? input.monthlyFlow?.expense ?? 0;
  const saved = input.latestRollup?.totalSaved ?? 0;
  const drift = paystubNet > 0 && cashflowIncome > 0 ? paystubNet - cashflowIncome : null;
  return {
    paystubNet,
    cashflowIncome,
    expenses,
    saved,
    savingsRate: input.latestRollup?.savingsRate ?? null,
    drift,
    paystubRows: input.paystubRows,
    employerMatch: input.employerMatch,
    savingsSeries: input.savingsSeries.map((p) => ({ month: p.month, savingsRate: p.savingsRate })),
  };
}

function buildBalanceSheet(
  rollup: Awaited<ReturnType<typeof computeMonthlyRollup>> | null,
  balances: Awaited<ReturnType<typeof latestBalances>>,
) {
  if (rollup) {
    const rows = rollup.composition.map((point) => ({
      label: labelClass(point.klass),
      value: point.klass === AccountClass.Debt ? -Math.abs(point.value) : point.value,
      klass: point.klass,
    }));
    return rowsToBalanceSheet(rows, rollup.netWorth);
  }
  const byClass = new Map<AccountClass, number>();
  for (const balance of balances) {
    const klass =
      balance.type === "loan" || balance.type === "credit_card"
        ? AccountClass.Debt
        : balance.type === "checking" || balance.type === "savings"
          ? AccountClass.Cash
          : balance.type === "brokerage" ||
              balance.type === "retirement" ||
              balance.type === "crypto"
            ? AccountClass.Investments
            : balance.type === "real_estate"
              ? AccountClass.Equity
              : AccountClass.Other;
    const signed = klass === AccountClass.Debt ? -Math.abs(balance.balance) : balance.balance;
    byClass.set(klass, (byClass.get(klass) ?? 0) + signed);
  }
  const rows = [...byClass].map(([klass, value]) => ({ label: labelClass(klass), value, klass }));
  const netWorth = rows.reduce((sum, row) => sum + row.value, 0);
  return rowsToBalanceSheet(rows, rows.length > 0 ? netWorth : null);
}

function rowsToBalanceSheet(
  rows: Array<{ label: string; value: number; klass: AccountClass }>,
  netWorth: number | null,
) {
  const positiveTotal = rows.filter((r) => r.value > 0).reduce((sum, row) => sum + row.value, 0);
  const mapped: FinancialOverviewBalanceRow[] = rows
    .filter((row) => row.value !== 0)
    .map((row) => ({
      label: row.label,
      value: row.value,
      share: row.value > 0 && positiveTotal > 0 ? row.value / positiveTotal : null,
      klass: row.klass,
    }));
  return {
    assets: mapped.filter((row) => row.value > 0),
    liabilities: mapped.filter((row) => row.value < 0),
    netWorth,
  };
}

function buildAttention(input: {
  expectedStatementMonth: string;
  latestMonth: string | null;
  accountsCount: number;
  balances: Awaited<ReturnType<typeof latestBalances>>;
  latestRollup: Awaited<ReturnType<typeof computeMonthlyRollup>> | null;
  budget: Awaited<ReturnType<typeof budgetActuals>>;
  fiNumber: number | null;
  paystubRows: number;
}): FinancialOverviewAttention[] {
  const out: FinancialOverviewAttention[] = [];
  if (input.accountsCount === 0) {
    return [
      {
        title: "No accounts yet",
        detail: "Add accounts before the board report can answer anything.",
        href: "/financial/accounts",
      },
    ];
  }
  if (
    input.balances.length > 0 &&
    (input.latestMonth === null || input.latestMonth < input.expectedStatementMonth)
  ) {
    out.push({
      title: "Closed statement missing",
      detail: `Update ${monthLabel(input.expectedStatementMonth)} balances once bank statements are available.`,
      href: `/financial/statements?month=${input.expectedStatementMonth}`,
    });
  }
  const drift =
    input.latestRollup &&
    input.latestRollup.netIncomeFromPaystubs > 0 &&
    input.latestRollup.netIncomeFromCashflow > 0
      ? input.latestRollup.netIncomeFromPaystubs - input.latestRollup.netIncomeFromCashflow
      : null;
  if (drift !== null && Math.abs(drift) > 50) {
    out.push({
      title: "Income drift",
      detail: `Paystubs and cashflow differ by ${formatMoney(Math.abs(drift))}.`,
      href: "/financial/income",
    });
  }
  const matchFlag = input.latestRollup?.rows
    .flatMap((row) => row.flags)
    .find((flag) => flag.kind === "paystub_match_drift");
  if (matchFlag) {
    out.push({
      title: "401(k) match mismatch",
      detail: `Paystubs and statements differ by ${formatMoney(Math.abs(matchFlag.delta))}.`,
      href: "/financial/statements",
    });
  }
  const stale = input.balances.filter((b) => !b.asOf || b.asOf < input.expectedStatementMonth);
  if (stale.length > 0) {
    out.push({
      title: `${stale.length} stale ${stale.length === 1 ? "balance" : "balances"}`,
      detail: `${stale[0]!.accountName} is not current${stale.length > 1 ? " (and others)" : ""}.`,
      href: "/financial/statements",
    });
  }
  const overPlan = input.budget.filter((row) => row.planned > 0 && row.actual > row.planned);
  if (overPlan.length > 0) {
    const worst = overPlan.sort((a, b) => b.actual - b.planned - (a.actual - a.planned))[0]!;
    out.push({
      title: "Budget over plan",
      detail: `${worst.name} is over by ${formatMoney(worst.actual - worst.planned)}.`,
      href: "/financial/cashflow",
    });
  }
  if (input.fiNumber === null) {
    out.push({
      title: "FI assumptions missing",
      detail: "Set annual spend and withdrawal assumptions.",
      href: "/financial/goals",
    });
  }
  if (input.paystubRows === 0) {
    out.push({
      title: "No paystubs for report month",
      detail: "Income will rely on cashflow until paystubs are entered.",
      href: "/financial/income",
    });
  }
  if (out.length === 0) {
    out.push({
      title: "No obvious gaps",
      detail: "The latest closed month is reconciled enough for a high-level read.",
      href: "/financial/statements",
    });
  }
  return out.slice(0, 5);
}

function buildVerdict(input: {
  movementBridge: FinancialOverviewMovement;
  fiProgress: number | null;
  monthlyContribution: number | null;
  attention: FinancialOverviewAttention[];
  latestMonth: string | null;
  expectedStatementMonth: string;
}) {
  const delta =
    input.movementBridge.end !== null && input.movementBridge.start !== null
      ? input.movementBridge.end - input.movementBridge.start
      : null;
  const health =
    delta === null
      ? FinancialHealthVerdict.Unknown
      : Math.abs(delta) < 100
        ? FinancialHealthVerdict.Flat
        : delta > 0
          ? FinancialHealthVerdict.Healthier
          : FinancialHealthVerdict.Weaker;
  const fi =
    input.fiProgress === null
      ? FinancialFiVerdict.MissingAssumptions
      : (input.monthlyContribution ?? 0) > 0 || input.fiProgress >= 1
        ? FinancialFiVerdict.OnTrack
        : FinancialFiVerdict.Underfunded;
  const attention =
    input.latestMonth === null || input.latestMonth < input.expectedStatementMonth
      ? FinancialAttentionVerdict.MissingData
      : input.attention.length > 1 || input.attention[0]?.title !== "No obvious gaps"
        ? FinancialAttentionVerdict.Review
        : FinancialAttentionVerdict.Clear;
  return {
    health,
    fi,
    attention,
    sentence: `${labelHealth(health)}. ${labelFi(fi)}. ${labelAttention(attention)}.`,
  };
}

function labelClass(klass: AccountClass): string {
  switch (klass) {
    case AccountClass.Cash:
      return "Cash";
    case AccountClass.Investments:
      return "Investments";
    case AccountClass.Equity:
      return "Equity";
    case AccountClass.Debt:
      return "Debt";
    default:
      return "Other";
  }
}

function labelHealth(verdict: FinancialHealthVerdict): string {
  switch (verdict) {
    case FinancialHealthVerdict.Healthier:
      return "Healthier than last month";
    case FinancialHealthVerdict.Weaker:
      return "Weaker than last month";
    case FinancialHealthVerdict.Flat:
      return "Flat versus last month";
    default:
      return "Health needs more data";
  }
}

function labelFi(verdict: FinancialFiVerdict): string {
  switch (verdict) {
    case FinancialFiVerdict.OnTrack:
      return "FI track intact";
    case FinancialFiVerdict.Underfunded:
      return "FI track needs more funding";
    default:
      return "FI assumptions missing";
  }
}

function labelAttention(verdict: FinancialAttentionVerdict): string {
  switch (verdict) {
    case FinancialAttentionVerdict.Clear:
      return "No obvious gaps";
    case FinancialAttentionVerdict.MissingData:
      return "Data is missing";
    default:
      return "Review needed";
  }
}

function statementMonthDue(today: Date): string {
  const graceMonthsBack = today.getUTCDate() <= 5 ? 2 : 1;
  return monthStart(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - graceMonthsBack, 1)),
  );
}

function monthLabel(month: string): string {
  const d = new Date(`${month}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return month;
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(d);
}

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}
