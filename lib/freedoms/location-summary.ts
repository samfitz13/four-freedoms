/**
 * Sole source of truth for the Location freedom's headline metrics and score.
 */
import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { locationSatisfactions, places, residences, stays, trips } from "@/lib/db/schema";
import type { DailyPoint, LocationSummary } from "@/lib/freedoms/types";
import { computeCadenceRollup } from "./location-community";
import { getPrimaryResidence, yearsBetween } from "./location-residence";
import { computeDaysAway365 } from "./location-travel";

export async function computeLocationSummary(
  householdId: string,
  today: Date = new Date(),
): Promise<LocationSummary> {
  const cutoff30 = isoDaysAgo(today, 30);
  const cutoff14 = isoDaysAgo(today, 13);
  const todayIso = today.toISOString().slice(0, 10);
  const yearStartIso = `${todayIso.slice(0, 4)}-01-01`;

  const [
    currentStayRows,
    sat30,
    sat14,
    primaryResidence,
    cadence,
    nextTripRows,
    stays12mo,
    staysYtd,
  ] = await Promise.all([
    db
      .select({
        placeId: stays.placeId,
        startedOn: stays.startedOn,
        placeName: places.name,
        country: places.country,
        isPreferred: places.isPreferred,
      })
      .from(stays)
      .innerJoin(places, eq(stays.placeId, places.id))
      .where(and(eq(stays.householdId, householdId), isNull(stays.endedOn)))
      .orderBy(desc(stays.startedOn))
      .limit(1),
    db
      .select({
        recordedOn: locationSatisfactions.recordedOn,
        satisfaction: locationSatisfactions.satisfaction,
      })
      .from(locationSatisfactions)
      .where(
        and(
          eq(locationSatisfactions.householdId, householdId),
          gte(locationSatisfactions.recordedOn, cutoff30),
        ),
      ),
    db
      .select({
        recordedOn: locationSatisfactions.recordedOn,
        satisfaction: locationSatisfactions.satisfaction,
      })
      .from(locationSatisfactions)
      .where(
        and(
          eq(locationSatisfactions.householdId, householdId),
          gte(locationSatisfactions.recordedOn, cutoff14),
        ),
      ),
    getPrimaryResidence(householdId),
    computeCadenceRollup(householdId, today),
    db
      .select({
        id: trips.id,
        name: trips.name,
        purpose: trips.purpose,
        startsOn: trips.startsOn,
        endsOn: trips.endsOn,
      })
      .from(trips)
      .where(
        and(
          eq(trips.householdId, householdId),
          isNull(trips.archivedAt),
          gte(trips.startsOn, todayIso),
        ),
      )
      .orderBy(asc(trips.startsOn))
      .limit(1),
    db
      .select({ placeId: stays.placeId })
      .from(stays)
      .where(and(eq(stays.householdId, householdId), gte(stays.startedOn, isoDaysAgo(today, 365)))),
    db
      .select({
        placeId: stays.placeId,
        kind: stays.kind,
        startedOn: stays.startedOn,
        endedOn: stays.endedOn,
        placeName: places.name,
        country: places.country,
      })
      .from(stays)
      .innerJoin(places, eq(stays.placeId, places.id))
      .where(
        and(
          eq(stays.householdId, householdId),
          lte(stays.startedOn, todayIso),
          or(isNull(stays.endedOn), gte(stays.endedOn, yearStartIso)),
        ),
      ),
  ]);

  const currentStay = currentStayRows[0] ?? null;
  const currentResidenceRole = currentStay
    ? await resolveCurrentResidenceRole(householdId, currentStay.placeId)
    : null;
  const yearPlaceBreakdown = buildYearPlaceBreakdown(staysYtd, yearStartIso, todayIso);
  const daysAtCurrent = currentStay
    ? (yearPlaceBreakdown.find((row) => row.placeId === currentStay.placeId)?.days ?? 0)
    : null;
  const meanSatisfaction30 = sat30.length
    ? sat30.reduce((sum, row) => sum + row.satisfaction, 0) / sat30.length
    : null;

  const placeIds = Array.from(new Set(stays12mo.map((row) => row.placeId)));
  const preferredVisited12mo = placeIds.length
    ? (
        await db
          .select({ id: places.id })
          .from(places)
          .where(and(inArray(places.id, placeIds), eq(places.isPreferred, true)))
      ).length
    : 0;

  const yearsAtPrimary = primaryResidence ? yearsBetween(primaryResidence.startedOn, todayIso) : 0;
  const daysAway365 = await computeDaysAway365(
    householdId,
    primaryResidence?.placeId ?? null,
    today,
  );
  const daysAwayYtd = primaryResidence
    ? yearPlaceBreakdown
        .filter((row) => row.placeId !== primaryResidence.placeId)
        .reduce((sum, row) => sum + row.days, 0)
    : 0;
  const components = {
    rootedness: Math.round(Math.min(1, yearsAtPrimary / 3) * 35),
    belonging: cadence.total ? Math.round((cadence.onCadence / cadence.total) * 25) : 0,
    exploration: Math.round(Math.min(1, daysAway365 / 30) * 20),
    satisfaction: meanSatisfaction30 === null ? 0 : Math.round((meanSatisfaction30 / 10) * 20),
  };
  const score =
    components.rootedness + components.belonging + components.exploration + components.satisfaction;
  const series = buildSeries(today, sat14, components);
  const thisWeek = nonNull(series.slice(7));
  const lastWeek = nonNull(series.slice(0, 7));
  const trend =
    thisWeek.length && lastWeek.length ? Math.round(mean(thisWeek) - mean(lastWeek)) : 0;

  return {
    currentPlace: currentStay?.placeName ?? null,
    currentCountry: currentStay?.country ?? null,
    currentIsPreferred: currentStay?.isPreferred ?? false,
    daysAtCurrent,
    yearPlaceBreakdown,
    currentRole: currentResidenceRole ?? (currentStay ? "visiting" : null),
    currentTimezone: "Local time",
    meanSatisfaction30,
    preferredVisited12mo,
    primaryResidenceName: primaryResidence?.placeName ?? null,
    primaryResidenceStartedOn: primaryResidence?.startedOn ?? null,
    yearsAtPrimary,
    connectionsOnCadence: cadence.onCadence,
    connectionsWithCadence: cadence.total,
    daysAwayYtd,
    daysAway365,
    nextTrip: nextTripRows[0] ?? null,
    components,
    score,
    trend,
    series,
    entriesThisWeek: thisWeek.length,
    streak: computeStreak(series),
  };
}

function buildSeries(
  today: Date,
  sat14: Array<{ recordedOn: string; satisfaction: number }>,
  components: LocationSummary["components"],
): DailyPoint[] {
  const fixed = components.rootedness + components.belonging + components.exploration;
  const byDay = new Map(sat14.map((row) => [row.recordedOn, row.satisfaction] as const));
  const series: DailyPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const sat = byDay.get(iso);
    series.push({
      date: iso,
      score: sat === undefined ? null : fixed + Math.round((sat / 10) * 20),
    });
  }
  return series;
}

function buildYearPlaceBreakdown(
  rows: Array<{
    placeId: string;
    kind: string;
    startedOn: string;
    endedOn: string | null;
    placeName: string;
    country: string | null;
  }>,
  yearStartIso: string,
  todayIso: string,
): LocationSummary["yearPlaceBreakdown"] {
  const byPlace = new Map<
    string,
    { placeId: string; placeName: string; country: string | null; days: number }
  >();

  for (const day of eachIsoDay(yearStartIso, todayIso)) {
    const row = rows
      .filter((candidate) => {
        const start = maxIsoDate(candidate.startedOn, yearStartIso);
        const end = minIsoDate(candidate.endedOn ?? todayIso, todayIso);
        return start <= day && day <= end;
      })
      .sort(compareStayPriority)[0];
    if (!row) continue;

    const existing = byPlace.get(row.placeId);
    if (existing) {
      existing.days += 1;
    } else {
      byPlace.set(row.placeId, {
        placeId: row.placeId,
        placeName: row.placeName,
        country: row.country,
        days: 1,
      });
    }
  }

  const total = Array.from(byPlace.values()).reduce((sum, row) => sum + row.days, 0);
  return Array.from(byPlace.values())
    .sort((a, b) => b.days - a.days)
    .map((row) => ({
      ...row,
      share: total ? row.days / total : 0,
    }));
}

function compareStayPriority(
  a: { kind: string; startedOn: string },
  b: { kind: string; startedOn: string },
) {
  const priorityDelta = stayPriority(b.kind) - stayPriority(a.kind);
  if (priorityDelta !== 0) return priorityDelta;
  return b.startedOn.localeCompare(a.startedOn);
}

function stayPriority(kind: string) {
  return kind === "residence" ? 0 : 1;
}

function eachIsoDay(startIso: string, endIso: string) {
  const days: string[] = [];
  const cursor = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function isoDaysAgo(today: Date, days: number): string {
  const d = new Date(today);
  d.setDate(today.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function computeStreak(series: DailyPoint[]): number {
  let streak = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i]!.score !== null) streak += 1;
    else if (streak > 0) break;
  }
  return streak;
}

function nonNull(points: DailyPoint[]): number[] {
  return points.flatMap((point) => (point.score === null ? [] : [point.score]));
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function maxIsoDate(a: string, b: string) {
  return a > b ? a : b;
}

function minIsoDate(a: string, b: string) {
  return a < b ? a : b;
}

async function resolveCurrentResidenceRole(householdId: string, placeId: string) {
  const [row] = await db
    .select({ role: residences.role })
    .from(residences)
    .where(
      and(
        eq(residences.householdId, householdId),
        eq(residences.placeId, placeId),
        isNull(residences.endedOn),
      ),
    )
    .orderBy(desc(residences.startedOn))
    .limit(1);
  return row?.role === "former" ? null : (row?.role ?? null);
}
