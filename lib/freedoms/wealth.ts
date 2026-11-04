/** Monthly series use YYYY-MM-01 anchors for month-end balances. */
export function yearToDateChange(
  series: readonly { date: string; netWorth: number }[],
  now = new Date(),
): number | null {
  if (!Number.isFinite(now.getTime())) return null;
  const year = now.getUTCFullYear();
  const baselineMonth = `${year - 1}-12`;
  const today = now.toISOString().slice(0, 10);
  const baseline = series
    .filter((point) => point.date.startsWith(`${baselineMonth}-`))
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  const latest = series
    .filter((point) => point.date.startsWith(`${year}-`) && point.date <= today)
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  if (
    !baseline ||
    !latest ||
    !Number.isFinite(baseline.netWorth) ||
    !Number.isFinite(latest.netWorth)
  )
    return null;
  return latest.netWorth - baseline.netWorth;
}
