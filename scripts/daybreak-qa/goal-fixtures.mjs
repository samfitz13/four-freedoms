// Entirely synthetic. Used only by the disconnected Daybreak QA adapters.
import { buildFiPlan } from "../../lib/freedoms/fi-plan";
import { FI_PLANNING_DEFAULTS, EMPTY_ALLOCATION } from "../../lib/freedoms/constants";
const goalDefaults = {
  annualSpend: 60000,
  withdrawalRate: 0.04,
  realReturn: 0.05,
  monthlyContribution: 3000,
};
const goalDerived = {
  avgMonthlyContribution: 3900,
  realizedAnnualReturn: 0.119,
  monthsObserved: 12,
  oldestMonth: "2025-11-01",
  returnHistory: {
    annualNominalReturn: 0.119,
    monthsObserved: 12,
    skippedTransitions: 1,
    startMonth: "2025-09-01",
    endMonth: "2026-09-01",
  },
  trailingContributions: {
    average: 2800,
    monthsObserved: 11,
    windowStart: "2025-10-01",
    windowEnd: "2026-09-01",
  },
};
const goalAccounts = [
  { id: "qa-brokerage", name: "Sample brokerage", type: "brokerage", klass: "investments" },
  { id: "qa-checking", name: "Sample checking", type: "checking", klass: "cash" },
];
const goal = (id, title, kind, targetAmount, params, status = "active") => ({
  id,
  title,
  kind,
  targetAmount,
  params,
  status,
  householdId: "qa-household",
  targetDate: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
});
const goalFixtures = [
  goal("qa-fi", "Financial independence", "fi_number", "1500000", goalDefaults),
  {
    ...goal("qa-trip", "A longer summer abroad", "savings_milestone", "20000", {
      currentProgress: 6000,
    }),
    targetDate: "2027-06-01",
  },
  goal("qa-emergency", "Room for the unexpected", "emergency_fund", "60000", {
    linkedClass: "cash",
  }),
  goal("qa-linked", "Investing for more options", "net_worth_target", "500000", {
    linkedAccountIds: ["qa-brokerage"],
  }),
  goal(
    "qa-achieved",
    "Moving fund",
    "savings_milestone",
    "10000",
    { currentProgress: 12500 },
    "achieved",
  ),
  goal("qa-rate", "Keep saving consistently", "savings_rate_target", null, {
    targetRate: 0.3,
    window: 12,
  }),
  goal("qa-archived", "Archived goal", "savings_milestone", "5000", {}, "archived"),
];
const goalInvestedSeries = Array.from({ length: 12 }, (_, i) => ({
  month: new Date(Date.UTC(2025, 10 + i, 1)).toISOString().slice(0, 10),
  value: 150000 + i * (43800 / 11),
}));
const goalSavingsSeries = goalInvestedSeries.map(({ month }, i) => ({
  month,
  totalSaved: 3200 + i * 100,
  netIncome: 10000,
  savingsRate: 0.32 + i * 0.01,
}));

export function financialGoalFixtures() {
  return {
    goalDefaults,
    goalDerived,
    goalAccounts,
    goalFixtures,
    goalInvestedSeries,
    goalSavingsSeries,
  };
}

export function fiPlanFixture(scenario = "", empty = false) {
  const savings = scenario.startsWith("savings");
  const portfolio = [
    "portfolio",
    "retirement",
    "depletion",
    "short-retirement",
    "missing-allocation",
    "snapshot",
    "savings",
    "savings-included",
    "archived",
  ].includes(scenario);
  const params = portfolio
    ? {
        version: 2,
        returnMode: "portfolio",
        annualSpend: 60000,
        withdrawalRate: 0.04,
        realReturn: 0.05,
        downsideReduction: 0.02,
        useManualContribution: true,
        monthlyContribution: 2800,
        includedAccountIds:
          scenario === "savings-included" ? ["qa-brokerage", "qa-savings"] : ["qa-brokerage"],
        confirmedSnapshots: {},
        manualAllocations: ["missing-allocation", "snapshot"].includes(scenario)
          ? {}
          : {
              "qa-brokerage": {
                weights: { ...EMPTY_ALLOCATION, usEquity: 0.6, bonds: 0.3, cash: 0.1 },
                expenseRate: 0.001,
              },
            },
        assumptions: FI_PLANNING_DEFAULTS,
        retirementMonth:
          savings || ["portfolio", "missing-allocation", "snapshot"].includes(scenario)
            ? null
            : "2027-01-01",
        endMonth:
          savings || ["portfolio", "missing-allocation", "snapshot"].includes(scenario)
            ? null
            : scenario === "short-retirement"
              ? "2030-01-01"
              : "2060-01-01",
        monthlyRetirementIncome: 1000,
        incomeStartMonth: "2040-01-01",
      }
    : {
        ...goalDefaults,
        ...(scenario === "horizon"
          ? { realReturn: 0, monthlyContribution: 0, useManualContribution: true }
          : {}),
        ...(scenario === "manual" ? { useManualContribution: true } : {}),
      };
  return buildFiPlan({
    accounts: [
      {
        id: "qa-brokerage",
        name: "Sample brokerage",
        type: "brokerage",
        currency: "USD",
        isArchived: scenario === "archived",
      },
      { id: "qa-crypto", name: "Sample crypto", type: "crypto", currency: "USD" },
      ...(savings
        ? [{ id: "qa-savings", name: "Money market savings", type: "savings", currency: "USD" }]
        : []),
    ],
    statements:
      empty || scenario === "no-statements"
        ? []
        : goalInvestedSeries
            .filter((_, i) => i !== 1)
            .flatMap(({ month, value }) => [
              {
                accountId: "qa-brokerage",
                month,
                balance: value,
                contribution: 2800,
              },
              ...(savings
                ? [{ accountId: "qa-savings", month, balance: 50000, contribution: 500 }]
                : []),
            ]),
    snapshots:
      scenario === "snapshot"
        ? [
            {
              id: "qa-snapshot",
              accountId: "qa-brokerage",
              accountName: "Sample brokerage",
              currency: "USD",
              sourceKey: "fixture",
              preparedOn: "2026-08-01",
              data: {
                version: 1,
                prepared: "August 2026",
                priceAsOf: null,
                cash: {
                  amount: 10000,
                  basis: "reconstructed",
                  asOf: "2026-07-31",
                  note: "Synthetic cash",
                },
                funds: [
                  {
                    symbol: "MUB",
                    name: "Synthetic bond ETF",
                    short: "Bonds",
                    shares: 100,
                    price: 100,
                    average: 90,
                    expense: 0.05,
                    count: 1,
                    date: "2026-08-01",
                    source: 1,
                    index: "Municipal bonds",
                    role: "",
                    upside: "",
                    risk: "",
                    note: "",
                    holdings: [],
                  },
                ],
                sources: [],
              },
            },
          ]
        : [],
    currency: "USD",
    params: empty ? null : params,
    today: new Date("2026-11-01T00:00:00Z"),
  });
}
