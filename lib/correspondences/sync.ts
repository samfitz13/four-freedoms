import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  budgetCategories,
  budgetPeriods,
  connectionVisits,
  connections,
  places,
  residences,
  stays,
  syncEvents,
  timeEvents,
  trips,
} from "@/lib/db/schema";
import { toNumber } from "@/lib/db/queries/financial";

type DbClient = typeof db;
type TxClient = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type Client = DbClient | TxClient;

export async function journalSync(
  client: Client,
  input: {
    householdId: string;
    kind: "trip_time_event" | "connection_visit_time_event" | "residence_housing_budget";
    sourceId: string;
    targetId: string;
  },
) {
  await client.insert(syncEvents).values({ id: randomUUID(), ...input });
}

export async function syncTripToEvent(client: Client, householdId: string, tripId: string) {
  const [trip] = await client
    .select({
      id: trips.id,
      name: trips.name,
      startsOn: trips.startsOn,
      endsOn: trips.endsOn,
      archivedAt: trips.archivedAt,
      placeName: places.name,
    })
    .from(trips)
    .leftJoin(stays, and(eq(stays.tripId, trips.id), eq(stays.householdId, householdId)))
    .leftJoin(places, and(eq(stays.placeId, places.id), eq(places.householdId, householdId)))
    .where(and(eq(trips.id, tripId), eq(trips.householdId, householdId)))
    .limit(1);
  const externalId = `trip:${tripId}`;
  if (!trip || trip.archivedAt) {
    await client
      .delete(timeEvents)
      .where(
        and(
          eq(timeEvents.householdId, householdId),
          eq(timeEvents.source, "native"),
          eq(timeEvents.externalId, externalId),
        ),
      );
    return;
  }
  const eventId = randomUUID();
  await client
    .insert(timeEvents)
    .values({
      id: eventId,
      householdId,
      source: "native",
      externalId,
      title: trip.name,
      location: trip.placeName,
      startsAt: dayStart(trip.startsOn),
      endsAt: dayEnd(trip.endsOn),
      allDay: true,
      timezone: "UTC",
    })
    .onConflictDoUpdate({
      target: [timeEvents.householdId, timeEvents.source, timeEvents.externalId],
      set: {
        title: trip.name,
        location: trip.placeName,
        startsAt: dayStart(trip.startsOn),
        endsAt: dayEnd(trip.endsOn),
        allDay: true,
        updatedAt: new Date(),
      },
    });
  await journalSync(client, {
    householdId,
    kind: "trip_time_event",
    sourceId: tripId,
    targetId: eventId,
  });
}

export async function syncEventToTrip(client: Client, householdId: string, eventId: string) {
  const [event] = await client
    .select()
    .from(timeEvents)
    .where(and(eq(timeEvents.id, eventId), eq(timeEvents.householdId, householdId)))
    .limit(1);
  const tripId = event?.externalId?.startsWith("trip:") ? event.externalId.slice(5) : null;
  if (!event || !tripId) return;
  await client
    .update(trips)
    .set({
      name: event.title,
      startsOn: event.startsAt.toISOString().slice(0, 10),
      endsOn: event.endsAt.toISOString().slice(0, 10),
    })
    .where(and(eq(trips.id, tripId), eq(trips.householdId, householdId)));
  await journalSync(client, {
    householdId,
    kind: "trip_time_event",
    sourceId: eventId,
    targetId: tripId,
  });
}

export async function deleteMirrorForEvent(client: Client, householdId: string, eventId: string) {
  const [event] = await client
    .select({ externalId: timeEvents.externalId })
    .from(timeEvents)
    .where(and(eq(timeEvents.id, eventId), eq(timeEvents.householdId, householdId)))
    .limit(1);
  if (event?.externalId?.startsWith("trip:")) {
    await client
      .update(trips)
      .set({ archivedAt: new Date() })
      .where(and(eq(trips.id, event.externalId.slice(5)), eq(trips.householdId, householdId)));
  }
  if (event?.externalId?.startsWith("visit:")) {
    await client
      .delete(connectionVisits)
      .where(
        and(
          eq(connectionVisits.id, event.externalId.slice(6)),
          eq(connectionVisits.householdId, householdId),
        ),
      );
  }
}

export async function syncConnectionVisitToEvent(
  client: Client,
  householdId: string,
  visitId: string,
) {
  const [visit] = await client
    .select({
      id: connectionVisits.id,
      occurredOn: connectionVisits.occurredOn,
      placeName: places.name,
      connectionId: connections.id,
      connectionName: connections.name,
    })
    .from(connectionVisits)
    .innerJoin(
      connections,
      and(
        eq(connectionVisits.connectionId, connections.id),
        eq(connections.householdId, householdId),
      ),
    )
    .leftJoin(
      places,
      and(eq(connectionVisits.placeId, places.id), eq(places.householdId, householdId)),
    )
    .where(and(eq(connectionVisits.id, visitId), eq(connectionVisits.householdId, householdId)))
    .limit(1);
  if (!visit) return;

  const eventId = randomUUID();
  const externalId = `visit:${visit.id}`;
  await client
    .insert(timeEvents)
    .values({
      id: eventId,
      householdId,
      source: "native",
      externalId,
      title: `See ${visit.connectionName}`,
      location: visit.placeName,
      connectionIds: [visit.connectionId],
      startsAt: dayStart(visit.occurredOn),
      endsAt: dayEnd(visit.occurredOn),
      allDay: true,
      timezone: "UTC",
    })
    .onConflictDoUpdate({
      target: [timeEvents.householdId, timeEvents.source, timeEvents.externalId],
      set: {
        title: `See ${visit.connectionName}`,
        location: visit.placeName,
        connectionIds: [visit.connectionId],
        startsAt: dayStart(visit.occurredOn),
        endsAt: dayEnd(visit.occurredOn),
        updatedAt: new Date(),
      },
    });
  await client
    .update(connectionVisits)
    .set({ eventId })
    .where(and(eq(connectionVisits.id, visit.id), eq(connectionVisits.householdId, householdId)));
  await journalSync(client, {
    householdId,
    kind: "connection_visit_time_event",
    sourceId: visit.id,
    targetId: eventId,
  });
}

export async function syncResidenceCostToBudget(
  client: Client,
  householdId: string,
  residenceId: string,
) {
  const [residence] = await client
    .select({ costPerMonth: residences.costPerMonth, currency: residences.currency })
    .from(residences)
    .where(and(eq(residences.id, residenceId), eq(residences.householdId, householdId)))
    .limit(1);
  const plannedAmount = toNumber(residence?.costPerMonth);
  if (plannedAmount <= 0) return;

  const categoryId = await ensureHousingCategory(client, householdId);
  const months = nextMonths(12);
  for (const month of months) {
    await client
      .insert(budgetPeriods)
      .values({
        id: randomUUID(),
        householdId,
        categoryId,
        month,
        plannedAmount: plannedAmount.toFixed(2),
      })
      .onConflictDoUpdate({
        target: [budgetPeriods.householdId, budgetPeriods.month, budgetPeriods.categoryId],
        set: { plannedAmount: plannedAmount.toFixed(2), updatedAt: new Date() },
      });
  }
  await journalSync(client, {
    householdId,
    kind: "residence_housing_budget",
    sourceId: residenceId,
    targetId: categoryId,
  });
}

async function ensureHousingCategory(client: Client, householdId: string) {
  const [existing] = await client
    .select({ id: budgetCategories.id })
    .from(budgetCategories)
    .where(and(eq(budgetCategories.householdId, householdId), eq(budgetCategories.name, "Housing")))
    .limit(1);
  if (existing) return existing.id;
  const id = randomUUID();
  await client.insert(budgetCategories).values({
    id,
    householdId,
    name: "Housing",
    kind: "fixed",
    colorVar: "var(--color-freedom-location)",
  });
  return id;
}

function nextMonths(count: number) {
  const start = new Date();
  start.setUTCDate(1);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function dayStart(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

function dayEnd(iso: string) {
  return new Date(`${iso}T23:59:59`);
}
