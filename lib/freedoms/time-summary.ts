/**
 * Sole source of truth for the Time freedom's headline metrics and score.
 */
import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { timeLogEntries, timePursuits } from "@/lib/db/schema";
import { ensureTimeSeeded } from "@/lib/freedoms/time-seed";
import { computeHabitScore } from "@/lib/freedoms/time-habits";
import type { DailyPoint, TimeSummary } from "@/lib/freedoms/types";

export async function computeTimeSummary(
  householdId: string,
  today: Date = new Date(),
): Promise<TimeSummary> {
  await ensureTimeSeeded(householdId);
  const cutoff30 = isoDaysAgo(today, 30);
  const cutoff14 = isoDaysAgo(today, 13);
  const cutoff7 = isoDaysAgo(today, 6);

  const rows = await db
    .select({
      recordedOn: timeLogEntries.recordedOn,
      hours: timeLogEntries.hours,
      matters: timePursuits.matters,
      kind: timePursuits.kind,
    })
    .from(timeLogEntries)
    .innerJoin(timePursuits, eq(timeLogEntries.pursuitId, timePursuits.id))
    .where(
      and(eq(timeLogEntries.householdId, householdId), gte(timeLogEntries.recordedOn, cutoff30)),
    );

  const habitScore = await computeHabitScore(householdId);
  const last7 = rows.filter((r) => r.recordedOn >= cutoff7);
  const totalHours7 = last7.reduce((sum, r) => sum + Number(r.hours), 0);
  const mattersHours7 = last7.reduce((sum, r) => sum + (r.matters ? Number(r.hours) : 0), 0);
  const mattersShare7 = totalHours7 > 0 ? mattersHours7 / totalHours7 : 0;
  const loggedDays7 = new Set(last7.filter((r) => Number(r.hours) > 0).map((r) => r.recordedOn));
  const nonZeroKinds7 = new Set(
    last7.filter((r) => Number(r.hours) > 0 && r.kind !== "admin").map((r) => r.kind),
  ).size;

  const components = {
    intention: clamp(mattersShare7, 0, 1) * 40,
    cadence: clamp(habitScore.ratio, 0, 1) * 30,
    balance: 20 * Math.min(1, nonZeroKinds7 / 4),
    coverage: 10 * Math.min(1, loggedDays7.size / 5),
  };
  const score = Math.round(
    components.intention + components.cadence + components.balance + components.coverage,
  );

  const byDay = new Map<string, typeof rows>();
  for (const row of rows.filter((r) => r.recordedOn >= cutoff14)) {
    const current = byDay.get(row.recordedOn) ?? [];
    current.push(row);
    byDay.set(row.recordedOn, current);
  }
  const series: DailyPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dayRows = byDay.get(iso) ?? [];
    series.push({ date: iso, score: dayRows.length ? scoreDay(dayRows) : null });
  }

  const thisWeek = nonNull(series.slice(7));
  const lastWeek = nonNull(series.slice(0, 7));
  const trend =
    thisWeek.length && lastWeek.length ? Math.round(mean(thisWeek) - mean(lastWeek)) : 0;

  const streak = computeStreak(series);

  return {
    mattersHours7,
    totalHours7,
    mattersShare7,
    daysLogged7: loggedDays7.size,
    habitsHitThisWeek: habitScore.hits,
    habitsTargetedThisWeek: habitScore.targeted,
    nonZeroKinds7,
    components: {
      intention: Math.round(components.intention),
      cadence: Math.round(components.cadence),
      balance: Math.round(components.balance),
      coverage: Math.round(components.coverage),
    },
    score,
    trend,
    series,
    entriesThisWeek: loggedDays7.size,
    streak,
  };
}

function scoreDay(
  rows: Array<{
    hours: string;
    matters: boolean;
    kind: "work" | "play" | "care" | "rest" | "admin";
  }>,
): number {
  const total = rows.reduce((sum, row) => sum + Number(row.hours), 0);
  const matters = rows.reduce((sum, row) => sum + (row.matters ? Number(row.hours) : 0), 0);
  const kinds = new Set(
    rows.filter((row) => Number(row.hours) > 0 && row.kind !== "admin").map((row) => row.kind),
  );
  const intention = total > 0 ? (matters / total) * 40 : 0;
  const balance = 20 * Math.min(1, kinds.size / 4);
  return Math.round(clamp((intention + balance + 10) * (100 / 70), 0, 100));
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
  return points.flatMap((p) => (p.score === null ? [] : [p.score]));
}

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function clamp(n: number, lo: number, hi: number): number {
  const safe = Number.isFinite(n) ? n : 0;
  return Math.max(lo, Math.min(hi, safe));
}
