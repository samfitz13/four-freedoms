"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth-server";
import { db } from "@/lib/db/client";
import { scopeForUser } from "@/lib/db/scope";
import { habitCheckins, habits } from "@/lib/db/schema";
import { habitCadenceSchema, isoDateSchema, optionalString, str } from "./schemas";
import type { ActionResult } from "./types";

const habitSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1).max(100),
  pursuitId: z.string().min(1).nullable(),
  cadence: habitCadenceSchema,
  targetPerWeek: z.coerce.number().int().min(1).max(7),
  timeOfDay: z.string().max(40).nullable(),
  linkKind: z.enum(["none", "workout", "sleep", "body_weight"]).default("none"),
  linkParams: z.record(z.string(), z.unknown()).default({}),
  startedOn: isoDateSchema,
});

export async function createHabit(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const parsed = parseHabit(formData);
  if (!parsed.success)
    return { ok: false, error: "Check the habit name, weekly target, and start date." };

  await db.insert(habits).values({
    id: randomUUID(),
    householdId: scope.primaryHouseholdId,
    title: parsed.data.title,
    pursuitId: parsed.data.pursuitId,
    cadence: parsed.data.cadence,
    targetPerWeek: parsed.data.targetPerWeek,
    timeOfDay: parsed.data.timeOfDay,
    linkKind: parsed.data.linkKind,
    linkParams: parsed.data.linkParams,
    startedOn: parsed.data.startedOn,
  });
  revalidateTime();
  return { ok: true, message: "Habit added." };
}

export async function updateHabit(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const parsed = parseHabit(formData);
  if (!parsed.success || !parsed.data.id)
    return { ok: false, error: "Check the habit name, weekly target, and start date." };

  await db
    .update(habits)
    .set({
      title: parsed.data.title,
      pursuitId: parsed.data.pursuitId,
      cadence: parsed.data.cadence,
      targetPerWeek: parsed.data.targetPerWeek,
      timeOfDay: parsed.data.timeOfDay,
      linkKind: parsed.data.linkKind,
      linkParams: parsed.data.linkParams,
      startedOn: parsed.data.startedOn,
    })
    .where(and(eq(habits.id, parsed.data.id), eq(habits.householdId, scope.primaryHouseholdId)));
  revalidateTime();
  return { ok: true, message: "Habit updated." };
}

export async function archiveHabit(formData: FormData) {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = str(formData, "id");
  if (!id) return;
  await db
    .update(habits)
    .set({ archivedAt: new Date() })
    .where(and(eq(habits.id, id), eq(habits.householdId, scope.primaryHouseholdId)));
  revalidateTime();
}

export async function toggleCheckin(formData: FormData) {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const parsed = z.object({ habitId: z.string().min(1), occurredOn: isoDateSchema }).safeParse({
    habitId: str(formData, "habitId"),
    occurredOn: str(formData, "occurredOn") || new Date().toISOString().slice(0, 10),
  });
  if (!parsed.success) return;

  const [habit] = await db
    .select({ linkKind: habits.linkKind })
    .from(habits)
    .where(
      and(eq(habits.id, parsed.data.habitId), eq(habits.householdId, scope.primaryHouseholdId)),
    )
    .limit(1);
  if (!habit || habit.linkKind !== "none") return;

  const existing = await db
    .select({ id: habitCheckins.id })
    .from(habitCheckins)
    .where(
      and(
        eq(habitCheckins.householdId, scope.primaryHouseholdId),
        eq(habitCheckins.habitId, parsed.data.habitId),
        eq(habitCheckins.occurredOn, parsed.data.occurredOn),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .delete(habitCheckins)
      .where(
        and(
          eq(habitCheckins.id, existing[0].id),
          eq(habitCheckins.householdId, scope.primaryHouseholdId),
        ),
      );
  } else {
    await db.insert(habitCheckins).values({
      id: randomUUID(),
      householdId: scope.primaryHouseholdId,
      habitId: parsed.data.habitId,
      occurredOn: parsed.data.occurredOn,
    });
  }
  revalidateTime();
}

function parseHabit(formData: FormData) {
  return habitSchema.safeParse({
    id: str(formData, "id") || undefined,
    title: str(formData, "title"),
    pursuitId: optionalString(formData, "pursuitId"),
    cadence: str(formData, "cadence") || "daily",
    targetPerWeek: str(formData, "targetPerWeek") || "7",
    timeOfDay: optionalString(formData, "timeOfDay"),
    linkKind: str(formData, "linkKind") || "none",
    linkParams: linkParams(formData),
    startedOn: str(formData, "startedOn") || new Date().toISOString().slice(0, 10),
  });
}

function linkParams(formData: FormData) {
  const linkKind = str(formData, "linkKind") || "none";
  if (linkKind === "workout") return { minMinutes: Number(str(formData, "minMinutes")) || 30 };
  if (linkKind === "sleep") return { minHours: Number(str(formData, "minHours")) || 7 };
  return {};
}

function revalidateTime() {
  revalidatePath("/time", "layout");
  revalidatePath("/dashboard");
}
