/**
 * Tenant-scoped read helpers. Server-only. All queries here must go through
 * `scopeForUser` so no household_id ever reaches a DB call unchecked.
 */
import "server-only";
import { and, between, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { entries, weeklyReviews } from "@/lib/db/schema";
import { scopeForUser } from "@/lib/db/scope";
import type { FreedomKey } from "@/lib/freedoms/types";

/**
 * Return the last N days of entries for this user's primary household.
 * Used by the dashboard + per-freedom detail page.
 */
export async function listRecentEntries(
  userId: string,
  { days = 30, freedom }: { days?: number; freedom?: FreedomKey } = {},
) {
  const scope = await scopeForUser(userId);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const clauses = [
    eq(entries.householdId, scope.primaryHouseholdId),
    gte(entries.occurredOn, cutoffIso),
  ];
  if (freedom) clauses.push(eq(entries.freedom, freedom));

  return db
    .select({
      id: entries.id,
      freedom: entries.freedom,
      occurredOn: entries.occurredOn,
      payload: entries.payload,
      source: entries.source,
      createdAt: entries.createdAt,
    })
    .from(entries)
    .where(and(...clauses))
    .orderBy(desc(entries.occurredOn), desc(entries.createdAt));
}

/**
 * One row per freedom with the last 14 days of entries bundled as JSON.
 * Single round-trip: Postgres does the group-by; the app does the scoring.
 */
export async function listEntriesForDashboard(userId: string) {
  const scope = await scopeForUser(userId);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const rows = await db
    .select({
      freedom: entries.freedom,
      occurredOn: entries.occurredOn,
      payload: entries.payload,
    })
    .from(entries)
    .where(
      and(eq(entries.householdId, scope.primaryHouseholdId), gte(entries.occurredOn, cutoffIso)),
    )
    .orderBy(entries.freedom, entries.occurredOn);

  return rows;
}

/** Entries within an inclusive ISO-date range, for weekly review. */
export async function listEntriesInRange(
  userId: string,
  { start, end }: { start: string; end: string },
) {
  const scope = await scopeForUser(userId);
  return db
    .select({
      freedom: entries.freedom,
      occurredOn: entries.occurredOn,
      payload: entries.payload,
    })
    .from(entries)
    .where(
      and(
        eq(entries.householdId, scope.primaryHouseholdId),
        between(entries.occurredOn, start, end),
      ),
    )
    .orderBy(entries.freedom, entries.occurredOn);
}

/** Get the weekly_reviews row for a given week_start, if any. */
export async function getWeeklyReview(userId: string, weekStart: string) {
  const scope = await scopeForUser(userId);
  const [row] = await db
    .select()
    .from(weeklyReviews)
    .where(
      and(
        eq(weeklyReviews.householdId, scope.primaryHouseholdId),
        eq(weeklyReviews.weekStart, weekStart),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Very small admin-style count — useful for empty-state detection. */
export async function countEntries(userId: string) {
  const scope = await scopeForUser(userId);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(entries)
    .where(eq(entries.householdId, scope.primaryHouseholdId));
  return row?.count ?? 0;
}
