import "server-only";
import { and, asc, desc, eq, gte, isNotNull, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { isoOptionVestingEvents, paystubs, timeLogEntries, timePursuits } from "@/lib/db/schema";
import { toNumber } from "@/lib/db/queries/financial";
import { computeFinancialOverview } from "@/lib/freedoms/financial-overview";
import type { Correspondence } from "./types";
import { money } from "./common";

export async function financialTimeCorrespondences(
  householdId: string,
  today: Date = new Date(),
): Promise<Correspondence[]> {
  const [effective, fiHours, vest] = await Promise.all([
    effectiveHourly(householdId),
    hoursToFi(householdId, today),
    nextVest(householdId, today),
  ]);
  return [effective, fiHours, vest].filter((row): row is Correspondence => row !== null);
}

async function effectiveHourly(householdId: string): Promise<Correspondence | null> {
  const [stub] = await db
    .select()
    .from(paystubs)
    .where(and(eq(paystubs.householdId, householdId), isNotNull(paystubs.workPursuitId)))
    .orderBy(desc(paystubs.payDate))
    .limit(1);
  if (!stub?.workPursuitId || !stub.periodStart || !stub.periodEnd) return null;

  const rows = await db
    .select({ hours: timeLogEntries.hours })
    .from(timeLogEntries)
    .where(
      and(
        eq(timeLogEntries.householdId, householdId),
        eq(timeLogEntries.pursuitId, stub.workPursuitId),
        gte(timeLogEntries.recordedOn, stub.periodStart),
        lte(timeLogEntries.recordedOn, stub.periodEnd),
      ),
    );
  const logged = rows.reduce((sum, row) => sum + toNumber(row.hours), 0);
  if (logged <= 0) return null;
  return {
    key: `financial-time-effective-hourly-${stub.id}`,
    pair: ["financial", "time"],
    sentence: `${stub.employer ?? "Work"} paid ${money(toNumber(stub.net) / logged)} per logged hour last pay period.`,
    href: "/financial/income",
  };
}

async function hoursToFi(householdId: string, today: Date): Promise<Correspondence | null> {
  const [overview, work] = await Promise.all([
    computeFinancialOverview(householdId, today),
    db
      .select({ weeklyTargetHours: timePursuits.weeklyTargetHours })
      .from(timePursuits)
      .where(and(eq(timePursuits.householdId, householdId), eq(timePursuits.kind, "work")))
      .orderBy(asc(timePursuits.sortOrder))
      .limit(1),
  ]);
  const monthsToFi = overview.fiTrack.monthsToFi;
  const weeklyTarget = toNumber(work[0]?.weeklyTargetHours);
  if (monthsToFi === null || weeklyTarget <= 0) return null;
  const remaining = (monthsToFi / 12) * 52 * weeklyTarget;
  return {
    key: "financial-time-hours-to-fi",
    pair: ["financial", "time"],
    sentence: `${Math.round(remaining).toLocaleString()} planned work hours remain on the FI track.`,
    href: "/financial/goals",
  };
}

async function nextVest(householdId: string, today: Date): Promise<Correspondence | null> {
  const todayIso = today.toISOString().slice(0, 10);
  const [vest] = await db
    .select({
      vestDate: isoOptionVestingEvents.vestDate,
      shares: isoOptionVestingEvents.shares,
    })
    .from(isoOptionVestingEvents)
    .where(
      and(
        eq(isoOptionVestingEvents.householdId, householdId),
        gte(isoOptionVestingEvents.vestDate, todayIso),
      ),
    )
    .orderBy(asc(isoOptionVestingEvents.vestDate))
    .limit(1);
  if (!vest) return null;
  const days = Math.ceil(
    (new Date(`${vest.vestDate}T00:00:00Z`).getTime() -
      new Date(`${todayIso}T00:00:00Z`).getTime()) /
      86400000,
  );
  return {
    key: `financial-time-vest-${vest.vestDate}`,
    pair: ["financial", "time"],
    sentence: `${vest.shares.toLocaleString()} option shares vest ${days === 0 ? "today" : `in ${days} days`}.`,
    href: "/time/agenda",
  };
}

export async function todayVestNotes(
  householdId: string,
  today: Date = new Date(),
): Promise<string[]> {
  const todayIso = today.toISOString().slice(0, 10);
  const rows = await db
    .select({ shares: isoOptionVestingEvents.shares })
    .from(isoOptionVestingEvents)
    .where(
      and(
        eq(isoOptionVestingEvents.householdId, householdId),
        eq(isoOptionVestingEvents.vestDate, todayIso),
      ),
    );
  return rows.map((row) => `${row.shares.toLocaleString()} option shares vest today.`);
}

export async function agendaVestMarkers(
  householdId: string,
  from: Date,
  to: Date,
): Promise<Array<{ id: string; title: string; startsAt: Date; endsAt: Date; allDay: true }>> {
  const rows = await db
    .select({
      id: isoOptionVestingEvents.id,
      vestDate: isoOptionVestingEvents.vestDate,
      shares: isoOptionVestingEvents.shares,
    })
    .from(isoOptionVestingEvents)
    .where(
      and(
        eq(isoOptionVestingEvents.householdId, householdId),
        gte(isoOptionVestingEvents.vestDate, from.toISOString().slice(0, 10)),
        lte(isoOptionVestingEvents.vestDate, to.toISOString().slice(0, 10)),
      ),
    );
  return rows.map((row) => ({
    id: `vest:${row.id}`,
    title: `${row.shares.toLocaleString()} options vest`,
    startsAt: new Date(`${row.vestDate}T00:00:00`),
    endsAt: new Date(`${row.vestDate}T23:59:59`),
    allDay: true,
  }));
}
