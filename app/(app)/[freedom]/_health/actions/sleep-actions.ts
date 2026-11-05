"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sleepLogs } from "@/lib/db/schema";
import {
  healthScope,
  id,
  isoDate,
  note,
  optionalTime,
  requiredNum,
  revalidateHealth,
} from "./helpers";

export async function createSleepLog(formData: FormData) {
  const householdId = await healthScope();
  const sleepHours = requiredNum(formData, "sleepHours", { min: 0, max: 24 });

  await db.insert(sleepLogs).values({
    id: randomUUID(),
    householdId,
    recordedOn: isoDate(formData, "recordedOn"),
    sleepHours: sleepHours.toFixed(2),
    bedAt: optionalTime(formData, "bedAt"),
    wakeAt: optionalTime(formData, "wakeAt"),
    note: note(formData),
  });

  revalidateHealth();
}

export async function updateSleepLog(formData: FormData) {
  const householdId = await healthScope();
  const sleepHours = requiredNum(formData, "sleepHours", { min: 0, max: 24 });

  await db
    .update(sleepLogs)
    .set({
      recordedOn: isoDate(formData, "recordedOn"),
      sleepHours: sleepHours.toFixed(2),
      bedAt: optionalTime(formData, "bedAt"),
      wakeAt: optionalTime(formData, "wakeAt"),
      note: note(formData),
    })
    .where(and(eq(sleepLogs.id, id(formData)), eq(sleepLogs.householdId, householdId)));

  revalidateHealth();
}

export async function deleteSleepLog(formData: FormData) {
  const householdId = await healthScope();
  await db
    .delete(sleepLogs)
    .where(and(eq(sleepLogs.id, id(formData)), eq(sleepLogs.householdId, householdId)));
  revalidateHealth();
}
