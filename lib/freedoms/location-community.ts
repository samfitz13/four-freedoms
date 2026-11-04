import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { connections } from "@/lib/db/schema";

const CADENCE_DAYS = {
  weekly: 7,
  biweekly: 14,
  monthly: 31,
  quarterly: 92,
  yearly: 366,
} as const;

export async function computeCadenceRollup(householdId: string, today: Date = new Date()) {
  const rows = await db
    .select({ cadence: connections.cadence, lastSeenOn: connections.lastSeenOn })
    .from(connections)
    .where(and(eq(connections.householdId, householdId), isNull(connections.archivedAt)));

  const cadenceRows = rows.filter((row) => row.cadence !== null);
  const onCadence = cadenceRows.filter((row) => {
    if (!row.cadence || !row.lastSeenOn) return false;
    const days = daysSince(row.lastSeenOn, today);
    return days <= CADENCE_DAYS[row.cadence];
  }).length;

  return { onCadence, total: cadenceRows.length };
}

export function isConnectionOnCadence(
  cadence: keyof typeof CADENCE_DAYS | null,
  lastSeenOn: string | null,
  today: Date = new Date(),
) {
  if (!cadence || !lastSeenOn) return false;
  return daysSince(lastSeenOn, today) <= CADENCE_DAYS[cadence];
}

function daysSince(iso: string, today: Date): number {
  const then = new Date(iso + "T00:00:00Z");
  const now = new Date(today.toISOString().slice(0, 10) + "T00:00:00Z");
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}
