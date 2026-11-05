"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth-server";
import { db } from "@/lib/db/client";
import { scopeForUser } from "@/lib/db/scope";
import { freedomSettings, timeLogEntries, timePursuits, workouts } from "@/lib/db/schema";
import { ensureTimeSeeded } from "@/lib/freedoms/time-seed";
import { isoDateSchema, optionalString, str } from "./schemas";

const careBridgePattern = /gym|workout|run|ride|lift|sport/i;

const upsertSchema = z.object({
  pursuitId: z.string().min(1),
  recordedOn: isoDateSchema,
  hours: z.coerce.number().finite().min(0).max(24),
  note: z.string().max(500).nullable(),
});

export async function upsertLogEntry(formData: FormData): Promise<void> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  await ensureTimeSeeded(scope.primaryHouseholdId);

  const parsed = upsertSchema.safeParse({
    pursuitId: str(formData, "pursuitId"),
    recordedOn: str(formData, "recordedOn") || new Date().toISOString().slice(0, 10),
    hours: str(formData, "hours"),
    note: optionalString(formData, "note"),
  });
  if (!parsed.success) {
    return;
  }

  const [pursuit] = await db
    .select()
    .from(timePursuits)
    .where(
      and(
        eq(timePursuits.id, parsed.data.pursuitId),
        eq(timePursuits.householdId, scope.primaryHouseholdId),
      ),
    )
    .limit(1);
  if (!pursuit) return;

  if (parsed.data.hours === 0) {
    await db
      .delete(timeLogEntries)
      .where(
        and(
          eq(timeLogEntries.householdId, scope.primaryHouseholdId),
          eq(timeLogEntries.pursuitId, parsed.data.pursuitId),
          eq(timeLogEntries.recordedOn, parsed.data.recordedOn),
        ),
      );
  } else {
    await db
      .insert(timeLogEntries)
      .values({
        id: randomUUID(),
        householdId: scope.primaryHouseholdId,
        pursuitId: parsed.data.pursuitId,
        recordedOn: parsed.data.recordedOn,
        hours: parsed.data.hours.toFixed(2),
        note: parsed.data.note,
        source: "manual",
      })
      .onConflictDoUpdate({
        target: [timeLogEntries.householdId, timeLogEntries.pursuitId, timeLogEntries.recordedOn],
        set: {
          hours: parsed.data.hours.toFixed(2),
          note: parsed.data.note,
          source: "manual",
        },
      });
  }

  await maybeBridgeToHealth(
    scope.primaryHouseholdId,
    pursuit,
    parsed.data.recordedOn,
    parsed.data.hours,
  );
  revalidateTime();
}

export async function deleteLogEntry(formData: FormData) {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = str(formData, "id");
  if (!id) return;
  await db
    .delete(timeLogEntries)
    .where(
      and(eq(timeLogEntries.id, id), eq(timeLogEntries.householdId, scope.primaryHouseholdId)),
    );
  revalidateTime();
}

async function maybeBridgeToHealth(
  householdId: string,
  pursuit: typeof timePursuits.$inferSelect,
  recordedOn: string,
  hours: number,
) {
  if (hours <= 0 || pursuit.kind !== "care" || !careBridgePattern.test(pursuit.name)) return;

  const [setting] = await db
    .select({ targetJson: freedomSettings.targetJson })
    .from(freedomSettings)
    .where(and(eq(freedomSettings.householdId, householdId), eq(freedomSettings.freedom, "time")))
    .limit(1);
  const target = setting?.targetJson;
  const bridgeToHealth =
    typeof target === "object" &&
    target !== null &&
    "time" in target &&
    typeof target.time === "object" &&
    target.time !== null &&
    "bridgeToHealth" in target.time
      ? target.time.bridgeToHealth !== false
      : true;
  if (!bridgeToHealth) return;

  await db.insert(workouts).values({
    id: randomUUID(),
    householdId,
    performedAt: new Date(`${recordedOn}T12:00:00`),
    kind: "other",
    minutes: Math.round(hours * 60),
    note: `Bridged from Time: ${pursuit.name}`,
  });
}

function revalidateTime() {
  revalidatePath("/time", "layout");
  revalidatePath("/health", "layout");
  revalidatePath("/dashboard");
}
