import "server-only";
import { and, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { habitCheckins, habits } from "@/lib/db/schema";
import { derivedHabitHit } from "@/lib/correspondences/time-health";

export async function computeHabitProgress(householdId: string) {
  const today = new Date();
  const cutoff28 = isoDaysAgo(today, 27);
  const cutoff7 = isoDaysAgo(today, 6);
  const [habitRows, checkinRows] = await Promise.all([
    db
      .select()
      .from(habits)
      .where(and(eq(habits.householdId, householdId), isNull(habits.archivedAt))),
    db
      .select()
      .from(habitCheckins)
      .where(
        and(eq(habitCheckins.householdId, householdId), gte(habitCheckins.occurredOn, cutoff28)),
      ),
  ]);
  const hitsByHabit = new Map<string, Set<string>>();
  for (const checkin of checkinRows) {
    const set = hitsByHabit.get(checkin.habitId) ?? new Set<string>();
    set.add(checkin.occurredOn);
    hitsByHabit.set(checkin.habitId, set);
  }
  for (const habit of habitRows.filter((row) => row.linkKind !== "none")) {
    const set = hitsByHabit.get(habit.id) ?? new Set<string>();
    for (let i = 0; i < 28; i++) {
      const date = isoDaysAgo(today, 27 - i);
      if (await derivedHabitHit(householdId, habit.id, date)) set.add(date);
    }
    hitsByHabit.set(habit.id, set);
  }

  return habitRows.map((habit) => {
    const hits = hitsByHabit.get(habit.id) ?? new Set<string>();
    const trailing28 = Array.from({ length: 28 }, (_, i) => {
      const date = isoDaysAgo(today, 27 - i);
      return { date, hit: hits.has(date) };
    });
    return {
      habitId: habit.id,
      title: habit.title,
      targetPerWeek: habit.targetPerWeek,
      hitThisWeek: trailing28.filter((day) => day.date >= cutoff7 && day.hit).length,
      streak: computeStreak(today, hits),
      trailing28,
    };
  });
}

export async function computeHabitScore(householdId: string) {
  const rows = await computeHabitProgress(householdId);
  const hits = rows.reduce((sum, row) => sum + Math.min(row.hitThisWeek, row.targetPerWeek), 0);
  const targeted = rows.reduce((sum, row) => sum + row.targetPerWeek, 0);
  return { hits, targeted, ratio: targeted > 0 ? hits / targeted : 0 };
}

function computeStreak(today: Date, hits: Set<string>): number {
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const iso = isoDaysAgo(today, i);
    if (!hits.has(iso)) break;
    streak += 1;
  }
  return streak;
}

function isoDaysAgo(today: Date, days: number): string {
  const d = new Date(today);
  d.setDate(today.getDate() - days);
  return d.toISOString().slice(0, 10);
}
