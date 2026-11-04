import "server-only";

import { and, eq, gte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { stays } from "@/lib/db/schema";

export async function computeDaysAway365(
  householdId: string,
  primaryPlaceId: string | null,
  today: Date = new Date(),
) {
  if (!primaryPlaceId) return 0;
  const cutoff = isoDaysAgo(today, 365);
  const rows = await db
    .select({
      placeId: stays.placeId,
      startedOn: stays.startedOn,
      endedOn: stays.endedOn,
    })
    .from(stays)
    .where(
      and(
        eq(stays.householdId, householdId),
        gte(stays.startedOn, cutoff),
        sql`${stays.placeId} <> ${primaryPlaceId}`,
        or(eq(stays.kind, "trip"), eq(stays.kind, "visit"), eq(stays.kind, "other")),
      ),
    );

  const todayIso = today.toISOString().slice(0, 10);
  return rows.reduce((sum, row) => {
    const start = row.startedOn < cutoff ? cutoff : row.startedOn;
    const end = row.endedOn && row.endedOn < todayIso ? row.endedOn : todayIso;
    return sum + daysInclusive(start, end);
  }, 0);
}

function isoDaysAgo(today: Date, days: number): string {
  const d = new Date(today);
  d.setDate(today.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function daysInclusive(startIso: string, endIso: string): number {
  const start = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
}
