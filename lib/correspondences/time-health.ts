import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { habits, healthCheckins, sleepLogs, timeBlocks, workouts } from "@/lib/db/schema";
import { toNumber } from "@/lib/db/queries/financial";
import type { Correspondence } from "./types";
import { correlation, daysAgo, sparklineFrom } from "./common";

export async function timeHealthCorrespondences(
  householdId: string,
  today: Date = new Date(),
): Promise<Correspondence[]> {
  const [energy, linked] = await Promise.all([
    energyObligation(householdId, today),
    linkedHabitSignal(householdId, today),
  ]);
  return [energy, linked].filter((row): row is Correspondence => row !== null);
}

export async function derivedHabitHit(
  householdId: string,
  habitId: string,
  occurredOn: string,
): Promise<boolean | null> {
  const [habit] = await db
    .select({ linkKind: habits.linkKind, linkParams: habits.linkParams })
    .from(habits)
    .where(and(eq(habits.householdId, householdId), eq(habits.id, habitId)))
    .limit(1);
  if (!habit || habit.linkKind === "none") return null;
  if (habit.linkKind === "workout") {
    const minMinutes =
      typeof habit.linkParams.minMinutes === "number" ? habit.linkParams.minMinutes : 1;
    const rows = await db
      .select({ performedAt: workouts.performedAt, minutes: workouts.minutes })
      .from(workouts)
      .where(
        and(
          eq(workouts.householdId, householdId),
          gte(workouts.performedAt, new Date(`${occurredOn}T00:00:00`)),
        ),
      );
    return rows
      .filter((row) => row.performedAt?.toISOString().slice(0, 10) === occurredOn)
      .some((row) => row.minutes >= minMinutes);
  }
  if (habit.linkKind === "sleep") {
    const minHours = typeof habit.linkParams.minHours === "number" ? habit.linkParams.minHours : 7;
    const [row] = await db
      .select({ sleepHours: sleepLogs.sleepHours })
      .from(sleepLogs)
      .where(and(eq(sleepLogs.householdId, householdId), eq(sleepLogs.recordedOn, occurredOn)))
      .limit(1);
    return row ? toNumber(row.sleepHours) >= minHours : false;
  }
  return null;
}

async function energyObligation(householdId: string, today: Date): Promise<Correspondence | null> {
  const from = daysAgo(today, 90);
  const [blocks, checkins] = await Promise.all([
    db
      .select({ recordedOn: timeBlocks.recordedOn, obligationHours: timeBlocks.obligationHours })
      .from(timeBlocks)
      .where(and(eq(timeBlocks.householdId, householdId), gte(timeBlocks.recordedOn, from))),
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
  const energyByDay = new Map(
    checkins
      .filter((row) => row.energy !== null)
      .map((row) => [row.recordedAt.toISOString().slice(0, 10), row.energy!]),
  );
  const paired = blocks.flatMap((row) => {
    const energy = energyByDay.get(row.recordedOn);
    return energy === undefined
      ? []
      : [{ date: row.recordedOn, obligation: toNumber(row.obligationHours), energy }];
  });
  const corr = correlation(
    paired.map((row) => row.obligation),
    paired.map((row) => row.energy),
  );
  if (corr === null) return null;
  const direction =
    corr < -0.2
      ? "falls as obligations rise"
      : corr > 0.2
        ? "rises with obligation load"
        : "is not tightly coupled to obligations";
  return {
    key: "time-health-energy-obligation",
    pair: ["time", "health"],
    sentence: `Energy ${direction} across the trailing 90 days.`,
    series: sparklineFrom(paired.map((row) => ({ date: row.date, value: row.energy }))),
    href: "/health/overview",
  };
}

async function linkedHabitSignal(householdId: string, today: Date): Promise<Correspondence | null> {
  const rows = await db
    .select({ title: habits.title, linkKind: habits.linkKind, linkParams: habits.linkParams })
    .from(habits)
    .where(and(eq(habits.householdId, householdId), gte(habits.startedOn, daysAgo(today, 365))));
  const linked = rows.filter((row) => row.linkKind !== "none");
  if (linked.length === 0) return null;
  const first = linked[0]!;
  const descriptor =
    first.linkKind === "workout"
      ? `${first.title} is now proved by workout logs`
      : first.linkKind === "sleep"
        ? `${first.title} is now proved by sleep logs`
        : `${first.title} is now proved by health logs`;
  return {
    key: "time-health-linked-habits",
    pair: ["time", "health"],
    sentence: `${descriptor}; manual ticks stay quiet for linked habits.`,
    href: "/time/habits",
  };
}
