import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFiAllocation, classifyFiEtf, fiSnapshotKey } from "./fi-allocation";
import { buildFiPlan } from "./fi-plan";
import {
  fiPlanSettingsSchema,
  parseFiSettings,
  resolveFiTiming,
  shiftFiMonth,
  FI_ASSUMPTION_VERSION,
  FI_ASSETS,
  FI_PLANNING_DEFAULTS,
  EMPTY_ALLOCATION,
} from "./fi-plan-settings";
import { planMonthlySeries } from "./fi-projection";
import { portfolioRealReturn } from "./fi-scenarios";
import { buildFiStressTests } from "./fi-stress";
import type { InvestmentSnapshotView } from "@/lib/financial/portfolio/types";
import type { FiPlanSettings } from "./types";

const accounts = [
  { id: "a", name: "Brokerage", type: "brokerage", currency: "USD" },
  { id: "b", name: "Retirement", type: "retirement", currency: "USD" },
  { id: "c", name: "Crypto", type: "crypto", currency: "USD" },
  { id: "d", name: "Company equity", type: "equity_comp", currency: "USD" },
  { id: "e", name: "Options", type: "iso_options", currency: "USD" },
];
const statements = [
  { accountId: "a", month: "2026-09-01", balance: 100000, contribution: 1000 },
  { accountId: "b", month: "2026-09-01", balance: 300000, contribution: 3000 },
  { accountId: "c", month: "2026-09-01", balance: 900000, contribution: 90000 },
];
function settings(): FiPlanSettings {
  return fiPlanSettingsSchema.parse({
    version: 2,
    returnMode: "portfolio",
    annualSpend: 48000,
    withdrawalRate: 0.04,
    realReturn: 0.045,
    downsideReduction: 0.02,
    monthlyContribution: 0,
    useManualContribution: false,
    includedAccountIds: ["a", "b"],
    manualAllocations: {
      a: { weights: { ...EMPTY_ALLOCATION, usEquity: 1 }, expenseRate: 0.001 },
      b: { weights: { ...EMPTY_ALLOCATION, bonds: 1 }, expenseRate: 0.002 },
    },
    confirmedSnapshots: {},
    assumptions: { ...FI_PLANNING_DEFAULTS },
    retirementMonth: "2040-01-01",
    endMonth: "2070-01-01",
    monthlyRetirementIncome: 0,
    incomeStartMonth: null,
  });
}
function input(params: unknown = settings()) {
  return {
    accounts,
    statements,
    snapshots: [],
    currency: "USD",
    params,
    today: new Date("2026-10-17T12:00:00Z"),
  };
}
function snapshot(): InvestmentSnapshotView {
  return {
    id: "snapshot",
    accountId: "a",
    accountName: "Brokerage",
    currency: "USD",
    preparedOn: "2026-08-01",
    sourceKey: "test",
    data: {
      version: 1,
      prepared: "August 2026",
      priceAsOf: null,
      cash: { amount: 200, basis: "reconstructed", asOf: "2026-07-31", note: "Synthetic" },
      funds: [
        {
          symbol: "MUB",
          shares: 8,
          price: 100,
          average: 90,
          expense: 0.05,
          name: "Bond fund",
          short: "Bonds",
          count: 1,
          date: "2026",
          source: 1,
          index: "Municipal",
          role: "",
          upside: "",
          risk: "",
          note: "",
          holdings: [],
        },
      ],
      sources: [],
    },
  };
}
const projection = {
  startMonth: "2026-09-01",
  startBalance: 10000,
  monthlyContribution: 1000,
  realReturn: 0,
  withdrawalRate: 0.04,
  targetAnnualSpend: 12000,
  endMonth: "2027-09-01",
  retirementMonth: "2026-12-01",
};

test("supported ETFs have explicit classes and municipal bonds remain bonds", () => {
  for (const ticker of ["IUSV", "IUSG", "VTWO"]) assert.equal(classifyFiEtf(ticker), "usEquity");
  assert.equal(classifyFiEtf("VEA"), "developedEquity");
  assert.equal(classifyFiEtf("VWO"), "emergingEquity");
  assert.equal(classifyFiEtf("MUB"), "bonds");
  assert.equal(classifyFiEtf("UNKNOWN"), null);
});
test("statement balances weight explicit account mixes, excluded records are untouched", () => {
  const original = structuredClone(input());
  const view = buildFiPlan(original);
  assert.deepEqual(view.errors, []);
  assert.equal(view.allocation.balance, 400000);
  assert.equal(view.allocation.weights.usEquity, 0.25);
  assert.equal(view.allocation.weights.bonds, 0.75);
  assert.equal(view.contribution, 4000);
  assert.equal(view.allocation.coverage.filter((a) => !a.eligible).length, 3);
  assert.deepEqual(original, input());
});
test("savings are opt-in for FI and use a 100% cash allocation without a snapshot", () => {
  const savings = { id: "s", name: "Money market savings", type: "savings", currency: "USD" };
  const rows = [
    ...statements,
    { accountId: "s", month: "2026-09-01", balance: 100000, contribution: 500 },
  ];
  const p = settings();
  const args = { ...input(p), accounts: [...accounts, savings], statements: rows };
  const existing = buildFiPlan(args);
  assert.equal(existing.allocation.balance, 400000);
  assert.equal(existing.contribution, 4000);
  assert.equal(existing.allocation.coverage.find((a) => a.id === "s")!.eligible, true);
  assert.equal(existing.allocation.coverage.find((a) => a.id === "s")!.included, false);
  const legacy = buildFiPlan({
    ...args,
    params: { annualSpend: 48000, useManualContribution: true, monthlyContribution: 0 },
  });
  assert.equal(legacy.allocation.balance, 400000);
  p.includedAccountIds.push("s");
  const included = buildFiPlan(args);
  assert.deepEqual(included.errors, []);
  assert.equal(included.allocation.balance, 500000);
  assert.equal(included.allocation.coveredBalance, 500000);
  assert.equal(included.allocation.weights.cash, 0.2);
  assert.equal(included.allocation.weights.usEquity, 0.2);
  assert.equal(included.contribution, 4500);
  const row = included.allocation.coverage.find((a) => a.id === "s")!;
  assert.deepEqual(row.allocation, { ...EMPTY_ALLOCATION, cash: 1 });
  assert.equal(row.source, "cash");
  assert.equal(row.expenseRate, 0);
  assert.equal(savings.type, "savings");
  const partialHistory = buildFiPlan({
    ...args,
    statements: [
      ...rows,
      { accountId: "a", month: "2026-08-01", balance: 90000, contribution: 10000 },
      { accountId: "b", month: "2026-08-01", balance: 290000, contribution: 30000 },
    ],
  });
  assert.equal(partialHistory.contribution, 4500);
  assert.equal(partialHistory.trailingContributions.monthsObserved, 1);
});
test("archiving preserves FI balances and history without requiring new statements", () => {
  const original = input();
  const before = buildFiPlan(original);
  const archivedAccounts = accounts.map((a) => ({ ...a, isArchived: a.id === "b" }));
  const after = buildFiPlan({ ...original, accounts: archivedAccounts });
  assert.deepEqual(after.actualSeries, before.actualSeries);
  assert.deepEqual(after.plan, before.plan);
  assert.equal(after.allocation.balance, before.allocation.balance);
  const advanced = buildFiPlan({
    ...original,
    accounts: archivedAccounts,
    today: new Date("2026-11-17T12:00:00Z"),
    statements: [
      ...statements,
      { accountId: "a", month: "2026-10-01", balance: 110000, contribution: 2000 },
    ],
  });
  assert.deepEqual(advanced.errors, []);
  assert.equal(advanced.allocation.balance, 410000);
  assert.deepEqual(advanced.actualSeries, [
    { month: "2026-09-01", balance: 400000 },
    { month: "2026-10-01", balance: 410000 },
  ]);
  assert.equal(advanced.contribution, 3000); // (4000 recorded + 2000 recorded) / two months.
  assert.equal(advanced.trailingContributions.monthsObserved, 2);
  assert.deepEqual(original, input()); // No synthetic statements were written.
});
test("archived FI accounts do not fill gaps before their last statement or hide missing balances", () => {
  const p = settings();
  const args = {
    ...input(p),
    accounts: accounts.map((a) => ({ ...a, isArchived: a.id === "b" })),
  };
  const missing = buildFiPlan({ ...args, statements: [statements[0]!] });
  assert.equal(missing.plan, null);
  const historyGap = buildFiPlan({
    ...args,
    statements: [
      ...statements,
      { accountId: "a", month: "2026-08-01", balance: 90000, contribution: 9000 },
    ],
  });
  assert.equal(historyGap.trailingContributions.monthsObserved, 1);
  assert.equal(historyGap.contribution, 4000);
});
test("a savings-only plan uses cash returns and ignores submitted equity allocations", () => {
  const p = settings();
  p.includedAccountIds = ["s"];
  p.manualAllocations.s = { weights: { ...EMPTY_ALLOCATION, usEquity: 1 }, expenseRate: 0.1 };
  const view = buildFiPlan({
    ...input(p),
    accounts: [{ id: "s", name: "Money market savings", type: "savings", currency: "USD" }],
    statements: [{ accountId: "s", month: "2026-09-01", balance: 50000, contribution: 0 }],
  });
  assert.deepEqual(view.errors, []);
  assert.equal(view.contribution, 0);
  assert.equal(view.allocation.expenseRate, 0);
  assert.deepEqual(view.allocation.weights, { ...EMPTY_ALLOCATION, cash: 1 });
  assert.equal(view.scenarios[0]!.realReturn, 0);
  assert.ok(Math.abs(view.scenarios[1]!.realReturn! - (1.025 / 1.03 - 1)) < 1e-12);
  assert.ok(Math.abs(view.scenarios[2]!.realReturn! - (1.035 / 1.03 - 1)) < 1e-12);
});
test("included savings still require aligned statements and the household currency", () => {
  const p = settings();
  p.includedAccountIds.push("s");
  const args = {
    ...input(p),
    accounts: [
      ...accounts,
      { id: "s", name: "Money market savings", type: "savings", currency: "USD" },
    ],
  };
  assert.equal(buildFiPlan(args).plan, null);
  assert.ok(
    buildFiPlan(args).errors.some((e) => e.includes("Money market savings: add a statement")),
  );
  const stale = buildFiPlan({
    ...args,
    statements: [
      ...statements,
      { accountId: "s", month: "2026-08-01", balance: 10000, contribution: 0 },
    ],
  });
  assert.equal(stale.plan, null);
  const foreign = buildFiPlan({
    ...args,
    accounts: args.accounts.map((a) => (a.id === "s" ? { ...a, currency: "EUR" } : a)),
    statements: [
      ...statements,
      { accountId: "s", month: "2026-09-01", balance: 10000, contribution: 0 },
    ],
  });
  assert.equal(foreign.plan, null);
  assert.ok(foreign.errors.some((e) => e.includes("currency must be USD")));
});
test("missing statements block the latest anchor, not a silently reduced or stale household balance", () => {
  const view = buildFiPlan({
    ...input(),
    statements: [statements[0]!, { ...statements[1]!, month: "2026-08-01" }],
  });
  assert.equal(view.plan, null);
  assert.ok(view.errors.some((e) => e.includes("Retirement: add a statement for 2026-09")));
  assert.equal(view.trailingContributions.average, null);
  assert.deepEqual(view.actualSeries, []);
  const missing = buildFiPlan({ ...input(), statements: [statements[0]!] });
  assert.equal(missing.plan, null);
});
test("foreign, unavailable, or unsupported included accounts block projections", () => {
  assert.equal(
    buildFiPlan({
      ...input(),
      accounts: accounts.map((a) => (a.id === "b" ? { ...a, currency: "EUR" } : a)),
    }).plan,
    null,
  );
  const p = settings();
  p.includedAccountIds.push("foreign");
  assert.equal(buildFiPlan(input(p)).plan, null);
  p.includedAccountIds = ["a", "c"];
  assert.ok(buildFiPlan(input(p)).errors.some((e) => e.includes("excluded")));
});
test("each account requires its own mix, totaling 100%, and no extrapolation fills a gap", () => {
  const p = settings();
  delete p.manualAllocations.b;
  const view = buildFiPlan(input(p));
  assert.equal(view.allocation.coveredBalance, 100000);
  assert.equal(view.allocation.complete, false);
  assert.equal(view.plan, null);
  p.manualAllocations.a!.weights.usEquity = 0.8;
  assert.equal(fiPlanSettingsSchema.safeParse(p).success, false);
});
test("unknown quote dates, reconstructed cash and mismatched dates need snapshot-specific confirmation", () => {
  const p = settings();
  delete p.manualAllocations.a;
  const snap = snapshot();
  const args = { ...input(p), snapshots: [snap], settings: p };
  const uncovered = buildFiAllocation(args);
  assert.equal(uncovered.complete, false);
  assert.ok(uncovered.coverage[0]!.warnings.includes("Quote date unknown"));
  assert.ok(uncovered.coverage[0]!.warnings.includes("Snapshot and statement months differ"));
  p.confirmedSnapshots.a = fiSnapshotKey(snap);
  const confirmed = buildFiAllocation({ ...args, settings: p });
  assert.equal(confirmed.balance, 400000); // Never add the snapshot's 1,000.
  assert.equal(confirmed.weights.cash, 0.05);
  assert.equal(confirmed.weights.bonds, 0.95);
  assert.ok(Math.abs(confirmed.expenseRate - (0.0004 * 0.25 + 0.002 * 0.75)) < 1e-12);
  snap.data.cash.amount = 300;
  assert.equal(buildFiAllocation({ ...args, settings: p }).complete, false);
});
test("snapshot currency cannot bypass household currency checks", () => {
  const p = settings();
  const snap = snapshot();
  snap.currency = "EUR";
  assert.equal(buildFiPlan({ ...input(p), snapshots: [snap] }).plan, null);
});
test("fees are deducted once and nominal inflation conversion is exact for all sensitivities", () => {
  const weights = { ...EMPTY_ALLOCATION, usEquity: 0.6, bonds: 0.3, cash: 0.1 };
  const assumptions = { ...FI_PLANNING_DEFAULTS, additionalFee: 0.004 };
  for (const sensitivity of [-1, 0, 1] as const) {
    const nominal =
      0.6 * (0.06 + sensitivity * 0.02) +
      0.3 * (0.04 + sensitivity * 0.01) +
      0.1 * (0.03 + sensitivity * 0.005);
    assert.ok(
      Math.abs(
        portfolioRealReturn(weights, assumptions, 0.001, sensitivity) -
          ((1 + nominal - 0.005) / 1.03 - 1),
      ) < 1e-12,
    );
  }
  assert.ok(
    Math.abs(
      portfolioRealReturn(weights, assumptions, 0.001, 0, true) -
        ((1 - 0.6 * 0.35 - 0.3 * 0.1 - 0.005) / 1.03 - 1),
    ) < 1e-12,
  );
});
test("retirement switches contributions to spending exactly at the resolved month", () => {
  const plan = planMonthlySeries(projection);
  assert.equal(plan.series[1]!.balance, 11000);
  assert.equal(plan.series[2]!.balance, 12000);
  assert.equal(plan.series[3]!.month, "2026-12-01");
  assert.equal(plan.series[3]!.balance, 11000);
  assert.equal(plan.series.at(-1)!.month, projection.endMonth);
  assert.equal(plan.series.at(-1)!.balance, 2000);
});
test("delayed income does not erase earlier unfunded spending or create negative debt", () => {
  const plan = planMonthlySeries({
    ...projection,
    startBalance: 500,
    retirementMonth: "2026-09-01",
    incomeStartMonth: "2027-01-01",
    monthlyRetirementIncome: 2000,
  });
  assert.equal(plan.firstShortfallMonth, "2026-10-01");
  assert.equal(plan.depletionMonth, "2026-10-01");
  assert.equal(plan.cumulativeShortfall, 2500);
  assert.equal(plan.series[3]!.balance, 0);
  assert.equal(plan.series[4]!.balance, 1000);
  assert.ok(plan.series.every((p) => p.balance >= 0));
  assert.equal(plan.series.at(-1)!.cumulativeShortfall, 2500);
});
test("zero contributions remain valid; already-retired plans need no employment history", () => {
  const p = settings();
  p.useManualContribution = true;
  p.monthlyContribution = 0;
  assert.equal(buildFiPlan(input(p)).contribution, 0);
  p.useManualContribution = false;
  p.retirementMonth = "2020-01-01";
  const view = buildFiPlan({ ...input(p), today: new Date("2028-01-01T00:00:00Z") });
  assert.equal(view.contribution, 0);
  assert.ok(view.plan);
});
test("first crossing persists after depletion and never automatically ends contributions", () => {
  const plan = planMonthlySeries({
    ...projection,
    startBalance: 299000,
    monthlyContribution: 1000,
    retirementMonth: "2026-12-01",
  });
  assert.equal(plan.fiMonth, "2026-10-01");
  assert.equal(plan.series[2]!.balance, 301000);
  assert.ok(plan.series.at(-1)!.balance < plan.fiNumber);
  assert.equal(plan.fiMonth, "2026-10-01");
});
test("stress ordering uses identical shock months, fees and flows, and remains deterministic", () => {
  const p = {
    ...projection,
    startBalance: 400000,
    realReturn: 0.03,
    retirementMonth: "2027-01-01",
    endMonth: "2057-01-01",
  };
  const result = buildFiStressTests(p, -0.3);
  assert.deepEqual(result, buildFiStressTests(p, -0.3));
  assert.equal(result.results.length, 2);
  const [early, late] = result.results;
  assert.equal(late!.shockMonth, shiftFiMonth(early!.shockMonth, 120));
  assert.ok(early!.plan.series.at(-1)!.balance < late!.plan.series.at(-1)!.balance);
  for (const row of result.results) {
    assert.equal(row.plan.series.length, early!.plan.series.length);
    const control = planMonthlySeries({ ...p, targetAnnualSpend: 0, monthlyContribution: 0 });
    assert.equal(row.plan.fiNumber, 300000);
    assert.ok(control.series.at(-1)!.balance > row.plan.series.at(-1)!.balance);
  }
  const noFlows = { ...p, monthlyContribution: 0, targetAnnualSpend: 0 };
  const reordered = buildFiStressTests(noFlows, -0.3).results;
  assert.ok(
    Math.abs(
      reordered[0]!.plan.series.at(-1)!.balance - reordered[1]!.plan.series.at(-1)!.balance,
    ) < 1e-6,
  );
});
test("short horizons and past retirement do not fabricate stress comparisons", () => {
  assert.equal(buildFiStressTests(projection, -0.3).results.length, 0);
  assert.equal(
    buildFiStressTests({ ...projection, retirementMonth: "2020-01-01" }, -0.3).results.length,
    0,
  );
  assert.equal(
    buildFiStressTests({ ...projection, retirementMonth: null }, -0.3).results.length,
    0,
  );
});
test("legacy plans remain explicitly manual accumulation plans without mutating saved JSON", () => {
  const raw = {
    annualSpend: "48000",
    realReturn: 0.071,
    monthlyContribution: 1234,
    useManualContribution: true,
  };
  const copy = structuredClone(raw);
  const parsed = parseFiSettings(raw)!;
  assert.equal(parsed.returnMode, "manual");
  assert.equal(parsed.realReturn, 0.071);
  assert.equal(parsed.retirementMonth, null);
  assert.equal(buildFiPlan(input(raw)).scenarios[0]!.realReturn, 0.071);
  assert.deepEqual(raw, copy);
  assert.equal(parseFiSettings({ version: 99, annualSpend: 48000 }), null);
  assert.equal(parseFiSettings({ annualSpend: -1 }), null);
});
test("timing resolves to the first monthly boundary at the entered age and survives another viewer", () => {
  const resolved = resolveFiTiming("", "65", "1991-02-15");
  assert.equal(resolved, "2056-03-01");
  assert.equal(resolveFiTiming(resolved!, "", "1980-10-01"), resolved);
  assert.equal(resolveFiTiming("", "65", "1991-02-01"), "2056-02-01");
  assert.equal(resolveFiTiming("2056-02", "", null), "2056-02-01");
  assert.throws(() => resolveFiTiming("", "65", null));
  assert.throws(() => resolveFiTiming("2056-13", "", null));
  const p = settings();
  p.endMonth = null;
  assert.equal(fiPlanSettingsSchema.safeParse(p).success, false);
});

test("public planning defaults match the settings schema and expose every allocation class", () => {
  assert.equal(FI_ASSUMPTION_VERSION, "planning-v1");
  assert.equal(FI_PLANNING_DEFAULTS.version, FI_ASSUMPTION_VERSION);
  assert.deepEqual(Object.keys(EMPTY_ALLOCATION), [...FI_ASSETS]);
  assert.equal(
    Object.values(EMPTY_ALLOCATION).reduce((sum, weight) => sum + weight, 0),
    0,
  );
  assert.deepEqual(fiPlanSettingsSchema.parse(settings()).assumptions, FI_PLANNING_DEFAULTS);
});

test("settings reject incomplete timing, reversed horizons and retirement income without a start", () => {
  for (const [overrides, message] of [
    [{ retirementMonth: null }, "Enter both retirement and plan-end timing."],
    [{ endMonth: "2039-12-01" }, "Plan end must follow retirement."],
    [{ endMonth: "2040-01-01" }, "Plan end must follow retirement."],
    [{ monthlyRetirementIncome: 100 }, "Enter the retirement income start month."],
  ] as const) {
    const invalid = { ...settings(), ...overrides };
    const result = fiPlanSettingsSchema.safeParse(invalid);
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.error.issues.some((issue) => issue.message === message));
    assert.equal(parseFiSettings(invalid), null);
  }
  const valid = { ...settings(), monthlyRetirementIncome: 100, incomeStartMonth: "2041-01-01" };
  assert.equal(fiPlanSettingsSchema.safeParse(valid).success, true);
});

test("legacy settings retain safe defaults for blank, nonnumeric and nonfinite stored values", () => {
  const parsed = parseFiSettings({
    version: 1,
    annualSpend: "48000",
    withdrawalRate: Infinity,
    realReturn: " ",
    downsideReduction: "not-a-number",
    monthlyContribution: null,
  })!;
  assert.equal(parsed.annualSpend, 48000);
  assert.equal(parsed.withdrawalRate, 0.04);
  assert.equal(parsed.realReturn, 0.05);
  assert.equal(parsed.downsideReduction, 0.02);
  assert.equal(parsed.monthlyContribution, 0);
  for (const invalid of [null, undefined, false, 123, {}, { annualSpend: " " }])
    assert.equal(parseFiSettings(invalid), null);
});

test("legacy settings reject unsafe financial assumptions while accepting documented boundaries", () => {
  for (const overrides of [
    { withdrawalRate: 0 },
    { withdrawalRate: 0.26 },
    { realReturn: -0.21 },
    { realReturn: 0.31 },
    { downsideReduction: 0 },
    { downsideReduction: 0.21 },
    { monthlyContribution: -1 },
  ])
    assert.equal(parseFiSettings({ annualSpend: 48000, ...overrides }), null);
  for (const overrides of [
    { withdrawalRate: 0.25 },
    { realReturn: -0.2 },
    { realReturn: 0.3 },
    { downsideReduction: 0.001 },
    { downsideReduction: 0.2 },
    { monthlyContribution: 0 },
  ])
    assert.notEqual(parseFiSettings({ annualSpend: 48000, ...overrides }), null);
});
