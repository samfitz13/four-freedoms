"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bodyMeasurements } from "@/lib/db/schema";
import { lbToKg } from "@/lib/freedoms/health-units";
import { healthScope, id, note, optionalNum, recordedAt, revalidateHealth } from "./helpers";

export async function createBodyMeasurement(formData: FormData) {
  const householdId = await healthScope();

  await db.insert(bodyMeasurements).values({
    id: randomUUID(),
    householdId,
    recordedAt: recordedAt(formData),
    weightKg: weightLbToKgOrNull(optionalNum(formData, "weightLb", { min: 0, max: 1100 })),
    bodyFatPct: decimalOrNull(optionalNum(formData, "bodyFatPct", { min: 0, max: 100 })),
    waistCm: decimalOrNull(optionalNum(formData, "waistCm", { min: 0, max: 300 })),
    restingHr: intOrNull(optionalNum(formData, "restingHr", { min: 20, max: 200 })),
    note: note(formData),
  });

  revalidateHealth();
}

export async function updateBodyMeasurement(formData: FormData) {
  const householdId = await healthScope();

  await db
    .update(bodyMeasurements)
    .set({
      recordedAt: recordedAt(formData),
      weightKg: weightLbToKgOrNull(optionalNum(formData, "weightLb", { min: 0, max: 1100 })),
      bodyFatPct: decimalOrNull(optionalNum(formData, "bodyFatPct", { min: 0, max: 100 })),
      waistCm: decimalOrNull(optionalNum(formData, "waistCm", { min: 0, max: 300 })),
      restingHr: intOrNull(optionalNum(formData, "restingHr", { min: 20, max: 200 })),
      note: note(formData),
    })
    .where(
      and(eq(bodyMeasurements.id, id(formData)), eq(bodyMeasurements.householdId, householdId)),
    );

  revalidateHealth();
}

export async function deleteBodyMeasurement(formData: FormData) {
  const householdId = await healthScope();
  await db
    .delete(bodyMeasurements)
    .where(
      and(eq(bodyMeasurements.id, id(formData)), eq(bodyMeasurements.householdId, householdId)),
    );
  revalidateHealth();
}

function decimalOrNull(value: number | null) {
  return value === null ? null : value.toFixed(2);
}

function weightLbToKgOrNull(value: number | null) {
  return value === null ? null : lbToKg(value).toFixed(2);
}

function intOrNull(value: number | null) {
  return value === null ? null : Math.round(value);
}
