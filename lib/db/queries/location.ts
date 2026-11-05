/**
 * Tenant-scoped read helpers for the Location workspace.
 */
import "server-only";
import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  connectionVisits,
  connections,
  financialAccounts,
  locationSatisfactions,
  monthlyStatements,
  places,
  properties,
  residences,
  stays,
  trips,
} from "@/lib/db/schema";

export async function listPlaces(householdId: string) {
  const rows = await db
    .select()
    .from(places)
    .where(and(eq(places.householdId, householdId), sql`${places.archivedAt} is null`))
    .orderBy(desc(places.isPreferred), places.name);

  const [residenceRows, propertyRows] = await Promise.all([
    db
      .select({ placeId: residences.placeId, role: residences.role })
      .from(residences)
      .where(and(eq(residences.householdId, householdId), isNull(residences.endedOn))),
    db
      .select({ placeId: properties.placeId })
      .from(properties)
      .where(and(eq(properties.householdId, householdId), isNull(properties.disposedOn))),
  ]);

  const residenceByPlace = new Map(residenceRows.map((r) => [r.placeId, r.role]));
  const propertyPlaceIds = new Set(propertyRows.map((p) => p.placeId));
  return rows.map((place) => ({
    ...place,
    role: residenceByPlace.get(place.id) ?? (propertyPlaceIds.has(place.id) ? "property" : null),
  }));
}

export async function listStays(householdId: string, limit = 30) {
  return db
    .select({
      id: stays.id,
      placeId: stays.placeId,
      placeName: places.name,
      country: places.country,
      kind: stays.kind,
      tripId: stays.tripId,
      startedOn: stays.startedOn,
      endedOn: stays.endedOn,
      note: stays.note,
    })
    .from(stays)
    .innerJoin(places, and(eq(stays.placeId, places.id), eq(places.householdId, householdId)))
    .where(eq(stays.householdId, householdId))
    .orderBy(desc(stays.startedOn))
    .limit(limit);
}

export async function currentStay(householdId: string) {
  const [row] = await db
    .select({
      id: stays.id,
      placeId: stays.placeId,
      placeName: places.name,
      country: places.country,
      startedOn: stays.startedOn,
      isPreferred: places.isPreferred,
    })
    .from(stays)
    .innerJoin(places, and(eq(stays.placeId, places.id), eq(places.householdId, householdId)))
    .where(and(eq(stays.householdId, householdId), isNull(stays.endedOn)))
    .orderBy(desc(stays.startedOn))
    .limit(1);
  return row ?? null;
}

export async function listRecentSatisfactions(householdId: string, days = 30) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const cutoff = d.toISOString().slice(0, 10);
  return db
    .select({
      id: locationSatisfactions.id,
      recordedOn: locationSatisfactions.recordedOn,
      satisfaction: locationSatisfactions.satisfaction,
      note: locationSatisfactions.note,
      placeName: places.name,
      withConnectionIds: locationSatisfactions.withConnectionIds,
    })
    .from(locationSatisfactions)
    .leftJoin(
      places,
      and(eq(locationSatisfactions.placeId, places.id), eq(places.householdId, householdId)),
    )
    .where(
      and(
        eq(locationSatisfactions.householdId, householdId),
        gte(locationSatisfactions.recordedOn, cutoff),
      ),
    )
    .orderBy(desc(locationSatisfactions.recordedOn));
}

export async function listResidences(householdId: string) {
  return db
    .select({
      id: residences.id,
      placeId: residences.placeId,
      placeName: places.name,
      country: places.country,
      role: residences.role,
      tenure: residences.tenure,
      startedOn: residences.startedOn,
      endedOn: residences.endedOn,
      householdSharePct: residences.householdSharePct,
      costPerMonth: residences.costPerMonth,
      currency: residences.currency,
      landlord: residences.landlord,
      notes: residences.notes,
    })
    .from(residences)
    .innerJoin(places, and(eq(residences.placeId, places.id), eq(places.householdId, householdId)))
    .where(eq(residences.householdId, householdId))
    .orderBy(desc(residences.startedOn));
}

export async function listProperties(householdId: string) {
  const rows = await db
    .select({
      id: properties.id,
      placeId: properties.placeId,
      placeName: places.name,
      country: places.country,
      accountId: properties.accountId,
      accountName: financialAccounts.name,
      currency: financialAccounts.currency,
      use: properties.use,
      ownershipPct: properties.ownershipPct,
      acquiredOn: properties.acquiredOn,
      disposedOn: properties.disposedOn,
      notes: properties.notes,
    })
    .from(properties)
    .innerJoin(places, and(eq(properties.placeId, places.id), eq(places.householdId, householdId)))
    .innerJoin(financialAccounts, eq(properties.accountId, financialAccounts.id))
    .where(eq(properties.householdId, householdId))
    .orderBy(asc(places.name));

  const valuations = await db
    .select({
      accountId: monthlyStatements.accountId,
      endingBalance: monthlyStatements.endingBalance,
      month: monthlyStatements.month,
    })
    .from(monthlyStatements)
    .where(eq(monthlyStatements.householdId, householdId))
    .orderBy(desc(monthlyStatements.month));

  const latestByAccount = new Map<string, { endingBalance: string; month: string }>();
  for (const valuation of valuations) {
    if (!latestByAccount.has(valuation.accountId))
      latestByAccount.set(valuation.accountId, valuation);
  }

  return rows.map((row) => {
    const latest = latestByAccount.get(row.accountId);
    const value = latest ? Number(latest.endingBalance) : null;
    const ownership = Number(row.ownershipPct) / 100;
    return {
      ...row,
      lastValuation: value,
      lastValuationMonth: latest?.month ?? null,
      equity: value === null ? null : value * ownership,
    };
  });
}

export async function listRealEstateAccounts(householdId: string) {
  return db
    .select({
      id: financialAccounts.id,
      name: financialAccounts.name,
      currency: financialAccounts.currency,
    })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.householdId, householdId),
        eq(financialAccounts.type, "real_estate"),
        eq(financialAccounts.isArchived, false),
      ),
    )
    .orderBy(financialAccounts.name);
}

export async function listTrips(householdId: string) {
  return db
    .select({
      id: trips.id,
      name: trips.name,
      purpose: trips.purpose,
      startsOn: trips.startsOn,
      endsOn: trips.endsOn,
      budgetAmount: trips.budgetAmount,
      currency: trips.currency,
      notes: trips.notes,
    })
    .from(trips)
    .where(and(eq(trips.householdId, householdId), isNull(trips.archivedAt)))
    .orderBy(desc(trips.startsOn));
}

export async function listTripStays(householdId: string) {
  return db
    .select({
      id: stays.id,
      tripId: stays.tripId,
      placeId: stays.placeId,
      placeName: places.name,
      country: places.country,
      startedOn: stays.startedOn,
      endedOn: stays.endedOn,
      note: stays.note,
    })
    .from(stays)
    .innerJoin(places, and(eq(stays.placeId, places.id), eq(places.householdId, householdId)))
    .where(and(eq(stays.householdId, householdId), eq(stays.kind, "trip")))
    .orderBy(asc(stays.startedOn));
}

export async function listConnections(householdId: string) {
  return db
    .select({
      id: connections.id,
      name: connections.name,
      kind: connections.kind,
      placeId: connections.placeId,
      placeName: places.name,
      cadence: connections.cadence,
      lastSeenOn: connections.lastSeenOn,
      note: connections.note,
    })
    .from(connections)
    .leftJoin(places, and(eq(connections.placeId, places.id), eq(places.householdId, householdId)))
    .where(and(eq(connections.householdId, householdId), isNull(connections.archivedAt)))
    .orderBy(asc(connections.name));
}

export async function listConnectionVisits(householdId: string, limit = 50) {
  return db
    .select({
      id: connectionVisits.id,
      connectionId: connectionVisits.connectionId,
      connectionName: connections.name,
      occurredOn: connectionVisits.occurredOn,
      placeName: places.name,
      note: connectionVisits.note,
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
    .where(eq(connectionVisits.householdId, householdId))
    .orderBy(desc(connectionVisits.occurredOn))
    .limit(limit);
}
