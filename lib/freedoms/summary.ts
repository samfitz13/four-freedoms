/**
 * Pure functions for turning entries into FreedomSummary + sparkline data.
 * No DB / no `server-only` — safe to unit-test.
 */
import type { DailyPoint, FreedomKey, FreedomSummary } from "./types";
import { freedomModules } from "./index";

/**
 * Build a 14-day sparkline series + a FreedomSummary from a chronological
 * list of `(occurredOn, payload)` pairs. `today` is injected for testability.
 */
export function computeSummary(
  key: FreedomKey,
  entries: { occurredOn: string; payload: Record<string, unknown> }[],
  today: Date = new Date(),
): { summary: FreedomSummary; series: DailyPoint[] } {
  const mod = freedomModules[key];

  // Build last-14-day series, indexed by date, so gaps remain null.
  const days: DailyPoint[] = [];
  const byDate = new Map<string, number | null>();
  for (const e of entries) {
    const s = mod.scoreEntry(e.payload);
    byDate.set(e.occurredOn, s);
  }
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({ date: iso, score: byDate.get(iso) ?? null });
  }

  // Current week (last 7 days) mean vs previous 7.
  const nonNull = (arr: DailyPoint[]): number[] =>
    arr.flatMap((d) => (d.score === null ? [] : [d.score]));
  const thisWeekScores = nonNull(days.slice(7));
  const lastWeekScores = nonNull(days.slice(0, 7));

  const score = thisWeekScores.length ? mean(thisWeekScores) : 0;
  const prev = lastWeekScores.length ? mean(lastWeekScores) : 0;
  const trend = thisWeekScores.length && lastWeekScores.length ? Math.round(score - prev) : 0;
  const entriesThisWeek = thisWeekScores.length;

  // Streak: consecutive days with an entry ending on `today` (or yesterday,
  // to tolerate timezone skew).
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i]!.score !== null) streak += 1;
    else if (streak > 0) break;
    else continue;
  }

  return {
    summary: {
      key,
      score: Math.round(score),
      trend,
      streak,
      entriesThisWeek,
    },
    series: days,
  };
}

function mean(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
