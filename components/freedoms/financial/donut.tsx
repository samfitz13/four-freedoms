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
      startAngle: (-cumulative[i]! / c) * 2 * Math.PI - Math.PI / 2,
    };
  });

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg
        role="img"
        className="shrink-0"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={`${ariaLabel ?? "Asset allocation"}. ${segments.map((seg) => `${seg.label.replace(/_/g, " ")} ${seg.pct}%`).join(", ")}`}
      >
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
            data-slot="allocation-segment"
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
          >
            <title>{`${seg.label.replace(/_/g, " ")}: ${seg.pct}%`}</title>
          </circle>
        ))}
        {segments.length > 1
          ? segments.map((seg, i) => (
              <line
                key={i}
                data-slot="allocation-separator"
                aria-hidden
                x1={size / 2 + (r - stroke / 2) * Math.cos(seg.startAngle)}
                y1={size / 2 + (r - stroke / 2) * Math.sin(seg.startAngle)}
                x2={size / 2 + (r + stroke / 2) * Math.cos(seg.startAngle)}
                y2={size / 2 + (r + stroke / 2) * Math.sin(seg.startAngle)}
                stroke="var(--color-paper)"
                strokeWidth={1.5}
              />
            ))
          : null}
      </svg>

      <ul className="flex min-w-40 flex-1 flex-col gap-2 text-sm">
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
              <span className="font-sans text-xs tracking-normal">
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
