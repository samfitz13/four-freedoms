"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { connectionVisits, connections, habits, places } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { getPrimaryHouseholdId } from "@/lib/db/scope";
import { syncConnectionVisitToEvent } from "@/lib/correspondences/sync";

function str(fd: FormData, key: string, max = 200): string {
  const value = fd.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const KINDS = ["family", "friend", "partner", "community", "neighbor", "mentor", "other"] as const;
const CADENCES = ["weekly", "biweekly", "monthly", "quarterly", "yearly"] as const;
type ConnectionKind = (typeof KINDS)[number];
type ConnectionCadence = (typeof CADENCES)[number];

export async function createConnection(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const name = str(formData, "name", 120);
  const kind = str(formData, "kind", 40);
  if (!name || !isKind(kind)) throw new Error("Name and kind are required.");
  const placeId = str(formData, "placeId", 80) || null;
  if (placeId) await assertPlace(householdId, placeId);

  await db.insert(connections).values({
    id: randomUUID(),
    householdId,
    name,
    kind,
    placeId,
    cadence: parseCadence(str(formData, "cadence", 40)),
    lastSeenOn: str(formData, "lastSeenOn", 10) || null,
    note: str(formData, "note", 500) || null,
  });
  revalidateLocation();
}

export async function updateConnection(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const id = str(formData, "id", 80);
  const kind = str(formData, "kind", 40);
  if (!id || !isKind(kind)) throw new Error("Connection not found.");
  const placeId = str(formData, "placeId", 80) || null;
  if (placeId) await assertPlace(householdId, placeId);

  await db
    .update(connections)
    .set({
      name: str(formData, "name", 120),
      kind,
      placeId,
      cadence: parseCadence(str(formData, "cadence", 40)),
      lastSeenOn: str(formData, "lastSeenOn", 10) || null,
      note: str(formData, "note", 500) || null,
    })
    .where(and(eq(connections.id, id), eq(connections.householdId, householdId)));
  revalidateLocation();
}

export async function logVisit(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const connectionId = str(formData, "connectionId", 80);
  const occurredOn = str(formData, "occurredOn", 10) || new Date().toISOString().slice(0, 10);
  if (!connectionId) throw new Error("Connection is required.");
  const [connection] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(and(eq(connections.id, connectionId), eq(connections.householdId, householdId)))
    .limit(1);
  if (!connection) throw new Error("Connection not found.");

  const placeId = str(formData, "placeId", 80) || null;
  if (placeId) await assertPlace(householdId, placeId);

  await db.transaction(async (tx) => {
    const visitId = randomUUID();
    await tx.insert(connectionVisits).values({
      id: visitId,
      householdId,
      connectionId,
      occurredOn,
      placeId,
      note: str(formData, "note", 500) || null,
    });
    await tx
      .update(connections)
      .set({ lastSeenOn: occurredOn })
      .where(and(eq(connections.id, connectionId), eq(connections.householdId, householdId)));
    await syncConnectionVisitToEvent(tx, householdId, visitId);
  });
  revalidateLocation();
}

export async function promoteToHabit(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const connectionId = str(formData, "connectionId", 80);
  const [connection] = await db
    .select({ name: connections.name, cadence: connections.cadence })
    .from(connections)
    .where(and(eq(connections.id, connectionId), eq(connections.householdId, householdId)))
    .limit(1);
  if (!connection) throw new Error("Connection not found.");

  await db.insert(habits).values({
    id: randomUUID(),
    householdId,
    title: `See ${connection.name}`,
    cadence: connection.cadence === "weekly" ? "weekly" : "custom",
    targetPerWeek: connection.cadence === "weekly" ? 1 : 0,
    startedOn: new Date().toISOString().slice(0, 10),
  });
  revalidatePath("/time", "layout");
  revalidateLocation();
}

export async function archiveConnection(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const id = str(formData, "id", 80);
  if (!id) return;
  await db
    .update(connections)
    .set({ archivedAt: new Date() })
    .where(and(eq(connections.id, id), eq(connections.householdId, householdId)));
  revalidateLocation();
}

function parseCadence(value: string): ConnectionCadence | null {
  return CADENCES.includes(value as ConnectionCadence) ? (value as ConnectionCadence) : null;
}

function isKind(value: string): value is ConnectionKind {
  return KINDS.includes(value as ConnectionKind);
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
