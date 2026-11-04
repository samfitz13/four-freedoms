"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { connections, locationSatisfactions, places, stays } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { getPrimaryHouseholdId } from "@/lib/db/scope";

function str(raw: FormDataEntryValue | null, max = 120): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t === "" ? null : t.slice(0, max);
}

/** Create a new place. Country is optional. */
export async function createPlace(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const name = str(formData.get("name"));
  if (!name) throw new Error("Name is required.");
  const country = str(formData.get("country"));
  const isPreferred = formData.get("isPreferred") === "on";

  await db
    .insert(places)
    .values({
      id: randomUUID(),
      householdId,
      name,
      country,
      isPreferred,
    })
    .onConflictDoNothing({
      target: [places.householdId, places.name, places.country],
    });

  revalidatePath("/location", "layout");
  revalidatePath("/dashboard");
}

/** Toggle the `is_preferred` flag on a place. */
export async function togglePreferred(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const id = str(formData.get("id"), 64);
  if (!id) throw new Error("Place id is required.");
  const current = await db
    .select({ isPreferred: places.isPreferred })
    .from(places)
    .where(and(eq(places.id, id), eq(places.householdId, householdId)))
    .limit(1);
  const next = !(current[0]?.isPreferred ?? false);
  await db
    .update(places)
    .set({ isPreferred: next })
    .where(and(eq(places.id, id), eq(places.householdId, householdId)));
  revalidatePath("/location", "layout");
  revalidatePath("/dashboard");
}

/** Archive a place (soft-delete) so it stops appearing in forms. */
export async function archivePlace(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const id = str(formData.get("id"), 64);
  if (!id) throw new Error("Place id is required.");
  await db
    .update(places)
    .set({ archivedAt: new Date() })
    .where(and(eq(places.id, id), eq(places.householdId, householdId)));
  revalidatePath("/location", "layout");
}

/** Start a new stay at `placeId`, closing any open stay first. */
export async function startStay(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const placeId = str(formData.get("placeId"), 64);
  if (!placeId) throw new Error("Place is required.");
  const startedOn = str(formData.get("startedOn"), 10) ?? new Date().toISOString().slice(0, 10);

  // Close any currently-open stay for this household.
  await db
    .update(stays)
    .set({ endedOn: startedOn })
    .where(and(eq(stays.householdId, householdId), isNull(stays.endedOn)));

  await db
    .insert(stays)
    .values({
      id: randomUUID(),
      householdId,
      placeId,
      kind: "other",
      startedOn,
    })
    .onConflictDoNothing({
      target: [stays.householdId, stays.placeId, stays.startedOn],
    });

  revalidatePath("/location", "layout");
  revalidatePath("/dashboard");
}

/** End the currently-open stay (no-op if none). */
export async function endCurrentStay(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const endedOn = str(formData.get("endedOn"), 10) ?? new Date().toISOString().slice(0, 10);
  await db
    .update(stays)
    .set({ endedOn })
    .where(and(eq(stays.householdId, householdId), isNull(stays.endedOn)));
  revalidatePath("/location", "layout");
  revalidatePath("/dashboard");
}

/** Upsert today's satisfaction (1..10). */
export async function logSatisfaction(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const raw = formData.get("satisfaction");
  const sat = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(sat) || sat < 1 || sat > 10) {
    throw new Error("Satisfaction must be 1..10.");
  }
  const recordedOn = str(formData.get("recordedOn"), 10) ?? new Date().toISOString().slice(0, 10);
  const note = str(formData.get("note"), 500);
  const withConnectionIds = await validConnectionIds(
    householdId,
    formData.getAll("withConnectionIds"),
  );

  // Resolve currently-open stay's placeId (if any) for association.
  const [openStay] = await db
    .select({ placeId: stays.placeId })
    .from(stays)
    .where(and(eq(stays.householdId, householdId), isNull(stays.endedOn)))
    .orderBy(desc(stays.startedOn))
    .limit(1);

  await db
    .insert(locationSatisfactions)
    .values({
      id: randomUUID(),
      householdId,
      recordedOn,
      satisfaction: sat,
      placeId: openStay?.placeId ?? null,
      withConnectionIds,
      note,
    })
    .onConflictDoUpdate({
      target: [locationSatisfactions.householdId, locationSatisfactions.recordedOn],
      set: { satisfaction: sat, placeId: openStay?.placeId ?? null, withConnectionIds, note },
    });

  revalidatePath("/location", "layout");
  revalidatePath("/dashboard");
}

async function validConnectionIds(
  householdId: string,
  rawIds: FormDataEntryValue[],
): Promise<string[]> {
  const ids = rawIds.flatMap((value) => {
    if (typeof value !== "string") return [];
    const id = value.trim();
    return id ? [id] : [];
  });
  if (!ids.length) return [];

  const rows = await db
    .select({ id: connections.id })
    .from(connections)
    .where(and(eq(connections.householdId, householdId), inArray(connections.id, ids)));
  return rows.map((row) => row.id);
}
