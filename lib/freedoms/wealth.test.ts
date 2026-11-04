import assert from "node:assert/strict";
import { test } from "node:test";
import { yearToDateChange } from "./wealth";

const NOW = new Date("2026-11-04T12:00:00Z");

test("YTD compares this year's latest month with previous December, not the first record", () => {
  assert.equal(
    yearToDateChange(
      [
        { date: "2023-12-01", netWorth: 100_000 },
        { date: "2025-12-01", netWorth: 280_000 },
        { date: "2026-01-01", netWorth: 290_000 },
        { date: "2026-10-01", netWorth: 352_000 },
      ],
      NOW,
    ),
    72_000,
  );
});

test("January includes its change from December and UTC New Year selects the new baseline", () => {
  const series = [
    { date: "2025-12-01", netWorth: 280 },
    { date: "2026-01-01", netWorth: 290 },
  ];
  assert.equal(yearToDateChange(series, new Date("2026-01-01T00:00:00Z")), 10);
  assert.equal(yearToDateChange(series, new Date("2025-12-31T23:59:59Z")), null);
});

test("missing December or current-year data stays unknown rather than using January or zero", () => {
  assert.equal(yearToDateChange([], NOW), null);
  assert.equal(yearToDateChange([{ date: "2026-01-01", netWorth: 100 }], NOW), null);
  assert.equal(yearToDateChange([{ date: "2025-12-01", netWorth: 100 }], NOW), null);
  assert.equal(
    yearToDateChange(
      [
        { date: "2025-11-01", netWorth: 100 },
        { date: "2026-10-01", netWorth: 200 },
      ],
      NOW,
    ),
    null,
  );
});

test("zero, decreases, and negative balances are real data; invalid values are not", () => {
  for (const [baseline, current, expected] of [
    [0, 10, 10],
    [10, 0, -10],
    [-10, 0, 10],
    [10, 10, 0],
  ]) {
    assert.equal(
      yearToDateChange(
        [
          { date: "2025-12-01", netWorth: baseline! },
          { date: "2026-10-01", netWorth: current! },
        ],
        NOW,
      ),
      expected,
    );
  }
  assert.equal(
    yearToDateChange(
      [
        { date: "2025-12-01", netWorth: 100 },
        { date: "2026-10-01", netWorth: NaN },
      ],
      NOW,
    ),
    null,
  );
  assert.equal(yearToDateChange([], new Date("invalid")), null);
});

test("ignores future months, accepts unordered input, and does not mutate the series", () => {
  const series = [
    { date: "2026-12-01", netWorth: 999 },
    { date: "2026-10-01", netWorth: 150 },
    { date: "2025-12-01", netWorth: 100 },
    { date: "2026-02-01", netWorth: 120 },
  ];
  const before = structuredClone(series);
  assert.equal(yearToDateChange(series, NOW), 50);
  assert.deepEqual(series, before);
});
