"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { places, residences, stays } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { getPrimaryHouseholdId } from "@/lib/db/scope";
import { syncResidenceCostToBudget } from "@/lib/correspondences/sync";

function str(fd: FormData, key: string, max = 200): string {
  const value = fd.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalNumber(value: string): string | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toFixed(2);
}

const residenceTenures = ["rent", "own", "other"] as const;
type ResidenceTenure = (typeof residenceTenures)[number];

function parseTenure(formData: FormData): ResidenceTenure {
  const tenure = str(formData, "tenure", 20);
  return residenceTenures.includes(tenure as ResidenceTenure)
    ? (tenure as ResidenceTenure)
    : "rent";
}

function parseLandlord(formData: FormData, tenure: ResidenceTenure) {
  if (tenure !== "rent") return null;
  return str(formData, "landlord", 200) || null;
}

export async function createResidence(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const placeId = str(formData, "placeId", 80);
  const role = str(formData, "role", 20);
  const tenure = parseTenure(formData);
  const startedOn = str(formData, "startedOn", 10) || new Date().toISOString().slice(0, 10);
  if (!placeId || !["primary", "secondary", "former"].includes(role)) {
    throw new Error("Place and role are required.");
  }
  await assertPlace(householdId, placeId);

  await db.transaction(async (tx) => {
    if (role === "primary") {
      await tx
        .update(residences)
        .set({ endedOn: startedOn, role: "former" })
        .where(
          and(
            eq(residences.householdId, householdId),
            eq(residences.role, "primary"),
            isNull(residences.endedOn),
          ),
        );
    }
    const residenceId = randomUUID();
    await tx.insert(residences).values({
      id: residenceId,
      householdId,
      placeId,
      role: role as "primary" | "secondary" | "former",
      tenure,
      startedOn,
      endedOn: str(formData, "endedOn", 10) || null,
      householdSharePct: (Number(str(formData, "householdSharePct")) || 100).toFixed(2),
      costPerMonth: optionalNumber(str(formData, "costPerMonth")),
      currency: str(formData, "currency", 3) || "USD",
      landlord: parseLandlord(formData, tenure),
      notes: str(formData, "notes", 500) || null,
    });
    await syncResidenceCostToBudget(tx, householdId, residenceId);
  });

  revalidateLocation();
}

export async function moveResidence(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const placeId = str(formData, "placeId", 80);
  const startedOn = str(formData, "startedOn", 10) || new Date().toISOString().slice(0, 10);
  if (!placeId) throw new Error("Place is required.");
  await assertPlace(householdId, placeId);

  await db.transaction(async (tx) => {
    await tx
      .update(residences)
      .set({ endedOn: startedOn, role: "former" })
      .where(
        and(
          eq(residences.householdId, householdId),
          eq(residences.role, "primary"),
          isNull(residences.endedOn),
        ),
      );
    await tx
      .update(stays)
      .set({ endedOn: startedOn })
      .where(and(eq(stays.householdId, householdId), isNull(stays.endedOn)));
    const residenceId = randomUUID();
    await tx.insert(residences).values({
      id: residenceId,
      householdId,
      placeId,
      role: "primary",
      startedOn,
      householdSharePct: "100.00",
      currency: str(formData, "currency", 3) || "USD",
    });
    await tx.insert(stays).values({
      id: randomUUID(),
      householdId,
      placeId,
      kind: "residence",
      startedOn,
    });
    await syncResidenceCostToBudget(tx, householdId, residenceId);
  });

  revalidateLocation();
}

export async function updateResidence(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const id = str(formData, "id", 80);
  const placeId = str(formData, "placeId", 80);
  const role = str(formData, "role", 20);
  const tenure = parseTenure(formData);
  const startedOn = str(formData, "startedOn", 10) || new Date().toISOString().slice(0, 10);
  if (!id || !placeId || !["primary", "secondary", "former"].includes(role)) {
    throw new Error("Residence, place, and role are required.");
  }
  await assertPlace(householdId, placeId);

  await db.transaction(async (tx) => {
    if (role === "primary") {
      await tx
        .update(residences)
        .set({ endedOn: startedOn, role: "former" })
        .where(
          and(
            eq(residences.householdId, householdId),
            eq(residences.role, "primary"),
            isNull(residences.endedOn),
            ne(residences.id, id),
          ),
        );
    }

    await tx
      .update(residences)
      .set({
        placeId,
        role: role as "primary" | "secondary" | "former",
        tenure,
        startedOn,
        endedOn: str(formData, "endedOn", 10) || null,
        householdSharePct: (Number(str(formData, "householdSharePct")) || 100).toFixed(2),
        costPerMonth: optionalNumber(str(formData, "costPerMonth")),
        currency: str(formData, "currency", 3) || "USD",
        landlord: parseLandlord(formData, tenure),
        notes: str(formData, "notes", 500) || null,
      })
      .where(and(eq(residences.id, id), eq(residences.householdId, householdId)));
    await syncResidenceCostToBudget(tx, householdId, id);
  });
  revalidateLocation();
}

export async function archiveResidence(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const id = str(formData, "id", 80);
  if (!id) return;
  await db
    .update(residences)
    .set({ endedOn: new Date().toISOString().slice(0, 10), role: "former" })
    .where(and(eq(residences.id, id), eq(residences.householdId, householdId)));
  revalidateLocation();
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
  revalidatePath("/financial", "layout");
  revalidatePath("/dashboard");
}
