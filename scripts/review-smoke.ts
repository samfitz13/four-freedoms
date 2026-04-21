/**
 * Dev-only: exercise the /review server action's upsert logic.
 *   pnpm tsx --env-file=.env.local scripts/review-smoke.ts <userId>
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db/client";
import { memberships, weeklyReviews } from "../lib/db/schema";
import { currentWeek } from "../lib/week";

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("usage: tsx scripts/review-smoke.ts <userId>");
    process.exit(1);
  }
  const [m] = await db
    .select({ householdId: memberships.householdId })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);
  if (!m) throw new Error("no household");
  const householdId = m.householdId;
  const week = currentWeek();

  // First submit
  await db
    .insert(weeklyReviews)
    .values({
      id: randomUUID(),
      householdId,
      authorId: userId,
      weekStart: week.start,
      reflectionsJson: {
        wins: "Shipped dashboard",
        struggles: "Slept poorly midweek",
        nextWeek: "Strength day Mon/Wed/Fri",
      },
      overallScore: 81,
    })
    .onConflictDoUpdate({
      target: [weeklyReviews.householdId, weeklyReviews.weekStart],
      set: {
        reflectionsJson: {
          wins: "Shipped dashboard",
          struggles: "Slept poorly midweek",
          nextWeek: "Strength day Mon/Wed/Fri",
        },
        overallScore: 81,
        authorId: userId,
        updatedAt: new Date(),
      },
    });
  console.log("inserted", week.start);

  // Resubmit with updated score to prove upsert
  await db
    .insert(weeklyReviews)
    .values({
      id: randomUUID(),
      householdId,
      authorId: userId,
      weekStart: week.start,
      reflectionsJson: { wins: "Now it's 85 though", nextWeek: "Ship review flow" },
      overallScore: 85,
    })
    .onConflictDoUpdate({
      target: [weeklyReviews.householdId, weeklyReviews.weekStart],
      set: {
        reflectionsJson: { wins: "Now it's 85 though", nextWeek: "Ship review flow" },
        overallScore: 85,
        authorId: userId,
        updatedAt: new Date(),
      },
    });
  console.log("upserted", week.start);

  const [row] = await db
    .select()
    .from(weeklyReviews)
    .where(
      and(eq(weeklyReviews.householdId, householdId), eq(weeklyReviews.weekStart, week.start)),
    );
  console.log("final:", row);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
