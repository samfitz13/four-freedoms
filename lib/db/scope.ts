/**
 * Household-scoped query helpers.
 *
 * This file is the ownership boundary. Every read/write against tenant-scoped
 * tables should go through `scopeForUser(userId)` — never pass a raw
 * household_id from the request layer into a query.
 *
 * Why app-layer instead of RLS:
 *   - All writes flow through server actions that call `requireUser()` first.
 *   - PlanetScale Postgres supports RLS but requires per-request `SET LOCAL`,
 *     which complicates the postgres.js connection model.
 *   - We keep the option to add RLS later without rewriting app code.
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { memberships } from "@/lib/db/schema";

export class NotAMemberError extends Error {
  constructor(public readonly householdId: string) {
    super(`Not a member of household ${householdId}`);
    this.name = "NotAMemberError";
  }
}

export type HouseholdScope = {
  userId: string;
  householdIds: string[];
  /** The primary household — v1 UI assumes one per user. */
  primaryHouseholdId: string;
  /** Throws if `householdId` isn't one this user belongs to. */
  assertMember: (householdId: string) => void;
};

const cache = new Map<string, { scope: HouseholdScope; at: number }>();
const TTL_MS = 30_000; // small per-request-ish cache for RSC fan-out

/**
 * Resolve the set of households the user belongs to. Cached briefly so
 * multiple RSCs in a single request don't re-query.
 */
export async function scopeForUser(userId: string): Promise<HouseholdScope> {
  const hit = cache.get(userId);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return hit.scope;

  const rows = await db
    .select({ householdId: memberships.householdId })
    .from(memberships)
    .where(eq(memberships.userId, userId));

  const householdIds = rows.map((r) => r.householdId);
  if (householdIds.length === 0) {
    // Should never happen — bootstrap hook always creates one. But fail loudly.
    throw new Error(
      `User ${userId} has no household memberships. ` + `Signup bootstrap may have failed.`,
    );
  }

  const scope: HouseholdScope = {
    userId,
    householdIds,
    primaryHouseholdId: householdIds[0]!,
    assertMember(householdId: string) {
      if (!householdIds.includes(householdId)) {
        throw new NotAMemberError(householdId);
      }
    },
  };

  cache.set(userId, { scope, at: now });
  return scope;
}

/** Convenience: the single household id for v1 solo UI. */
export async function getPrimaryHouseholdId(userId: string): Promise<string> {
  const scope = await scopeForUser(userId);
  return scope.primaryHouseholdId;
}

/** Helper for building a `household_id = ?` clause against any tenant table. */
export function scopedWhere<T extends { householdId: unknown }>(
  column: T["householdId"],
  householdId: string,
) {
  return eq(column as never, householdId);
}

/**
 * Compose a filter that scopes by household AND an extra clause.
 * Example:
 *   .where(whereInHousehold(entries.householdId, scope, eq(entries.freedom, "financial")))
 */
export function whereInHousehold<T>(
  column: T,
  scope: HouseholdScope,
  extra?: Parameters<typeof and>[0],
) {
  const scopeClause = eq(column as never, scope.primaryHouseholdId);
  return extra ? and(scopeClause, extra) : scopeClause;
}
