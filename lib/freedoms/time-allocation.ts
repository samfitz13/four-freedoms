import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { timeLogEntries, timePursuits } from "@/lib/db/schema";
import { ensureTimeSeeded } from "@/lib/freedoms/time-seed";

export async function computeTimeAllocation(householdId: string) {
  await ensureTimeSeeded(householdId);
  const cutoff30 = isoDaysAgo(new Date(), 29);
  const cutoff7 = isoDaysAgo(new Date(), 6);
  const rows = await db
    .select({
      pursuitId: timePursuits.id,
      name: timePursuits.name,
      kind: timePursuits.kind,
      colorVar: timePursuits.colorVar,
      matters: timePursuits.matters,
      recordedOn: timeLogEntries.recordedOn,
      hours: timeLogEntries.hours,
    })
    .from(timeLogEntries)
    .innerJoin(timePursuits, eq(timeLogEntries.pursuitId, timePursuits.id))
    .where(
      and(eq(timeLogEntries.householdId, householdId), gte(timeLogEntries.recordedOn, cutoff30)),
    );

  const byPursuit = new Map<
    string,
    {
      pursuitId: string;
      name: string;
      kind: "work" | "play" | "care" | "rest" | "admin";
      colorVar: string;
      matters: boolean;
      hours7: number;
      hours30: number;
    }
  >();
  for (const row of rows) {
    const current = byPursuit.get(row.pursuitId) ?? {
      pursuitId: row.pursuitId,
      name: row.name,
      kind: row.kind,
      colorVar: row.colorVar,
      matters: row.matters,
      hours7: 0,
      hours30: 0,
    };
    const hours = Number(row.hours);
    current.hours30 += hours;
    if (row.recordedOn >= cutoff7) current.hours7 += hours;
    byPursuit.set(row.pursuitId, current);
  }

  return [...byPursuit.values()].sort((a, b) => b.hours7 - a.hours7 || b.hours30 - a.hours30);
}

function isoDaysAgo(today: Date, days: number): string {
  const d = new Date(today);
  d.setDate(today.getDate() - days);
  return d.toISOString().slice(0, 10);
}
