import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeFiContributions, resolveFiContribution } from "./fi-contributions";
import { planMonthlySeries } from "./fi-projection";

const asOf = new Date("2026-10-17T12:00:00Z");

test("averages only the last twelve completed calendar months, including employer matches rolled into monthly totals", () => {
  const points = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(Date.UTC(2025, 9 + i, 1)).toISOString().slice(0, 10),
    contribution: 2000,
  }));
  const result = summarizeFiContributions(
    [
      ...points,
      { month: "2026-09-01", contribution: 500 },
      { month: "2025-09-01", contribution: 999999 },
      { month: "2026-10-01", contribution: 999999 },
      { month: "2027-01-01", contribution: 999999 },
    ],
    asOf,
  );
  assert.equal(result.windowStart, "2025-10-01");
  assert.equal(result.windowEnd, "2026-09-01");
  assert.equal(result.monthsObserved, 12);
  assert.equal(result.average, 24500 / 12);
});

test("missing months remain unknown, recorded zero contributions remain zero", () => {
  const result = summarizeFiContributions(
    [
      { month: "2026-03-01", contribution: 3000 },
      { month: "2026-09-01", contribution: 0 },
      { month: "2026-09-01", contribution: NaN },
      { month: "not-a-month", contribution: 1000 },
    ],
    asOf,
  );
  assert.equal(result.monthsObserved, 2);
  assert.equal(result.average, 1500);
  assert.equal(summarizeFiContributions([], asOf).average, null);
  assert.equal(
    summarizeFiContributions([{ month: "2026-09-01", contribution: 0 }], asOf).average,
    0,
  );
});

test("UTC year boundaries exclude the current month even on its final day", () => {
  const result = summarizeFiContributions(
    [
      { month: "2025-01-01", contribution: 1000 },
      { month: "2025-12-01", contribution: 3000 },
      { month: "2026-01-01", contribution: 99999 },
    ],
    new Date("2026-01-31T23:59:59Z"),
  );
  assert.equal(result.windowStart, "2025-01-01");
  assert.equal(result.windowEnd, "2025-12-01");
  assert.equal(result.average, 2000);
});

test("automatic mode ignores legacy manual amounts; explicit override supports zero", () => {
  const history = summarizeFiContributions([{ month: "2026-09-01", contribution: 2800 }], asOf);
  assert.equal(resolveFiContribution(history, false, 9000), 2800);
  assert.equal(resolveFiContribution(history, true, 3000), 3000);
  assert.equal(resolveFiContribution(history, true, 0), 0);
  assert.equal(resolveFiContribution(history, true, Infinity), null);
  assert.equal(resolveFiContribution(history, true, -1), null);
  assert.equal(resolveFiContribution(history, true, undefined), null);
  assert.equal(resolveFiContribution(summarizeFiContributions([], asOf), false, 3000), null);
  const amount = resolveFiContribution(history, false, 9000)!;
  const plan = planMonthlySeries({
    startMonth: "2026-10-01",
    startBalance: 100000,
    monthlyContribution: amount,
    realReturn: 0,
    withdrawalRate: 0.04,
    targetAnnualSpend: 60000,
    horizonYears: 1,
  });
  assert.equal(plan.series[1]!.balance, 102800);
});
