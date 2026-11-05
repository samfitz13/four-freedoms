"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { healthCheckins } from "@/lib/db/schema";
import { healthScope, id, note, optionalNum, recordedAt, revalidateHealth } from "./helpers";

export async function createCheckin(formData: FormData) {
  const householdId = await healthScope();

  await db.insert(healthCheckins).values({
    id: randomUUID(),
    householdId,
    recordedAt: recordedAt(formData),
    energy: intOrNull(optionalNum(formData, "energy", { min: 1, max: 10 })),
    restingHr: intOrNull(optionalNum(formData, "restingHr", { min: 20, max: 200 })),
    note: note(formData),
  });

  revalidateHealth();
}

export async function updateCheckin(formData: FormData) {
  const householdId = await healthScope();

  await db
    .update(healthCheckins)
    .set({
      recordedAt: recordedAt(formData),
      energy: intOrNull(optionalNum(formData, "energy", { min: 1, max: 10 })),
      restingHr: intOrNull(optionalNum(formData, "restingHr", { min: 20, max: 200 })),
      note: note(formData),
    })
    .where(and(eq(healthCheckins.id, id(formData)), eq(healthCheckins.householdId, householdId)));

  revalidateHealth();
}

export async function deleteCheckin(formData: FormData) {
  const householdId = await healthScope();
  await db
    .delete(healthCheckins)
    .where(and(eq(healthCheckins.id, id(formData)), eq(healthCheckins.householdId, householdId)));
  revalidateHealth();
}

function intOrNull(value: number | null) {
  return value === null ? null : Math.round(value);
}
