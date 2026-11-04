import { buildFiAllocation, type FiAccountInput, type FiStatementInput } from "./fi-allocation";
import { parseFiSettings, fiMonthDistance, type FiParsedSettings } from "./fi-plan-settings";
import { summarizeFiContributions, resolveFiContribution } from "./fi-contributions";
import { buildFiReturnScenarios, portfolioRealReturn } from "./fi-scenarios";
import { buildFiStressTests } from "./fi-stress";
import type { InvestmentSnapshotView } from "@/lib/financial/portfolio/types";
import type { FiReturnScenario, MonthlyBalancePoint } from "./types";

export function buildFiPlan(input: {
  accounts: FiAccountInput[];
  statements: FiStatementInput[];
  snapshots: InvestmentSnapshotView[];
  currency: string;
  params: unknown;
  today: Date;
}) {
  const settings: FiParsedSettings | null = parseFiSettings(input.params);
  const portfolioSettings = settings?.version === 2 ? settings : null;
  const allocation = buildFiAllocation({ ...input, settings: portfolioSettings });
  const includedIds = new Set(allocation.coverage.filter((a) => a.included).map((a) => a.id));
  const byMonth = new Map<string, FiStatementInput[]>();
  const currentMonth = input.today.toISOString().slice(0, 7) + "-01";
  for (const row of input.statements) {
    if (!includedIds.has(row.accountId) || row.month >= currentMonth) continue;
    byMonth.set(row.month, [...(byMonth.get(row.month) ?? []), row]);
  }
  // Carry only an archived account's last known balance, never new contributions.
  // These are read-time values; no statement rows are created or changed.
  for (const account of allocation.coverage.filter((a) => a.included && a.archived)) {
    if (!account.statementMonth || account.balance === null) continue;
    for (const [month, rows] of byMonth) {
      if (month > account.statementMonth && !rows.some((r) => r.accountId === account.id))
        rows.push({ accountId: account.id, month, balance: account.balance, contribution: 0 });
    }
  }
  const completeMonths = [...byMonth].filter(
    ([, rows]) =>
      rows.length === includedIds.size &&
      new Set(rows.map((r) => r.accountId)).size === includedIds.size,
  );
  const trailingContributions = summarizeFiContributions(
    completeMonths.map(([month, rows]) => ({
      month,
      contribution: rows.reduce((sum, r) => sum + r.contribution, 0),
    })),
    input.today,
  );
  const alreadyRetired = Boolean(
    settings?.retirementMonth &&
    allocation.anchorMonth &&
    settings.retirementMonth <= allocation.anchorMonth,
  );
  const contribution = settings
    ? alreadyRetired
      ? 0
      : resolveFiContribution(
          trailingContributions,
          settings.useManualContribution,
          settings.monthlyContribution,
        )
    : null;
  const errors = [...allocation.errors];
  if (settings && contribution === null)
    errors.push("Add contribution statements or enter a monthly override, including zero.");
  if (settings?.returnMode === "portfolio" && !allocation.complete)
    errors.push("Confirm each snapshot or enter an allocation for every included account.");
  if (!allocation.anchorMonth) errors.push("Add statements to anchor this projection.");
  if (settings?.endMonth && allocation.anchorMonth && settings.endMonth <= allocation.anchorMonth)
    errors.push("Plan end must follow the latest statement month.");
  if (
    settings?.endMonth &&
    allocation.anchorMonth &&
    fiMonthDistance(allocation.anchorMonth, settings.endMonth) > 1800
  )
    errors.push("The projection supports a horizon of up to 150 years.");
  const actualSeries: MonthlyBalancePoint[] = completeMonths
    .map(([month, rows]) => ({
      month,
      balance: rows.reduce((sum, r) => sum + r.balance, 0),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
  let scenarios: FiReturnScenario[] = [];
  let stress: ReturnType<typeof buildFiStressTests> = {
    results: [],
    unavailable: "Set an FI plan first.",
  };
  if (settings && !errors.length && contribution !== null && allocation.anchorMonth) {
    const portfolio =
      portfolioSettings && allocation.complete
        ? {
            weights: allocation.weights,
            assumptions: portfolioSettings.assumptions,
            expenseRate: allocation.expenseRate,
          }
        : undefined;
    const projection = {
      startMonth: allocation.anchorMonth,
      startBalance: allocation.balance,
      monthlyContribution: contribution,
      realReturn: settings.realReturn,
      withdrawalRate: settings.withdrawalRate,
      targetAnnualSpend: settings.annualSpend,
      retirementMonth: settings.retirementMonth,
      endMonth: settings.endMonth,
      monthlyRetirementIncome: settings.monthlyRetirementIncome,
      incomeStartMonth: settings.incomeStartMonth,
    };
    scenarios = buildFiReturnScenarios({
      projection,
      downsideReduction: settings.downsideReduction,
      portfolio: settings.returnMode === "portfolio" ? portfolio : undefined,
    });
    const baseRate = scenarios.find((s) => s.kind === "base")!.realReturn!;
    stress = buildFiStressTests(
      { ...projection, realReturn: baseRate },
      portfolio
        ? portfolioRealReturn(
            portfolio.weights,
            portfolio.assumptions,
            portfolio.expenseRate,
            0,
            true,
          )
        : null,
    );
  }
  return {
    settings,
    allocation,
    trailingContributions,
    contribution,
    actualSeries,
    scenarios,
    stress,
    errors,
    plan: scenarios.find((s) => s.kind === "base")?.plan ?? null,
  };
}
export type { FiPlanView } from "./types";
