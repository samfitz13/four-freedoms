/**
 * Render a number as currency using the household base currency. Kept as a
 * pure server-safe component so RSCs can call it directly. We intentionally
 * bypass `Intl.NumberFormat`'s locale rules and always use `en` with the
 * household ISO so headers stay terse and editorial (no "$" glyph for CAD
 * vs AUD, etc.).
 */
export function Money({
  value,
  currency,
  fractionDigits = 0,
  compact = false,
}: {
  value: number | null | undefined;
  currency: string;
  fractionDigits?: number;
  compact?: boolean;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className="tabular-nums">—</span>;
  }
  const formatted = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
    notation: compact ? "compact" : "standard",
  }).format(value);
  return <span className="tabular-nums">{formatted}</span>;
}
