"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { entries } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { getPrimaryHouseholdId } from "@/lib/db/scope";

/**
 * Insert 7 days of realistic entries across the four freedoms for the
 * current user's primary household. Idempotent: we upsert on the unique
 * (household_id, freedom, occurred_on) index.
 */
export async function seedDevData() {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);

  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return d.toISOString().slice(0, 10);
  });

  const rows: Array<typeof entries.$inferInsert> = [];
  for (const [i, day] of days.entries()) {
    rows.push({
      id: randomUUID(),
      householdId,
      authorId: user.id,
      freedom: "financial",
      occurredOn: day,
      payload: {
        netWorth: 120_000 + i * 150,
        savingsRate: 0.28 + (i % 3) * 0.02,
      },
      source: "manual",
    });
    rows.push({
      id: randomUUID(),
      householdId,
      authorId: user.id,
      freedom: "location",
      occurredOn: day,
      payload: {
        place: i < 4 ? "Lisbon, PT" : "Mexico City, MX",
        satisfaction: 7 + (i % 3),
        preferred: true,
      },
      source: "manual",
    });
    rows.push({
      id: randomUUID(),
      householdId,
      authorId: user.id,
      freedom: "time",
      occurredOn: day,
      payload: {
        deepWorkHours: 2 + (i % 4),
        prioritySplit: 0.55 + (i % 3) * 0.07,
      },
      source: "manual",
    });
    rows.push({
      id: randomUUID(),
      householdId,
      authorId: user.id,
      freedom: "health",
      occurredOn: day,
      payload: {
        sleepHours: 7 + (i % 3) * 0.3,
        trained: i % 2 === 0,
        energy: 6 + (i % 4),
      },
      source: "manual",
    });
  }

  await db
    .insert(entries)
    .values(rows)
    .onConflictDoNothing({
      target: [entries.householdId, entries.freedom, entries.occurredOn],
    });

  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

/** Remove every entry in the current household (useful when iterating). */
export async function wipeDevData() {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  await db.delete(entries).where(and(eq(entries.householdId, householdId)));
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}
