/**
 * Shared types for the top-level `lib/` modules.
 *
 * Per-module types live in sibling `types.ts` files by convention;
 * this file hosts types for small `lib/*.ts` modules that don't warrant
 * their own directory (e.g. `lib/week.ts`).
 */

/**
 * An ISO-week window. A "week" is Mon 00:00 → Sun 23:59 local time.
 * We store `week_start` as a date (YYYY-MM-DD) so equality / ordering is
 * trivial and timezone-stable.
 */
export interface Week {
  /** Monday, ISO `YYYY-MM-DD`. */
  start: string;
  /** Sunday, ISO `YYYY-MM-DD`. */
  end: string;
  /** Seven days of `YYYY-MM-DD`, Monday-first. */
  days: string[];
  /** `2026-W17` style. */
  label: string;
}
