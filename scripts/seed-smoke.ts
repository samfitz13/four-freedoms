/**
 * Dev-only: insert 7 days × 4 freedoms of sample entries for a given user.
 * Equivalent to the /settings `seedDevData` server action, but runnable via
 *   pnpm tsx scripts/seed-smoke.ts <userId>
 *
 * Used only for local verification; not wired to a pnpm script.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db/client";
import { entries, memberships } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("usage: tsx scripts/seed-smoke.ts <userId>");
    process.exit(1);
  }

  const [m] = await db
    .select({ householdId: memberships.householdId })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);
  if (!m) throw new Error(`no household for user ${userId}`);
  const householdId = m.householdId;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });

  const rows: Array<typeof entries.$inferInsert> = [];
  for (const [i, day] of days.entries()) {
    rows.push(
      {
        id: randomUUID(),
        householdId,
        authorId: userId,
        freedom: "financial",
        occurredOn: day,
        payload: { netWorth: 120_000 + i * 150, savingsRate: 0.28 },
      },
      {
        id: randomUUID(),
        householdId,
        authorId: userId,
        freedom: "location",
        occurredOn: day,
        payload: { place: "Lisbon, PT", satisfaction: 8, preferred: true },
      },
      {
        id: randomUUID(),
        householdId,
        authorId: userId,
        freedom: "time",
        occurredOn: day,
        payload: { deepWorkHours: 2 + (i % 4), prioritySplit: 0.6 },
      },
      {
        id: randomUUID(),
        householdId,
        authorId: userId,
        freedom: "health",
        occurredOn: day,
        payload: { sleepHours: 7.5, trained: i % 2 === 0, energy: 7 },
      },
    );
  }

  const res = await db
    .insert(entries)
    .values(rows)
    .onConflictDoNothing({
      target: [entries.householdId, entries.freedom, entries.occurredOn],
    });

  // On idempotent re-run, len is 0; fresh run, len is 28.
  console.log(`seeded user=${userId} household=${householdId} rows=${rows.length}`);
  return res;
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
