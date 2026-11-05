import "server-only";
import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  healthCheckins,
  locationSatisfactions,
  places,
  sleepLogs,
  stays,
  workouts,
} from "@/lib/db/schema";
import { toNumber } from "@/lib/db/queries/financial";
import type { Correspondence, TodayStrip } from "./types";
import { daysAgo, hours, mean, sparklineFrom } from "./common";

type StayWindow = {
  placeId: string;
  placeName: string;
  kind: string;
  startedOn: string;
  endedOn: string | null;
};

export async function locationHealthCorrespondences(
  householdId: string,
  today: Date = new Date(),
): Promise<Correspondence[]> {
  const [sleep, training, satisfaction] = await Promise.all([
    sleepByPlace(householdId, today),
    trainingByPlace(householdId, today),
    satisfactionHealth(householdId, today),
  ]);
  return [sleep, training, satisfaction].filter((row): row is Correspondence => row !== null);
}

export async function todaySleepStrip(
  householdId: string,
  today: Date = new Date(),
): Promise<Pick<TodayStrip, "sleepHours">> {
  const todayIso = today.toISOString().slice(0, 10);
  const [row] = await db
    .select({ sleepHours: sleepLogs.sleepHours })
    .from(sleepLogs)
    .where(and(eq(sleepLogs.householdId, householdId), eq(sleepLogs.recordedOn, todayIso)))
    .limit(1);
  return { sleepHours: row ? toNumber(row.sleepHours) : null };
}

async function sleepByPlace(householdId: string, today: Date): Promise<Correspondence | null> {
  const from = daysAgo(today, 90);
  const [stayRows, sleepRows] = await Promise.all([
    listStayWindows(householdId, from, today.toISOString().slice(0, 10)),
    db
      .select({ recordedOn: sleepLogs.recordedOn, sleepHours: sleepLogs.sleepHours })
      .from(sleepLogs)
      .where(and(eq(sleepLogs.householdId, householdId), gte(sleepLogs.recordedOn, from))),
  ]);
  const byPlace = valuesByPlace(
    stayRows,
    sleepRows,
    (row) => row.recordedOn,
    (row) => toNumber(row.sleepHours),
  );
  const home = byPlace.get("home");
  const away = byPlace.get("away");
  if (!home?.length || !away?.length) return null;
  const homeMean = mean(home);
  const awayMean = mean(away);
  if (homeMean === null || awayMean === null) return null;
  const deltaMinutes = Math.round((awayMean - homeMean) * 60);
  return {
    key: "location-health-sleep-home-away",
    pair: ["location", "health"],
    sentence: `Sleep is ${hours(homeMean)} at home and ${hours(awayMean)} away (${deltaMinutes >= 0 ? "+" : ""}${deltaMinutes} min).`,
    href: "/health/overview",
  };
}

async function trainingByPlace(householdId: string, today: Date): Promise<Correspondence | null> {
  const from = daysAgo(today, 90);
  const to = today.toISOString().slice(0, 10);
  const [stayRows, workoutRows] = await Promise.all([
    listStayWindows(householdId, from, to),
    db
      .select({ performedAt: workouts.performedAt })
      .from(workouts)
      .where(
        and(
          eq(workouts.householdId, householdId),
          gte(workouts.performedAt, new Date(`${from}T00:00:00`)),
        ),
      ),
  ]);
  const days = { home: new Set<string>(), away: new Set<string>() };
  for (const day of eachIsoDay(from, to)) {
    days[classifyStay(stayRows.find((stay) => includesDay(stay, day)))].add(day);
  }
  const hits = { home: new Set<string>(), away: new Set<string>() };
  for (const row of workoutRows) {
    const day = row.performedAt.toISOString().slice(0, 10);
    hits[classifyStay(stayRows.find((stay) => includesDay(stay, day)))].add(day);
  }
  const homeFreq = days.home.size ? (hits.home.size / days.home.size) * 7 : null;
  const awayFreq = days.away.size ? (hits.away.size / days.away.size) * 7 : null;
  if (homeFreq === null || awayFreq === null) return null;
  return {
    key: "location-health-training-home-away",
    pair: ["location", "health"],
    sentence: `Training runs ${homeFreq.toFixed(1)}/wk at home and ${awayFreq.toFixed(1)}/wk away.`,
    href: "/location/overview",
  };
}

async function satisfactionHealth(
  householdId: string,
  today: Date,
): Promise<Correspondence | null> {
  const from = daysAgo(today, 30);
  const [satRows, sleepRows, energyRows] = await Promise.all([
    db
      .select({
        recordedOn: locationSatisfactions.recordedOn,
        satisfaction: locationSatisfactions.satisfaction,
      })
      .from(locationSatisfactions)
      .where(
        and(
          eq(locationSatisfactions.householdId, householdId),
          gte(locationSatisfactions.recordedOn, from),
        ),
      ),
    db
      .select({ recordedOn: sleepLogs.recordedOn, sleepHours: sleepLogs.sleepHours })
      .from(sleepLogs)
      .where(and(eq(sleepLogs.householdId, householdId), gte(sleepLogs.recordedOn, from))),
    db
      .select({ recordedAt: healthCheckins.recordedAt, energy: healthCheckins.energy })
      .from(healthCheckins)
      .where(
        and(
          eq(healthCheckins.householdId, householdId),
          gte(healthCheckins.recordedAt, new Date(`${from}T00:00:00`)),
        ),
      ),
  ]);
  const sleepByDay = new Map(sleepRows.map((row) => [row.recordedOn, toNumber(row.sleepHours)]));
  const energyByDay = new Map(
    energyRows
      .filter((row) => row.energy !== null)
      .map((row) => [row.recordedAt.toISOString().slice(0, 10), row.energy!]),
  );
  const points = satRows.map((row) => ({
    date: row.recordedOn,
    value: sleepByDay.get(row.recordedOn) ?? energyByDay.get(row.recordedOn) ?? null,
  }));
  if (points.every((point) => point.value === null)) return null;
  return {
    key: "location-health-satisfaction",
    pair: ["location", "health"],
    sentence: "Location satisfaction now has sleep and energy on the same 30-day ledger.",
    series: sparklineFrom(points),
    href: "/location/overview",
  };
}

async function listStayWindows(householdId: string, from: string, to: string) {
  return db
    .select({
      placeId: stays.placeId,
      placeName: places.name,
      kind: stays.kind,
      startedOn: stays.startedOn,
      endedOn: stays.endedOn,
    })
    .from(stays)
    .innerJoin(places, eq(stays.placeId, places.id))
    .where(
      and(
        eq(stays.householdId, householdId),
        lte(stays.startedOn, to),
        or(isNull(stays.endedOn), gte(stays.endedOn, from)),
      ),
    );
}

function valuesByPlace<T>(
  staysForPeriod: StayWindow[],
  rows: T[],
  dayOf: (row: T) => string,
  valueOf: (row: T) => number,
) {
  const out = new Map<string, number[]>();
  for (const row of rows) {
    const day = dayOf(row);
    const bucket = classifyStay(staysForPeriod.find((stay) => includesDay(stay, day)));
    const values = out.get(bucket) ?? [];
    values.push(valueOf(row));
    out.set(bucket, values);
  }
  return out;
}

function classifyStay(stay: StayWindow | undefined) {
  return stay?.kind === "residence" ? "home" : "away";
}

function includesDay(stay: StayWindow, day: string) {
  return stay.startedOn <= day && (stay.endedOn === null || stay.endedOn >= day);
}

function eachIsoDay(startIso: string, endIso: string) {
  const out: string[] = [];
  const cursor = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
