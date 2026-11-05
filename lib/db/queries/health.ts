import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bodyMeasurements, healthCheckins, sleepLogs, workouts } from "@/lib/db/schema";
import type { HealthFeedItem } from "@/lib/db/queries/types";

export async function listRecentSleep(householdId: string, days = 30) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const cutoff = d.toISOString().slice(0, 10);
  return db
    .select()
    .from(sleepLogs)
    .where(and(eq(sleepLogs.householdId, householdId), gte(sleepLogs.recordedOn, cutoff)))
    .orderBy(desc(sleepLogs.recordedOn));
}

export async function listRecentCheckins(householdId: string, days = 30) {
  const cutoff = daysAgo(days);
  return db
    .select()
    .from(healthCheckins)
    .where(and(eq(healthCheckins.householdId, householdId), gte(healthCheckins.recordedAt, cutoff)))
    .orderBy(desc(healthCheckins.recordedAt));
}

export async function listRecentWorkouts(householdId: string, days = 30) {
  const cutoff = daysAgo(days);
  return db
    .select()
    .from(workouts)
    .where(and(eq(workouts.householdId, householdId), gte(workouts.performedAt, cutoff)))
    .orderBy(desc(workouts.performedAt));
}

export async function listRecentBody(householdId: string, days = 30) {
  const cutoff = daysAgo(days);
  return db
    .select()
    .from(bodyMeasurements)
    .where(
      and(eq(bodyMeasurements.householdId, householdId), gte(bodyMeasurements.recordedAt, cutoff)),
    )
    .orderBy(desc(bodyMeasurements.recordedAt));
}

export async function listHealthFeed(householdId: string, days = 30): Promise<HealthFeedItem[]> {
  const [sleep, checkins, training, body] = await Promise.all([
    listRecentSleep(householdId, days),
    listRecentCheckins(householdId, days),
    listRecentWorkouts(householdId, days),
    listRecentBody(householdId, days),
  ]);

  return [
    ...sleep.map((row) => ({
      kind: "sleep" as const,
      id: row.id,
      occurredAt: dayStart(row.recordedOn),
      recordedOn: row.recordedOn,
      sleepHours: Number(row.sleepHours),
      bedAt: row.bedAt,
      wakeAt: row.wakeAt,
      note: row.note,
    })),
    ...checkins.map((row) => ({
      kind: "checkin" as const,
      id: row.id,
      occurredAt: row.recordedAt,
      energy: row.energy,
      restingHr: row.restingHr,
      note: row.note,
    })),
    ...training.map((row) => ({
      kind: "workout" as const,
      id: row.id,
      occurredAt: row.performedAt,
      workoutKind: row.kind,
      minutes: row.minutes,
      intensity: row.intensity,
      note: row.note,
    })),
    ...body.map((row) => ({
      kind: "body" as const,
      id: row.id,
      occurredAt: row.recordedAt,
      weightKg: row.weightKg === null ? null : Number(row.weightKg),
      bodyFatPct: row.bodyFatPct === null ? null : Number(row.bodyFatPct),
      waistCm: row.waistCm === null ? null : Number(row.waistCm),
      restingHr: row.restingHr,
      note: row.note,
    })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function dayStart(iso: string) {
  return new Date(`${iso}T00:00:00`);
}
