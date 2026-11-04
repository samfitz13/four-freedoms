import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bodyMeasurements, healthCheckins, sleepLogs, workouts } from "@/lib/db/schema";
import type { DailyPoint, HealthSummary } from "@/lib/freedoms/types";

const WORKOUT_KINDS = ["strength", "cardio", "mobility", "sport", "other"] as const;

export async function computeHealthSummary(
  householdId: string,
  today: Date = new Date(),
): Promise<HealthSummary> {
  const cutoff30 = isoDaysAgo(today, 30);
  const cutoffDate30 = dayStart(cutoff30);

  const [sleepRows, checkinRows, workoutRows, bodyRows] = await Promise.all([
    db
      .select()
      .from(sleepLogs)
      .where(and(eq(sleepLogs.householdId, householdId), gte(sleepLogs.recordedOn, cutoff30))),
    db
      .select()
      .from(healthCheckins)
      .where(
        and(
          eq(healthCheckins.householdId, householdId),
          gte(healthCheckins.recordedAt, cutoffDate30),
        ),
      ),
    db
      .select()
      .from(workouts)
      .where(and(eq(workouts.householdId, householdId), gte(workouts.performedAt, cutoffDate30))),
    db
      .select()
      .from(bodyMeasurements)
      .where(
        and(
          eq(bodyMeasurements.householdId, householdId),
          gte(bodyMeasurements.recordedAt, cutoffDate30),
        ),
      ),
  ]);

  const sleepValues = sleepRows.map((r) => Number(r.sleepHours));
  const meanSleep30 = sleepValues.length
    ? sleepValues.reduce((s, v) => s + v, 0) / sleepValues.length
    : null;
  const sleepVariance30 = sleepValues.length ? variance(sleepValues) : null;

  const trainingDays = new Set(workoutRows.map((r) => toIsoDate(r.performedAt)));
  const trainingDays30 = trainingDays.size;
  const trainingMinutes30 = workoutRows.reduce((sum, row) => sum + row.minutes, 0);
  const trainingByKind30: Record<string, number> = Object.fromEntries(
    WORKOUT_KINDS.map((kind) => [kind, 0]),
  );
  for (const row of workoutRows) {
    trainingByKind30[row.kind] = (trainingByKind30[row.kind] ?? 0) + row.minutes;
  }

  const energyValues = checkinRows.map((r) => r.energy).filter((v): v is number => v !== null);
  const meanEnergy30 = energyValues.length
    ? energyValues.reduce((s, v) => s + v, 0) / energyValues.length
    : null;

  const rhrValues = [...checkinRows, ...bodyRows]
    .map((r) => r.restingHr)
    .filter((v): v is number => v !== null);
  const meanRhr30 = rhrValues.length
    ? rhrValues.reduce((s, v) => s + v, 0) / rhrValues.length
    : null;
  const latestRhr =
    [...checkinRows, ...bodyRows]
      .filter((r) => r.restingHr !== null)
      .sort((a, b) => getRecordedAt(b).getTime() - getRecordedAt(a).getTime())[0]?.restingHr ??
    null;

  const weightRows = bodyRows
    .filter((r) => r.weightKg !== null)
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const latestWeightKg = weightRows.at(-1)?.weightKg ? Number(weightRows.at(-1)!.weightKg) : null;
  const earliestWeightKg = weightRows[0]?.weightKg ? Number(weightRows[0].weightKg) : null;
  const weightDelta30 =
    latestWeightKg !== null && earliestWeightKg !== null ? latestWeightKg - earliestWeightKg : null;
  const latestBodyFatPct = [...bodyRows]
    .filter((r) => r.bodyFatPct !== null)
    .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0]?.bodyFatPct;

  const sleepByDay = groupBy(sleepRows, (r) => r.recordedOn);
  const workoutsByDay = groupBy(workoutRows, (r) => toIsoDate(r.performedAt));
  const checkinsByDay = groupBy(checkinRows, (r) => toIsoDate(r.recordedAt));
  const bodyByDay = groupBy(bodyRows, (r) => toIsoDate(r.recordedAt));
  const series: DailyPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const daySleep = sleepByDay.get(iso) ?? [];
    const dayWorkouts = workoutsByDay.get(iso) ?? [];
    const dayCheckins = checkinsByDay.get(iso) ?? [];
    const dayBody = bodyByDay.get(iso) ?? [];
    const hasSignal =
      daySleep.length > 0 || dayWorkouts.length > 0 || dayCheckins.length > 0 || dayBody.length > 0;
    const dayEnergy = compact(dayCheckins.map((r) => r.energy));
    const dayRhr = compact([...dayCheckins, ...dayBody].map((r) => r.restingHr));
    const s = hasSignal
      ? scoreDay({
          sleep: daySleep.length ? mean(daySleep.map((r) => Number(r.sleepHours))) : null,
          minutes: dayWorkouts.reduce((sum, row) => sum + row.minutes, 0),
          energy: dayEnergy.length ? mean(dayEnergy) : null,
          restingHr: dayRhr.length ? mean(dayRhr) : null,
          baselineRhr: meanRhr30,
        })
      : null;
    series.push({ date: iso, score: s });
  }

  const components = {
    sleep: scoreSleep(meanSleep30, sleepVariance30),
    trainingFrequency: clamp((trainingDays30 / ((30 / 7) * 4)) * 25, 0, 25),
    trainingVolume: clamp((trainingMinutes30 / ((30 / 7) * 150)) * 15, 0, 15),
    recovery: scoreRecovery(latestRhr, meanRhr30),
    energy: meanEnergy30 === null ? 0 : (clamp(meanEnergy30, 0, 10) / 10) * 15,
  };
  const score = Math.round(
    components.sleep +
      components.trainingFrequency +
      components.trainingVolume +
      components.recovery +
      components.energy,
  );

  const thisWeek = nonNull(series.slice(7));
  const lastWeek = nonNull(series.slice(0, 7));
  const trend =
    thisWeek.length && lastWeek.length ? Math.round(mean(thisWeek) - mean(lastWeek)) : 0;

  const streak = computeStreak(series);
  const entriesThisWeek = thisWeek.length;

  return {
    meanSleep30,
    sleepVariance30,
    trainingDays30,
    trainingMinutes30,
    trainingByKind30,
    meanEnergy30,
    meanRhr30,
    meanRestingHr30: meanRhr30,
    latestWeightKg,
    weightDelta30,
    latestBodyFatPct: latestBodyFatPct === undefined ? null : Number(latestBodyFatPct),
    score,
    trend,
    series,
    entriesThisWeek,
    streak,
    components: {
      sleep: Math.round(components.sleep),
      trainingFrequency: Math.round(components.trainingFrequency),
      trainingVolume: Math.round(components.trainingVolume),
      recovery: Math.round(components.recovery),
      energy: Math.round(components.energy),
    },
  };
}

function scoreDay({
  sleep,
  minutes,
  energy,
  restingHr,
  baselineRhr,
}: {
  sleep: number | null;
  minutes: number;
  energy: number | null;
  restingHr: number | null;
  baselineRhr: number | null;
}): number {
  return Math.round(
    scoreSleep(sleep, null) +
      (minutes > 0 ? 25 : 0) +
      clamp((minutes / 60) * 15, 0, 15) +
      scoreRecovery(restingHr, baselineRhr) +
      (energy === null ? 0 : (clamp(energy, 0, 10) / 10) * 15),
  );
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

function variance(xs: number[]): number {
  const m = mean(xs);
  return xs.reduce((sum, value) => sum + (value - m) ** 2, 0) / xs.length;
}

function clamp(n: number, lo: number, hi: number): number {
  const safe = Number.isFinite(n) ? n : 0;
  return Math.max(lo, Math.min(hi, safe));
}

function scoreSleep(meanSleep: number | null, sleepVariance: number | null): number {
  if (meanSleep === null) return 0;
  const distance = Math.min(3, Math.abs(meanSleep - 8));
  const meanPoints = ((3 - distance) / 3) * 20;
  const variancePoints =
    sleepVariance === null ? 0 : clamp((2 - Math.sqrt(sleepVariance)) / 2, 0, 1) * 10;
  return meanPoints + variancePoints;
}

function scoreRecovery(latestRhr: number | null, baselineRhr: number | null): number {
  if (latestRhr === null || baselineRhr === null) return 0;
  const distance = Math.abs(latestRhr - baselineRhr);
  if (distance <= 3) return 15;
  return clamp((13 - distance) / 10, 0, 1) * 15;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayStart(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function compact(values: (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null);
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const group = map.get(k);
    if (group) group.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function getRecordedAt(row: { recordedAt?: Date; createdAt: Date }): Date {
  return row.recordedAt ?? row.createdAt;
}
