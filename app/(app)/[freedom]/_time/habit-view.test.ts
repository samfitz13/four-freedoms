import assert from "node:assert/strict";
import { test } from "node:test";
import { habitDays, habitSource } from "./habit-view";
import type { HabitCheckin } from "@/lib/db/schema";

function checkins(...dates: string[]): HabitCheckin[] {
  return dates.map((occurredOn, index) => ({
    id: String(index),
    householdId: "synthetic",
    habitId: "synthetic",
    occurredOn,
    note: null,
    createdAt: new Date(`${occurredOn}T00:00:00Z`),
  }));
}

test("28 UTC days end today, including across month and daylight-saving boundaries", () => {
  const days = habitDays({ startedOn: "2026-01-01", checkins: [] }, "2026-11-05");
  assert.equal(days.length, 28);
  assert.equal(days[0]?.date, "2026-10-09");
  assert.equal(days[27]?.date, "2026-11-05");
  assert.equal(new Set(days.map((day) => day.date)).size, 28);
  assert.equal(days.filter((day) => day.today).length, 1);
  assert.equal(days[27]?.weekday, "Thu");
});
test("duplicate, old and future check-ins cannot inflate the seven-day view", () => {
  const days = habitDays(
    {
      startedOn: "2026-01-01",
      checkins: checkins("2026-10-16", "2026-10-16", "2026-10-17", "2026-09-18", "2026-10-09"),
    },
    "2026-10-16",
  );
  assert.equal(days.filter((day) => day.hit).length, 2);
  assert.equal(days.slice(-7).filter((day) => day.hit).length, 1);
});
test("days before a habit starts are unavailable, not missed days", () => {
  const days = habitDays(
    { startedOn: "2026-10-15", checkins: checkins("2026-10-14", "2026-10-15") },
    "2026-10-16",
  );
  assert.equal(days.filter((day) => day.available).length, 2);
  assert.equal(days.filter((day) => day.hit).length, 1);
  assert.equal(days[26]?.hit, true);
  assert.equal(days[27]?.hit, false);
});
test("a future start date does not expose check-in controls", () => {
  assert.equal(
    habitDays({ startedOn: "2026-10-20", checkins: [] }, "2026-10-16").some(
      (day) => day.available || day.hit,
    ),
    false,
  );
});
test("source labels reflect actual thresholds and unsupported body-weight linking", () => {
  assert.equal(habitSource({ linkKind: "none", linkParams: {} }), "Manual check-in");
  assert.equal(
    habitSource({ linkKind: "workout", linkParams: { minMinutes: 45 } }),
    "Workout · 45+ minutes",
  );
  assert.equal(
    habitSource({ linkKind: "sleep", linkParams: { minHours: 7.5 } }),
    "Sleep · 7.5+ hours",
  );
  assert.equal(
    habitSource({ linkKind: "body_weight", linkParams: {} }),
    "Body-weight link · not connected yet",
  );
});
