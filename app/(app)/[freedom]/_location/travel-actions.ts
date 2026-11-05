"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { places, stays, trips } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { getPrimaryHouseholdId } from "@/lib/db/scope";
import { syncTripToEvent } from "@/lib/correspondences/sync";
import { validTravelDates } from "./travel-view";

function str(fd: FormData, key: string, max = 200): string {
  const value = fd.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const PURPOSES = ["vacation", "family", "work", "medical", "retreat", "other"] as const;
type TripPurpose = (typeof PURPOSES)[number];

export async function createTrip(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const name = str(formData, "name", 120);
  const purpose = str(formData, "purpose", 40);
  const placeId = str(formData, "placeId", 80);
  const startsOn = str(formData, "startsOn", 10);
  const endsOn = str(formData, "endsOn", 10);
  if (!name || !placeId || !startsOn || !endsOn || !isPurpose(purpose)) {
    throw new Error("Trip details and destination are required.");
  }
  if (!validTravelDates(startsOn, endsOn)) throw new Error("Valid trip dates are required.");
  await assertPlace(householdId, placeId);

  await db.transaction(async (tx) => {
    const tripId = randomUUID();
    await tx.insert(trips).values({
      id: tripId,
      householdId,
      name,
      purpose,
      startsOn,
      endsOn,
      budgetAmount: optionalMoney(str(formData, "budgetAmount")),
      currency: str(formData, "currency", 3).toUpperCase() || "USD",
      notes: str(formData, "notes", 500) || null,
    });
    await tx.insert(stays).values({
      id: randomUUID(),
      householdId,
      placeId,
      kind: "trip",
      tripId,
      startedOn: startsOn,
      endedOn: endsOn,
    });
    await syncTripToEvent(tx, householdId, tripId);
  });
  revalidateLocation();
}

export async function updateTrip(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const id = str(formData, "id", 80);
  const purpose = str(formData, "purpose", 40);
  const name = str(formData, "name", 120);
  const startsOn = str(formData, "startsOn", 10);
  const endsOn = str(formData, "endsOn", 10);
  if (!id || !name || !isPurpose(purpose)) throw new Error("Trip details are required.");
  if (!validTravelDates(startsOn, endsOn)) throw new Error("Valid trip dates are required.");

  await db.transaction(async (tx) => {
    await tx
      .update(trips)
      .set({
        name,
        purpose,
        startsOn,
        endsOn,
        budgetAmount: optionalMoney(str(formData, "budgetAmount")),
        currency: str(formData, "currency", 3).toUpperCase() || "USD",
        notes: str(formData, "notes", 500) || null,
      })
      .where(and(eq(trips.id, id), eq(trips.householdId, householdId)));
    await syncTripToEvent(tx, householdId, id);
  });
  revalidateLocation();
}

export async function archiveTrip(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const id = str(formData, "id", 80);
  if (!id) return;
  await db.transaction(async (tx) => {
    await tx
      .update(trips)
      .set({ archivedAt: new Date() })
      .where(and(eq(trips.id, id), eq(trips.householdId, householdId)));
    await syncTripToEvent(tx, householdId, id);
  });
  revalidateLocation();
}

export async function upsertStay(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const placeId = str(formData, "placeId", 80);
  const startedOn = str(formData, "startedOn", 10);
  const kind = str(formData, "kind", 20) || "trip";
  if (!placeId || !startedOn || !["residence", "trip", "visit", "other"].includes(kind)) {
    throw new Error("Stay details are required.");
  }
  await assertPlace(householdId, placeId);
  const tripId = str(formData, "tripId", 80) || null;
  const endedOn = str(formData, "endedOn", 10) || null;
  if (!validTravelDates(startedOn, endedOn ?? startedOn)) {
    throw new Error("Valid stay dates are required.");
  }
  if (tripId) {
    const [trip] = await db
      .select({ id: trips.id })
      .from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.householdId, householdId)))
      .limit(1);
    if (!trip) throw new Error("Trip not found.");
  }

  await db
    .insert(stays)
    .values({
      id: randomUUID(),
      householdId,
      placeId,
      kind: kind as "residence" | "trip" | "visit" | "other",
      tripId,
      startedOn,
      endedOn,
      note: str(formData, "note", 500) || null,
    })
    .onConflictDoUpdate({
      target: [stays.householdId, stays.placeId, stays.startedOn],
      set: {
        kind: kind as "residence" | "trip" | "visit" | "other",
        tripId,
        endedOn,
        note: str(formData, "note", 500) || null,
      },
    });
  revalidateLocation();
}

function optionalMoney(value: string): string | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

function isPurpose(value: string): value is TripPurpose {
  return PURPOSES.includes(value as TripPurpose);
}

async function assertPlace(householdId: string, placeId: string) {
  const [place] = await db
    .select({ id: places.id })
    .from(places)
    .where(and(eq(places.id, placeId), eq(places.householdId, householdId)))
    .limit(1);
  if (!place) throw new Error("Place not found.");
}

function revalidateLocation() {
  revalidatePath("/location", "layout");
  revalidatePath("/time", "layout");
  revalidatePath("/dashboard");
}
