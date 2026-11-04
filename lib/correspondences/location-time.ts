import "server-only";
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { places, stays, timeBlocks, timeEvents } from "@/lib/db/schema";
import { toNumber } from "@/lib/db/queries/financial";
import type { Correspondence, TodayStrip } from "./types";
import { daysAgo, hours, mean, sparklineFrom } from "./common";

export async function locationTimeCorrespondences(
  householdId: string,
  today: Date = new Date(),
): Promise<Correspondence[]> {
  const [current, events] = await Promise.all([
    currentPlaceWork(householdId, today),
    eventPlaceSignal(householdId, today),
  ]);
  return [current, events].filter((row): row is Correspondence => row !== null);
}

export async function todayLocationTimeStrip(
  householdId: string,
  today: Date = new Date(),
): Promise<Pick<TodayStrip, "place" | "deepWorkHours">> {
  const todayIso = today.toISOString().slice(0, 10);
  const [stay, block] = await Promise.all([
    currentStay(householdId, todayIso),
    db
      .select({ deepWorkHours: timeBlocks.deepWorkHours })
      .from(timeBlocks)
      .where(and(eq(timeBlocks.householdId, householdId), eq(timeBlocks.recordedOn, todayIso)))
      .limit(1),
  ]);
  return {
    place: stay?.placeName ?? null,
    deepWorkHours: block[0] ? toNumber(block[0].deepWorkHours) : null,
  };
}

async function currentPlaceWork(householdId: string, today: Date): Promise<Correspondence | null> {
  const todayIso = today.toISOString().slice(0, 10);
  const stay = await currentStay(householdId, todayIso);
  if (!stay) return null;
  const from = stay.startedOn > daysAgo(today, 30) ? stay.startedOn : daysAgo(today, 30);
  const rows = await db
    .select({
      recordedOn: timeBlocks.recordedOn,
      deepWorkHours: timeBlocks.deepWorkHours,
      prioritySplit: timeBlocks.prioritySplit,
    })
    .from(timeBlocks)
    .where(
      and(
        eq(timeBlocks.householdId, householdId),
        gte(timeBlocks.recordedOn, from),
        lte(timeBlocks.recordedOn, todayIso),
      ),
    );
  const deep = mean(rows.map((row) => toNumber(row.deepWorkHours)));
  if (deep === null) return null;
  const matters = mean(
    rows
      .map((row) => (row.prioritySplit === null ? null : toNumber(row.prioritySplit)))
      .filter((value): value is number => value !== null),
  );
  return {
    key: `location-time-current-${stay.placeId}`,
    pair: ["location", "time"],
    sentence: `${stay.placeName} is averaging ${hours(deep)} deep work per logged day${matters === null ? "" : `, with ${Math.round(matters * 100)}% matters-share`}.`,
    series: sparklineFrom(
      rows.map((row) => ({ date: row.recordedOn, value: toNumber(row.deepWorkHours) })),
    ),
    href: "/time/log",
  };
}

async function eventPlaceSignal(householdId: string, today: Date): Promise<Correspondence | null> {
  const rows = await db
    .select({
      placeId: timeEvents.placeId,
      placeName: places.name,
    })
    .from(timeEvents)
    .innerJoin(places, eq(timeEvents.placeId, places.id))
    .where(
      and(
        eq(timeEvents.householdId, householdId),
        gte(timeEvents.startsAt, new Date(`${daysAgo(today, 30)}T00:00:00`)),
      ),
    );
  if (rows.length === 0) return null;
  const counts = new Map<string, { placeName: string; count: number }>();
  for (const row of rows) {
    if (!row.placeId) continue;
    const current = counts.get(row.placeId) ?? { placeName: row.placeName, count: 0 };
    current.count += 1;
    counts.set(row.placeId, current);
  }
  const top = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  if (!top) return null;
  return {
    key: "location-time-events-by-place",
    pair: ["location", "time"],
    sentence: `${top.placeName} anchors ${top.count} calendar events in the trailing month.`,
    href: "/time/agenda",
  };
}

async function currentStay(householdId: string, todayIso: string) {
  const [stay] = await db
    .select({
      placeId: stays.placeId,
      placeName: places.name,
      startedOn: stays.startedOn,
    })
    .from(stays)
    .innerJoin(places, eq(stays.placeId, places.id))
    .where(
      and(
        eq(stays.householdId, householdId),
        lte(stays.startedOn, todayIso),
        or(isNull(stays.endedOn), gte(stays.endedOn, todayIso)),
      ),
    )
    .orderBy(desc(stays.startedOn))
    .limit(1);
  return stay ?? null;
}
