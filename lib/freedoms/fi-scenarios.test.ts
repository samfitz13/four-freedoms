import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateFiReturnHistory } from "./fi-return-history";
import { buildFiReturnScenarios, nominalToRealReturn } from "./fi-scenarios";
import { planMonthlySeries, projectFi } from "./fi-projection";
import type { FiReturnStatement } from "./types";

const asOf = new Date("2026-10-17T12:00:00Z");
const projection = {
  startMonth: "2026-10-01",
  startBalance: 193800,
  monthlyContribution: 2800,
  realReturn: 0.05,
  withdrawalRate: 0.04,
  targetAnnualSpend: 60000,
};
const history = {
  annualNominalReturn: 0.119,
  monthsObserved: 24,
  skippedTransitions: 0,
  startMonth: "2024-09-01",
  endMonth: "2026-09-01",
};

function statements(count = 13): FiReturnStatement[] {
  let balance = 1000;
  return Array.from({ length: count }, (_, i) => {
    if (i > 0) balance = balance * 1.01 + 100;
    return {
      accountId: "invested",
      month: new Date(Date.UTC(2024, i, 1)).toISOString().slice(0, 10),
      balance,
      contribution: i > 0 ? 100 : 0,
    };
  });
}

test("real returns use the exact inflation conversion, not percentage subtraction", () => {
  assert.ok(Math.abs(nominalToRealReturn(0.119, 0.03)! - 0.08640776699) < 1e-10);
  assert.equal(nominalToRealReturn(0.05, 0), 0.050000000000000044);
  assert.ok(nominalToRealReturn(0.02, 0.03)! < 0);
  assert.equal(nominalToRealReturn(Infinity, 0.03), null);
  assert.equal(nominalToRealReturn(0.1, -1), null);
  assert.equal(nominalToRealReturn(-1, 0.03), null);
});

test("annual returns compound to exactly their labeled annual rate", () => {
  for (const rate of [0.05, 0, -0.05]) {
    const plan = planMonthlySeries({
      ...projection,
      startBalance: 100000,
      monthlyContribution: 0,
      realReturn: rate,
      horizonYears: 1,
    });
    assert.ok(Math.abs(plan.series[12]!.balance - 100000 * (1 + rate)) < 1e-8);
    const years = projectFi({
      currentInvested: 100000,
      monthlyContribution: 0,
      realReturn: rate,
      targetAnnualSpend: 60000,
      horizonYears: 1,
    });
    assert.ok(Math.abs(years.years[1]!.balance - plan.series[12]!.balance) < 1e-8);
  }
});

test("projections continue through the horizon and retain their first FI crossing", () => {
  const plan = planMonthlySeries(projection);
  assert.equal(plan.series.length, 601);
  assert.equal(plan.fiMonth, "2045-06-01");
  assert.ok(plan.series[plan.monthsToFi!]!.balance >= plan.fiNumber);
  assert.ok(plan.series[plan.monthsToFi! - 1]!.balance < plan.fiNumber);
  assert.ok(plan.series.at(-1)!.balance > plan.series[plan.monthsToFi!]!.balance);
  const yearly = projectFi({ currentInvested: projection.startBalance, ...projection });
  assert.equal(yearly.years.length, 51);
  assert.ok(yearly.yearsToFi! < 50);
  const already = projectFi({
    currentInvested: 1600000,
    monthlyContribution: 0,
    targetAnnualSpend: 60000,
    realReturn: -0.1,
  });
  assert.equal(already.yearsToFi, 0);
  assert.equal(already.years.length, 51);
  assert.ok(already.years.at(-1)!.balance < already.fiNumber);
});

test("historical estimate removes contributions and geometrically annualizes monthly returns", () => {
  const rows = statements();
  const original = structuredClone(rows);
  const result = estimateFiReturnHistory(rows, asOf);
  assert.equal(result.monthsObserved, 12);
  assert.equal(result.skippedTransitions, 0);
  assert.ok(Math.abs(result.annualNominalReturn! - (1.01 ** 12 - 1)) < 1e-12);
  assert.equal(result.startMonth, "2024-01-01");
  assert.equal(result.endMonth, "2025-01-01");
  assert.deepEqual(rows, original);
});

test("new or missing accounts cannot create a false portfolio return", () => {
  const rows = [
    { accountId: "a", month: "2026-01-01", balance: 1000, contribution: 0 },
    { accountId: "a", month: "2026-02-01", balance: 1010, contribution: 0 },
    { accountId: "b", month: "2026-02-01", balance: 100000, contribution: 0 },
    { accountId: "a", month: "2026-03-01", balance: 1020.1, contribution: 0 },
    { accountId: "b", month: "2026-03-01", balance: 101000, contribution: 0 },
  ];
  const result = estimateFiReturnHistory(rows, asOf);
  assert.equal(result.skippedTransitions, 1);
  assert.equal(result.monthsObserved, 1);
  assert.ok(Math.abs(result.annualNominalReturn! - (1.01 ** 12 - 1)) < 1e-12);
});

test("gaps, current months, invalid balances and duplicate accounts are not filled or clipped", () => {
  const row = { accountId: "a", month: "2026-01-01", balance: 1000, contribution: 0 };
  const result = estimateFiReturnHistory(
    [
      row,
      { ...row, month: "2026-03-01", balance: 5000 },
      { ...row, month: "2026-04-01", balance: 5050 },
      { ...row, month: "2026-10-01", balance: 99999 },
      { ...row, month: "2027-01-01", balance: 99999 },
    ],
    asOf,
  );
  assert.equal(result.monthsObserved, 1);
  assert.equal(result.skippedTransitions, 1);
  assert.equal(result.endMonth, "2026-04-01");
  assert.equal(
    estimateFiReturnHistory([row, { ...row, month: "2026-02-01", balance: NaN }], asOf)
      .annualNominalReturn,
    null,
  );
  assert.equal(
    estimateFiReturnHistory([row, row, { ...row, month: "2026-02-01" }], asOf).annualNominalReturn,
    null,
  );
  assert.equal(estimateFiReturnHistory([], asOf).annualNominalReturn, null);
});

test("a recorded transfer between existing accounts cancels at portfolio level", () => {
  const result = estimateFiReturnHistory(
    [
      { accountId: "a", month: "2026-01-01", balance: 1000, contribution: 0 },
      { accountId: "b", month: "2026-01-01", balance: 1000, contribution: 0 },
      { accountId: "a", month: "2026-02-01", balance: 500, contribution: 0 },
      { accountId: "b", month: "2026-02-01", balance: 1500, contribution: 0 },
    ],
    asOf,
  );
  assert.equal(result.annualNominalReturn, 0);
});

test("scenarios alter only returns and never mutate or replace the base plan", () => {
  const original = structuredClone(projection);
  const scenarios = buildFiReturnScenarios({ projection, history });
  const [base, downside, upside] = scenarios;
  assert.equal(base!.realReturn, 0.05);
  assert.equal(downside!.realReturn, 0.05 - 0.02);
  assert.equal(upside!.realReturn, 0.05 + 0.02);
  for (const scenario of scenarios) {
    assert.equal(scenario.plan!.fiNumber, 1500000);
    assert.deepEqual(scenario.plan!.series[0], {
      month: projection.startMonth,
      balance: projection.startBalance,
    });
    const rate = Math.pow(1 + scenario.realReturn!, 1 / 12) - 1;
    assert.ok(Math.abs(scenario.plan!.series[1]!.balance - (193800 * (1 + rate) + 2800)) < 1e-8);
  }
  assert.ok(downside!.plan!.monthsToFi! > base!.plan!.monthsToFi!);
  assert.ok(upside!.plan!.monthsToFi! < base!.plan!.monthsToFi!);
  assert.deepEqual(projection, original);
  assert.deepEqual(base!.plan, planMonthlySeries(projection));
});

test("history never supplies or disables a forecast return", () => {
  for (const value of [
    { ...history, monthsObserved: 11 },
    { ...history, annualNominalReturn: null },
  ]) {
    const scenarios = buildFiReturnScenarios({ projection, history: value });
    assert.deepEqual(scenarios, buildFiReturnScenarios({ projection }));
    assert.equal(scenarios[2]!.realReturn, 0.07);
    assert.ok(scenarios[0]!.plan);
  }
});

test("manual sensitivities are symmetric and do not use historical inflation comparisons", () => {
  const scenarios = buildFiReturnScenarios({
    projection,
    history,
    inflationRate: 0.04,
    downsideReduction: 0.07,
  });
  assert.equal(scenarios[0]!.realReturn, 0.05);
  assert.equal(scenarios[1]!.realReturn, 0.05 - 0.07);
  assert.equal(scenarios[2]!.realReturn, 0.05 + 0.07);
  assert.equal(scenarios[1]!.plan!.fiMonth, null);
  assert.equal(scenarios[1]!.plan!.series.length, 601);
});
