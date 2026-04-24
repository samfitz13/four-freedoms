/**
 * Asset-allocation donut. Positive slices rendered in proportion; negative
 * buckets (debt) surface as a separate legend row so the donut stays visually
 * honest.
 */
type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

export function Donut({
  slices,
  size = 140,
  stroke = 16,
  ariaLabel,
}: {
  slices: DonutSlice[];
  size?: number;
  stroke?: number;
  ariaLabel?: string;
}) {
  const positive = slices.filter((s) => s.value > 0);
  const total = positive.reduce((s, x) => s + x.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  // Precompute cumulative offsets (negative because we rotate -90° below and
  // advance clockwise). Avoids mid-render mutation.
  const cumulative: number[] = [];
  {
    let running = 0;
    for (const s of positive) {
      cumulative.push(running);
      running -= (total > 0 ? s.value / total : 0) * c;
    }
  }
  const segments = positive.map((s, i) => {
    const frac = total > 0 ? s.value / total : 0;
    const dash = frac * c;
    return {
      dash,
      gap: c - dash,
      offset: cumulative[i] ?? 0,
      color: s.color,
      label: s.label,
      value: s.value,
      pct: Math.round(frac * 100),
    };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={ariaLabel}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${seg.dash} ${seg.gap}`}
            strokeDashoffset={seg.offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ))}
      </svg>

      <ul className="flex flex-col gap-2 text-sm">
        {positive.length === 0 ? (
          <li className="text-[color:var(--color-ink-soft)]">No positive balances yet.</li>
        ) : (
          positive.map((s) => (
            <li key={s.label} className="flex items-center gap-3">
              <span
                aria-hidden
                className="inline-block h-2 w-4 rounded-full"
                style={{ background: s.color }}
              />
              <span className="font-mono text-[11px] tracking-[0.14em] uppercase">
                {s.label.replace(/_/g, " ")}
              </span>
              <span className="ml-auto text-[color:var(--color-ink-soft)] tabular-nums">
                {total > 0 ? Math.round((s.value / total) * 100) : 0}%
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
