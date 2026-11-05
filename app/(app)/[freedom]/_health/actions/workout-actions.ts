"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { workouts } from "@/lib/db/schema";
import {
  healthScope,
  id,
  note,
  optionalNum,
  recordedAt,
  requiredNum,
  revalidateHealth,
  str,
} from "./helpers";

const workoutKinds = ["strength", "cardio", "mobility", "sport", "other"] as const;

export async function createWorkout(formData: FormData) {
  const householdId = await healthScope();
  const minutes = requiredNum(formData, "minutes", { min: 1, max: 1440 });

  await db.insert(workouts).values({
    id: randomUUID(),
    householdId,
    performedAt: recordedAt(formData, "performedOn", "performedTime"),
    kind: parseKind(formData),
    minutes: Math.round(minutes),
    intensity: intOrNull(optionalNum(formData, "intensity", { min: 1, max: 5 })),
    note: note(formData),
  });

  revalidateHealth();
}

export async function updateWorkout(formData: FormData) {
  const householdId = await healthScope();
  const minutes = requiredNum(formData, "minutes", { min: 1, max: 1440 });

  await db
    .update(workouts)
    .set({
      performedAt: recordedAt(formData, "performedOn", "performedTime"),
      kind: parseKind(formData),
      minutes: Math.round(minutes),
      intensity: intOrNull(optionalNum(formData, "intensity", { min: 1, max: 5 })),
      note: note(formData),
    })
    .where(and(eq(workouts.id, id(formData)), eq(workouts.householdId, householdId)));

  revalidateHealth();
}

export async function deleteWorkout(formData: FormData) {
  const householdId = await healthScope();
  await db
    .delete(workouts)
    .where(and(eq(workouts.id, id(formData)), eq(workouts.householdId, householdId)));
  revalidateHealth();
}

function parseKind(formData: FormData): (typeof workoutKinds)[number] {
  const value = str(formData, "kind");
  return workoutKinds.find((kind) => kind === value) ?? "other";
}

function intOrNull(value: number | null) {
  return value === null ? null : Math.round(value);
}
