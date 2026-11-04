import assert from "node:assert/strict";
import { test } from "node:test";
import { planMonthlySeries } from "@/lib/freedoms/fi-projection";
import {
  buildFiChartModel,
  fiMonthIndex,
  fiMonthString,
  nearestFiSample,
  smoothFiPath,
} from "./fi-chart-model";

const assumptions = {
  startMonth: "2026-10-01",
  startBalance: 193800,
  monthlyContribution: 3000,
  realReturn: 0.05,
  withdrawalRate: 0.04,
  targetAnnualSpend: 60000,
};

test("scenario lines share dates and scale; higher returns rise faster and reach FI earlier", () => {
  const base = planMonthlySeries(assumptions);
  const high = planMonthlySeries({ ...assumptions, realReturn: 0.09 });
  const low = planMonthlySeries({ ...assumptions, realReturn: 0.03 });
  const comparisonSeries = [
    { kind: "base" as const, title: "Base plan", series: base.series, fiMonth: base.fiMonth },
    { kind: "downside" as const, title: "Lower return", series: low.series, fiMonth: low.fiMonth },
    {
      kind: "upside" as const,
      title: "Upside",
      series: high.series,
      fiMonth: high.fiMonth,
    },
  ];
  const original = structuredClone(comparisonSeries);
  const models = [base, high, low].map(
    (plan) =>
      buildFiChartModel({
        planSeries: plan.series,
        comparisonSeries,
        fiNumber: base.fiNumber,
      })!,
  );
  for (const model of models) {
    assert.equal(model.comparisons.length, 3);
    assert.equal(model.end, fiMonthIndex("2076-10-01"));
    assert.deepEqual(
      [model.start, model.end, model.yMin, model.yMax],
      [models[0]!.start, models[0]!.end, models[0]!.yMin, models[0]!.yMax],
    );
  }
  assert.equal(high.series[12]!.month, base.series[12]!.month);
  assert.ok(high.series[12]!.balance > base.series[12]!.balance);
  assert.ok(base.series[12]!.balance > low.series[12]!.balance);
  assert.ok(high.fiMonth! < base.fiMonth! && base.fiMonth! < low.fiMonth!);
  assert.deepEqual(comparisonSeries, original);
});

test("near-term comparison clips all lines to the same calendar window without extending them", () => {
  const base = planMonthlySeries(assumptions);
  const short = planMonthlySeries({
    ...assumptions,
    startBalance: 1490000,
    realReturn: 0.09,
    horizonYears: 1,
  });
  const model = buildFiChartModel(
    {
      planSeries: base.series,
      fiNumber: base.fiNumber,
      comparisonSeries: [
        {
          kind: "upside",
          title: "Upside",
          series: short.series,
          fiMonth: short.fiMonth,
        },
      ],
    },
    true,
  )!;
  assert.equal(model.end, fiMonthIndex("2031-10-01"));
  assert.equal(model.comparisons[0]!.series.length, short.series.length);
  assert.equal(model.plan.at(-1)!.month, "2031-10-01");
});

test("comparison values are included in the scale and invalid samples never become chart points", () => {
  const model = buildFiChartModel({
    planSeries: [{ month: "2026-01-01", balance: 100 }],
    fiNumber: 1000,
    comparisonSeries: [
      {
        kind: "upside",
        title: "Upside",
        fiMonth: null,
        series: [
          { month: "invalid", balance: 50000 },
          { month: "2026-02-01", balance: Infinity },
          { month: "2026-03-01", balance: -500 },
          { month: "2026-04-01", balance: 2500 },
        ],
      },
    ],
  })!;
  assert.equal(model.comparisons[0]!.series.length, 2);
  assert.equal(model.samples.length, 3);
  assert.equal(model.end, fiMonthIndex("2026-04-01"));
  assert.ok(model.yMin <= -500 && model.yMax >= 2500);
});

test("forecast begins at latest recorded balance and preserves real compounding", () => {
  const plan = planMonthlySeries(assumptions);
  assert.equal(plan.series[0]!.balance, 193800);
  assert.equal(plan.series[1]!.balance, 193800 * Math.pow(1.05, 1 / 12) + 3000);
  assert.equal(plan.fiNumber, 1500000);
  assert.equal(plan.series.length, 601);
  assert.ok(plan.series[plan.monthsToFi!]!.balance >= plan.fiNumber);
  assert.ok(plan.series[plan.monthsToFi! - 1]!.balance < plan.fiNumber);
  assert.ok(plan.series.at(-1)!.month > plan.fiMonth!);
});

test("already at FI preserves the anchor crossing and continues with declining future returns", () => {
  const plan = planMonthlySeries({
    ...assumptions,
    startBalance: 1600000,
    monthlyContribution: 0,
    realReturn: -0.1,
  });
  assert.equal(plan.monthsToFi, 0);
  assert.equal(plan.fiMonth, assumptions.startMonth);
  assert.equal(plan.series.length, 601);
  assert.ok(plan.series.at(-1)!.balance < plan.fiNumber);
  const model = buildFiChartModel({ planSeries: plan.series, fiNumber: plan.fiNumber })!;
  assert.equal(model.samples.length, 601);
  assert.ok(model.end > model.start);
});

test("unreached plan keeps the full 50-year horizon without inventing a crossing", () => {
  const plan = planMonthlySeries({ ...assumptions, monthlyContribution: 0, realReturn: 0 });
  assert.equal(plan.fiMonth, null);
  assert.equal(plan.monthsToFi, null);
  assert.equal(plan.series.length, 601);
});

test("history is solid data only; shared anchor is recorded, not duplicated", () => {
  const plan = planMonthlySeries(assumptions);
  const actual = [
    { month: "2025-11-01", balance: 150000 },
    { month: "2026-10-01", balance: 193800 },
  ];
  const model = buildFiChartModel({
    planSeries: plan.series,
    actualSeries: actual,
    fiNumber: plan.fiNumber,
  })!;
  assert.equal(model.start, fiMonthIndex("2025-11-01"));
  assert.equal(model.actual.length, 2);
  assert.equal(model.samples.length, plan.series.length + 1);
  assert.equal(model.samples[1]!.recorded, true);
  assert.equal(model.samples[2]!.recorded, false);
  assert.equal(
    model.samples[nearestFiSample(model, fiMonthIndex("2026-01-01")!)]!.month,
    "2025-11-01",
  );
  assert.deepEqual(actual, model.actual);
});

test("near-term view retains recent history and caps forecast at five years", () => {
  const plan = planMonthlySeries(assumptions);
  const model = buildFiChartModel(
    {
      planSeries: plan.series,
      actualSeries: [
        { month: "2020-01-01", balance: 90000 },
        { month: assumptions.startMonth, balance: 193800 },
      ],
      fiNumber: plan.fiNumber,
    },
    true,
  )!;
  assert.equal(model.start, fiMonthIndex("2025-10-01"));
  assert.equal(model.end, fiMonthIndex("2031-10-01"));
  assert.equal(model.actual.length, 1);
  assert.equal(model.plan[0]!.balance, assumptions.startBalance);
  assert.ok(model.yMax >= plan.fiNumber);
});

test("no statements means projected points only, including the starting balance", () => {
  const plan = planMonthlySeries(assumptions);
  const model = buildFiChartModel({ planSeries: plan.series, fiNumber: plan.fiNumber })!;
  assert.equal(model.actual.length, 0);
  assert.ok(model.samples.every((sample) => !sample.recorded));
});

test("invalid data is excluded; negative balances are not clipped off the scale", () => {
  const model = buildFiChartModel({
    planSeries: [
      { month: "invalid", balance: 100 },
      { month: "2026-02-31", balance: 100 },
      { month: "2026-03-01", balance: Infinity },
      { month: "2026-02-01", balance: 10 },
      { month: "2026-01-01", balance: -50 },
    ],
    fiNumber: 100,
  })!;
  assert.equal(model.samples.length, 2);
  assert.ok(model.yMin <= -50);
  assert.ok(model.yMax >= 100);
  assert.equal(model.plan[0]!.month, "2026-01-01");
  assert.equal(buildFiChartModel({ planSeries: [], fiNumber: 100 }), null);
  assert.equal(buildFiChartModel({ planSeries: model.plan, fiNumber: Infinity }), null);
  assert.equal(buildFiChartModel({ planSeries: model.plan, fiNumber: 0 }), null);
});

test("calendar indices handle leap years and reject impossible milestone dates", () => {
  assert.equal(fiMonthIndex("2024-02-29"), fiMonthIndex("2024-02-01"));
  assert.equal(fiMonthIndex("2025-02-29"), null);
  assert.equal(fiMonthIndex("2026-13-01"), null);
  assert.equal(fiMonthIndex("2026-12-01")! + 1, fiMonthIndex("2027-01-01"));
  assert.equal(fiMonthString(fiMonthIndex("2027-06-30")!), "2027-06-01");
});

test("smoothing passes through every balance without overshooting, including uneven gaps and peaks", () => {
  const points = [
    { x: 0, y: 100 },
    { x: 1, y: 20 },
    { x: 60, y: 30 },
    { x: 63, y: 30 },
    { x: 70, y: -10 },
  ];
  const original = structuredClone(points);
  const path = smoothFiPath(points);
  assert.ok(path.startsWith("M0 100 C"));
  const segments = path.split(" C").slice(1);
  assert.equal(segments.length, points.length - 1);
  segments.forEach((segment, i) => {
    const [x1, y1, x2, y2, endX, endY] = segment.split(" ").map(Number);
    const start = points[i]!;
    const end = points[i + 1]!;
    assert.equal(endX, end.x);
    assert.equal(endY, end.y);
    assert.ok(x1! >= start.x && x1! <= end.x);
    assert.ok(x2! >= x1! && x2! <= end.x);
    for (const control of [y1!, y2!])
      assert.ok(control >= Math.min(start.y, end.y) && control <= Math.max(start.y, end.y));
  });
  assert.deepEqual(points, original);
});

test("smoothing safely preserves empty, one-point, two-point, and duplicate-date paths", () => {
  assert.equal(smoothFiPath([]), "");
  assert.equal(smoothFiPath([{ x: 5, y: 10 }]), "M5 10");
  assert.equal(
    smoothFiPath([
      { x: 0, y: 0 },
      { x: 10, y: 20 },
    ]),
    "M0 0 L10 20",
  );
  assert.equal(
    smoothFiPath([
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 20 },
    ]),
    "M0 0 L0 10 L10 20",
  );
});
