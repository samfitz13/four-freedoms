import "server-only";
import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  calendarAccounts,
  habitCheckins,
  habits,
  timeBlocks,
  timeEvents,
  timeLogEntries,
  timePursuits,
} from "@/lib/db/schema";
import { ensureTimeSeeded } from "@/lib/freedoms/time-seed";
import { derivedHabitHit } from "@/lib/correspondences/time-health";

export async function listRecentTimeBlocks(householdId: string, days = 30) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const cutoff = d.toISOString().slice(0, 10);
  return db
    .select()
    .from(timeBlocks)
    .where(and(eq(timeBlocks.householdId, householdId), gte(timeBlocks.recordedOn, cutoff)))
    .orderBy(desc(timeBlocks.recordedOn));
}

export async function listTimePursuits(householdId: string, includeArchived = false) {
  await ensureTimeSeeded(householdId);
  const rows = await db
    .select()
    .from(timePursuits)
    .where(eq(timePursuits.householdId, householdId))
    .orderBy(asc(timePursuits.archivedAt), asc(timePursuits.sortOrder), asc(timePursuits.name));
  return includeArchived ? rows : rows.filter((row) => row.archivedAt === null);
}

export async function listTimeLogEntries(householdId: string, days = 30) {
  await ensureTimeSeeded(householdId);
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  const cutoff = d.toISOString().slice(0, 10);
  return db
    .select({
      id: timeLogEntries.id,
      householdId: timeLogEntries.householdId,
      pursuitId: timeLogEntries.pursuitId,
      recordedOn: timeLogEntries.recordedOn,
      hours: timeLogEntries.hours,
      note: timeLogEntries.note,
      source: timeLogEntries.source,
      createdAt: timeLogEntries.createdAt,
      pursuitName: timePursuits.name,
      pursuitKind: timePursuits.kind,
      pursuitColorVar: timePursuits.colorVar,
      pursuitMatters: timePursuits.matters,
    })
    .from(timeLogEntries)
    .innerJoin(timePursuits, eq(timeLogEntries.pursuitId, timePursuits.id))
    .where(and(eq(timeLogEntries.householdId, householdId), gte(timeLogEntries.recordedOn, cutoff)))
    .orderBy(desc(timeLogEntries.recordedOn), asc(timePursuits.sortOrder), asc(timePursuits.name));
}

export async function listTimeHabits(householdId: string) {
  await ensureTimeSeeded(householdId);
  const cutoff = isoDaysAgo(new Date(), 27);
  const [habitRows, checkinRows, pursuits] = await Promise.all([
    db
      .select()
      .from(habits)
      .where(and(eq(habits.householdId, householdId), isNull(habits.archivedAt)))
      .orderBy(asc(habits.title)),
    db
      .select()
      .from(habitCheckins)
      .where(
        and(eq(habitCheckins.householdId, householdId), gte(habitCheckins.occurredOn, cutoff)),
      ),
    listTimePursuits(householdId),
  ]);
  const checkinsByHabit = new Map<string, typeof checkinRows>();
  for (const checkin of checkinRows) {
    const current = checkinsByHabit.get(checkin.habitId) ?? [];
    current.push(checkin);
    checkinsByHabit.set(checkin.habitId, current);
  }
  for (const habit of habitRows.filter((row) => row.linkKind !== "none")) {
    const current = checkinsByHabit.get(habit.id) ?? [];
    for (let i = 0; i < 28; i++) {
      const occurredOn = isoDaysAgo(new Date(), 27 - i);
      if (await derivedHabitHit(householdId, habit.id, occurredOn)) {
        current.push({
          id: `virtual:${habit.id}:${occurredOn}`,
          householdId,
          habitId: habit.id,
          occurredOn,
          note: null,
          createdAt: new Date(`${occurredOn}T00:00:00`),
        });
      }
    }
    checkinsByHabit.set(habit.id, current);
  }
  const pursuitById = new Map(pursuits.map((p) => [p.id, p]));
  return habitRows.map((habit) => ({
    ...habit,
    pursuit: habit.pursuitId ? (pursuitById.get(habit.pursuitId) ?? null) : null,
    checkins: checkinsByHabit.get(habit.id) ?? [],
  }));
}

export async function listTimeEvents(householdId: string, from: Date, to: Date) {
  await ensureTimeSeeded(householdId);
  return db
    .select({
      id: timeEvents.id,
      householdId: timeEvents.householdId,
      source: timeEvents.source,
      externalId: timeEvents.externalId,
      calendarAccountId: timeEvents.calendarAccountId,
      title: timeEvents.title,
      location: timeEvents.location,
      placeId: timeEvents.placeId,
      connectionIds: timeEvents.connectionIds,
      description: timeEvents.description,
      pursuitId: timeEvents.pursuitId,
      startsAt: timeEvents.startsAt,
      endsAt: timeEvents.endsAt,
      allDay: timeEvents.allDay,
      rrule: timeEvents.rrule,
      timezone: timeEvents.timezone,
      status: timeEvents.status,
      updatedAt: timeEvents.updatedAt,
      createdAt: timeEvents.createdAt,
      pursuitName: timePursuits.name,
      pursuitColorVar: timePursuits.colorVar,
    })
    .from(timeEvents)
    .leftJoin(timePursuits, eq(timeEvents.pursuitId, timePursuits.id))
    .where(
      and(
        eq(timeEvents.householdId, householdId),
        lte(timeEvents.startsAt, to),
        gte(timeEvents.endsAt, from),
      ),
    )
    .orderBy(asc(timeEvents.startsAt));
}

export async function listCalendarAccounts(householdId: string) {
  return db
    .select()
    .from(calendarAccounts)
    .where(eq(calendarAccounts.householdId, householdId))
    .orderBy(desc(calendarAccounts.createdAt));
}

function isoDaysAgo(today: Date, days: number): string {
  const d = new Date(today);
  d.setDate(today.getDate() - days);
  return d.toISOString().slice(0, 10);
}
