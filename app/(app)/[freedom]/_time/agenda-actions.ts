"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { RRule } from "rrule";
import { z } from "zod";
import { requireUser } from "@/lib/auth-server";
import { db } from "@/lib/db/client";
import { scopeForUser } from "@/lib/db/scope";
import { timeEvents } from "@/lib/db/schema";
import { deleteMirrorForEvent, syncEventToTrip } from "@/lib/correspondences/sync";
import { eventStatusSchema, optionalString, str } from "./schemas";

const eventSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1).max(120),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  allDay: z.boolean(),
  location: z.string().max(160).nullable(),
  description: z.string().max(1000).nullable(),
  pursuitId: z.string().min(1).nullable(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  timezone: z.string().min(1).max(80).default("UTC"),
  status: eventStatusSchema.default("confirmed"),
});

export async function createEvent(formData: FormData): Promise<void> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const parsed = parseEvent(formData);
  if (!parsed.success) return;
  if (parsed.data.endsAt <= parsed.data.startsAt) {
    return;
  }

  await db.insert(timeEvents).values({
    id: randomUUID(),
    householdId: scope.primaryHouseholdId,
    source: "native",
    title: parsed.data.title,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    allDay: parsed.data.allDay,
    location: parsed.data.location,
    description: parsed.data.description,
    pursuitId: parsed.data.pursuitId,
    rrule: buildRrule(parsed.data.recurrence, parsed.data.startsAt),
    timezone: parsed.data.timezone,
    status: parsed.data.status,
  });
  revalidateTime();
}

export async function updateEvent(formData: FormData): Promise<void> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const parsed = parseEvent(formData);
  if (!parsed.success || !parsed.data.id) return;
  if (parsed.data.endsAt <= parsed.data.startsAt) {
    return;
  }
  const eventId = parsed.data.id;

  await db.transaction(async (tx) => {
    await tx
      .update(timeEvents)
      .set({
        title: parsed.data.title,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        allDay: parsed.data.allDay,
        location: parsed.data.location,
        description: parsed.data.description,
        pursuitId: parsed.data.pursuitId,
        rrule: buildRrule(parsed.data.recurrence, parsed.data.startsAt),
        timezone: parsed.data.timezone,
        status: parsed.data.status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(timeEvents.id, eventId),
          eq(timeEvents.householdId, scope.primaryHouseholdId),
          eq(timeEvents.source, "native"),
        ),
      );
    await syncEventToTrip(tx, scope.primaryHouseholdId, eventId);
  });
  revalidateTime();
}

export async function deleteEvent(formData: FormData) {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = str(formData, "id");
  if (!id) return;
  await db.transaction(async (tx) => {
    await deleteMirrorForEvent(tx, scope.primaryHouseholdId, id);
    await tx
      .delete(timeEvents)
      .where(
        and(
          eq(timeEvents.id, id),
          eq(timeEvents.householdId, scope.primaryHouseholdId),
          eq(timeEvents.source, "native"),
        ),
      );
  });
  revalidateTime();
}

export async function cancelOccurrence(formData: FormData) {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = str(formData, "id");
  if (!id) return;
  await db
    .update(timeEvents)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(timeEvents.id, id), eq(timeEvents.householdId, scope.primaryHouseholdId)));
  revalidateTime();
}

function parseEvent(formData: FormData) {
  return eventSchema.safeParse({
    id: str(formData, "id") || undefined,
    title: str(formData, "title"),
    startsAt: str(formData, "startsAt"),
    endsAt: str(formData, "endsAt"),
    allDay: str(formData, "allDay") === "on",
    location: optionalString(formData, "location"),
    description: optionalString(formData, "description"),
    pursuitId: optionalString(formData, "pursuitId"),
    recurrence: str(formData, "recurrence") || "none",
    timezone: str(formData, "timezone") || "UTC",
    status: str(formData, "status") || "confirmed",
  });
}

function buildRrule(recurrence: "none" | "daily" | "weekly" | "monthly", startsAt: Date) {
  if (recurrence === "none") return null;
  const freq =
    recurrence === "daily" ? RRule.DAILY : recurrence === "weekly" ? RRule.WEEKLY : RRule.MONTHLY;
  return new RRule({ freq, dtstart: startsAt }).toString();
}

function revalidateTime() {
  revalidatePath("/time", "layout");
  revalidatePath("/location", "layout");
  revalidatePath("/dashboard");
}
