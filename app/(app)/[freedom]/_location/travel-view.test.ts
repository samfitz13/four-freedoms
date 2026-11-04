import assert from "node:assert/strict";
import { test } from "node:test";
import {
  daysBetween,
  travelBudget,
  travelDate,
  travelHistory,
  tripPhase,
  validTravelDates,
} from "./travel-view";
import type { TravelStay, TravelTrip } from "./types";

function trip(id: string, startsOn = "2026-10-10", endsOn = "2026-10-20"): TravelTrip {
  return {
    id,
    name: "Synthetic trip",
    purpose: "vacation",
    startsOn,
    endsOn,
    budgetAmount: null,
    currency: "USD",
    notes: null,
  };
}

function stay(
  id: string,
  startedOn: string,
  endedOn: string | null,
  tripId: string | null = "trip",
): TravelStay {
  return {
    id,
    tripId,
    placeId: "place",
    placeName: "Synthetic place",
    country: "Portugal",
    startedOn,
    endedOn,
    note: null,
  };
}

test("trip phases include both boundary days and same-day travel", () => {
  assert.equal(tripPhase(trip("trip"), "2026-10-10"), "current");
  assert.equal(tripPhase(trip("trip"), "2026-10-20"), "current");
  assert.equal(tripPhase(trip("trip"), "2026-10-09"), "upcoming");
  assert.equal(tripPhase(trip("trip"), "2026-10-21"), "past");
  assert.equal(tripPhase(trip("trip", "2026-10-17", "2026-10-17"), "2026-10-17"), "current");
});

test("nights are UTC date differences, not inclusive day counts", () => {
  assert.equal(daysBetween("2026-03-07", "2026-03-10"), 3);
  assert.equal(daysBetween("2026-10-17", "2026-10-17"), 0);
  assert.equal(daysBetween("2026-12-30", "2027-01-02"), 3);
});

test("reject reversed, missing and impossible dates", () => {
  assert.equal(validTravelDates("2026-10-20", "2026-10-19"), false);
  assert.equal(validTravelDates("2026-02-30", "2026-03-04"), false);
  assert.equal(validTravelDates("", "2026-10-17"), false);
  assert.equal(validTravelDates("2028-02-29", "2028-03-01"), true);
});

test("overlapping and duplicate stays count each elapsed travel day once", () => {
  const history = travelHistory(
    [trip("trip")],
    [
      stay("a", "2026-10-01", "2026-10-05"),
      stay("b", "2026-10-04", "2026-10-10"),
      stay("c", "2026-10-04", "2026-10-10"),
      stay("d", "2026-10-13", "2026-10-13"),
    ],
    "2026-10-17",
  );
  assert.deepEqual(history, { days: 11, countries: 1, destinations: 1 });
});

test("future stays are not visits and ongoing stays stop at today", () => {
  const history = travelHistory(
    [trip("trip")],
    [
      stay("ongoing", "2026-10-15", null),
      { ...stay("future", "2027-01-01", "2027-01-10"), country: "Japan", placeId: "future" },
    ],
    "2026-10-17",
  );
  assert.deepEqual(history, { days: 3, countries: 1, destinations: 1 });
  assert.equal(
    travelHistory([trip("trip")], [stay("future-end", "2026-10-15", "2026-10-20")], "2026-10-17")
      .days,
    3,
  );
});

test("archived trips, unattached stays and missing countries do not inflate summaries", () => {
  const history = travelHistory(
    [trip("trip")],
    [
      stay("archived", "2026-01-01", "2026-02-01", "archived"),
      stay("unattached", "2026-01-01", "2026-02-01", null),
      { ...stay("unknown", "2026-10-17", "2026-10-17"), country: null },
    ],
    "2026-10-17",
  );
  assert.deepEqual(history, { days: 1, countries: 0, destinations: 1 });
});

test("budgets distinguish a recorded zero from missing data and retain currency", () => {
  assert.equal(travelBudget(null, "USD"), null);
  assert.match(travelBudget("0", "USD") ?? "", /USD.*0/);
  assert.match(travelBudget("1250.50", "EUR") ?? "", /EUR.*1,250\.50/);
  assert.equal(travelDate("2026-10-17"), "Oct 17, 2026");
});
