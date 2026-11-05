import assert from "node:assert/strict";
import { test } from "node:test";
import { ageInMonths, formatProjectionDate, parseBirthDate } from "./birth-date";

test("birth dates accept valid calendar dates and clearing, but reject future or malformed input", () => {
  const today = new Date("2026-10-17T23:00:00Z");
  assert.deepEqual(parseBirthDate("1991-02-15", today), { ok: true, birthDate: "1991-02-15" });
  assert.deepEqual(parseBirthDate("", today), { ok: true, birthDate: null });
  assert.equal(parseBirthDate("2026-10-17", today).ok, true);
  for (const date of [
    "2026-10-18",
    "2025-02-29",
    "2000-04-31",
    "1990-2-01",
    "Invalid",
    1990,
    undefined,
  ])
    assert.equal(parseBirthDate(date, today).ok, false);
});

test("ages use completed calendar months, including birthdays and leap days", () => {
  assert.equal(ageInMonths("1991-02-15", "2026-02-14"), 34 * 12 + 11);
  assert.equal(ageInMonths("1991-02-15", "2026-02-15"), 35 * 12);
  assert.equal(ageInMonths("1991-02-15", "2026-10-01"), 35 * 12 + 7);
  assert.equal(ageInMonths("2000-02-29", "2025-02-28"), 24 * 12 + 11);
  assert.equal(ageInMonths("2000-02-29", "2025-03-01"), 25 * 12);
  assert.equal(ageInMonths("2026-02-15", "2026-02-14"), null);
  assert.equal(ageInMonths(null, "2026-10-01"), null);
});

test("projection labels use age when set and calendar dates otherwise", () => {
  assert.equal(formatProjectionDate("2045-06-01", "1991-02-15"), "Age 54y 3m");
  assert.equal(formatProjectionDate("2045-06-01", "1991-02-15", true), "Age 54");
  assert.equal(formatProjectionDate("2026-02-15", "1991-02-15"), "Age 35");
  assert.equal(formatProjectionDate("2045-06-01"), "Jun 2045");
  assert.equal(formatProjectionDate("2045-06-01", null, true), "2045");
});
