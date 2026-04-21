/**
 * ISO-week helpers. A "week" is Mon 00:00 → Sun 23:59 local time.
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

/** Week containing `date` (defaults to today). */
export function currentWeek(date: Date = new Date()): Week {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // getDay: 0=Sun..6=Sat. Shift so Monday=0.
  const mondayOffset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(d);
    dd.setDate(d.getDate() + i);
    days.push(iso(dd));
  }

  return {
    start: days[0]!,
    end: days[6]!,
    days,
    label: isoWeekLabel(d),
  };
}

/** Get the Monday that is `n` weeks before the given week's Monday. */
export function weekBefore(week: Week, n = 1): Week {
  const [y, m, d] = week.start.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 7 * n);
  // Use a local-midnight date so currentWeek gives us the right Monday.
  return currentWeek(new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoWeekLabel(monday: Date): string {
  // ISO week number: Thursday of the same week sets the year.
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const year = thursday.getFullYear();
  const firstThursday = new Date(year, 0, 4);
  const firstThursdayMonday = new Date(firstThursday);
  firstThursdayMonday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7));
  const weekNum =
    1 +
    Math.round((thursday.getTime() - firstThursdayMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}
