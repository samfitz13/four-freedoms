import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { places, residences } from "@/lib/db/schema";

export async function getPrimaryResidence(householdId: string) {
  const [row] = await db
    .select({
      id: residences.id,
      placeId: residences.placeId,
      placeName: places.name,
      country: places.country,
      startedOn: residences.startedOn,
    })
    .from(residences)
    .innerJoin(places, eq(residences.placeId, places.id))
    .where(
      and(
        eq(residences.householdId, householdId),
        eq(residences.role, "primary"),
        isNull(residences.endedOn),
      ),
    )
    .orderBy(desc(residences.startedOn))
    .limit(1);
  return row ?? null;
}

export function daysBetweenInclusive(startIso: string, endIso: string): number {
  const start = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

export function yearsBetween(startIso: string, endIso: string): number {
  return daysBetweenInclusive(startIso, endIso) / 365.25;
}
