import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { timeBlocks, timeLogEntries, timePursuits } from "@/lib/db/schema";

const SEEDED_PURSUITS = [
  {
    systemKey: "deep_work",
    name: "Deep work",
    kind: "work",
    colorVar: "var(--color-freedom-time)",
    matters: true,
    sortOrder: 10,
  },
  {
    systemKey: "meetings",
    name: "Meetings",
    kind: "work",
    colorVar: "var(--color-ink-soft)",
    matters: false,
    sortOrder: 20,
  },
  {
    systemKey: "obligations",
    name: "Obligations",
    kind: "admin",
    colorVar: "var(--color-freedom-health)",
    matters: false,
    sortOrder: 30,
  },
] as const;

export async function ensureTimeSeeded(householdId: string) {
  await db.transaction(async (tx) => {
    for (const pursuit of SEEDED_PURSUITS) {
      await tx
        .insert(timePursuits)
        .values({
          id: randomUUID(),
          householdId,
          name: pursuit.name,
          kind: pursuit.kind,
          colorVar: pursuit.colorVar,
          matters: pursuit.matters,
          systemKey: pursuit.systemKey,
          sortOrder: pursuit.sortOrder,
        })
        .onConflictDoUpdate({
          target: [timePursuits.householdId, timePursuits.systemKey],
          set: {
            name: pursuit.name,
            kind: pursuit.kind,
            colorVar: pursuit.colorVar,
            matters: pursuit.matters,
            sortOrder: pursuit.sortOrder,
          },
        });
    }

    const pursuits = await tx
      .select()
      .from(timePursuits)
      .where(eq(timePursuits.householdId, householdId));
    const byKey = new Map(pursuits.map((p) => [p.systemKey, p]));
    const deep = byKey.get("deep_work");
    const meetings = byKey.get("meetings");
    const obligations = byKey.get("obligations");
    if (!deep || !meetings || !obligations) return;

    const legacyRows = await tx
      .select()
      .from(timeBlocks)
      .where(eq(timeBlocks.householdId, householdId));

    for (const row of legacyRows) {
      const entries = [
        {
          pursuitId: deep.id,
          hours: Number(row.deepWorkHours),
          note: row.note,
        },
        {
          pursuitId: meetings.id,
          hours: Number(row.meetingHours),
          note: null,
        },
        {
          pursuitId: obligations.id,
          hours: Number(row.obligationHours),
          note: null,
        },
      ].filter((entry) => entry.hours > 0);

      for (const entry of entries) {
        await tx
          .insert(timeLogEntries)
          .values({
            id: randomUUID(),
            householdId,
            pursuitId: entry.pursuitId,
            recordedOn: row.recordedOn,
            hours: entry.hours.toFixed(2),
            note: entry.note,
            source: "manual",
          })
          .onConflictDoNothing({
            target: [
              timeLogEntries.householdId,
              timeLogEntries.pursuitId,
              timeLogEntries.recordedOn,
            ],
          });
      }
    }
  });
}

export async function hasSeededTimePursuits(householdId: string): Promise<boolean> {
  const rows = await db
    .select({ id: timePursuits.id })
    .from(timePursuits)
    .where(and(eq(timePursuits.householdId, householdId), eq(timePursuits.systemKey, "deep_work")))
    .limit(1);
  return rows.length > 0;
}
