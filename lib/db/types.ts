/**
 * Shared types for `lib/db/` modules that don't warrant their own directory.
 */

export type HouseholdScope = {
  userId: string;
  householdIds: string[];
  /** The primary household — v1 UI assumes one per user. */
  primaryHouseholdId: string;
  /** Throws if `householdId` isn't one this user belongs to. */
  assertMember: (householdId: string) => void;
};
