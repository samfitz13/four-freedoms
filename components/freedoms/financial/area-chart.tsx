/**
 * Minimal area chart, SVG-only, no deps. Assumes `series` is already
 * chronological (oldest first). `color` is a CSS color string (usually a
 * `var(--...)` token).
 */
type Point = { date: string; value: number };

export function AreaChart({
  series,
  color,
  width = 640,
  height = 160,
  pad = 12,
  ariaLabel,
}: {
  series: Point[];
  color: string;
  width?: number;
  height?: number;
  pad?: number;
  ariaLabel?: string;
}) {
  if (series.length < 2) {
    return (
      <div
        className="flex h-40 items-center justify-center text-sm text-[color:var(--color-ink-soft)]"
        aria-label={ariaLabel}
      >
        Not enough data yet.
      </div>
    );
  }

  const values = series.map((s) => s.value);
  const lo = Math.min(...values, 0);
  const hi = Math.max(...values, lo + 1);
  const range = hi - lo || 1;

  const stepX = (width - pad * 2) / (series.length - 1);
  const toY = (v: number) => pad + (height - pad * 2) * (1 - (v - lo) / range);

  const linePoints = series.map((s, i) => ({ x: pad + i * stepX, y: toY(s.value) }));
  const path = linePoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const baseY = toY(lo);
  const area = `${path} L${linePoints[linePoints.length - 1]!.x.toFixed(1)} ${baseY.toFixed(
    1,
  )} L${linePoints[0]!.x.toFixed(1)} ${baseY.toFixed(1)} Z`;

  const gradientId = `area-gradient-${Math.abs(hashString(color + series.length))}`;

  // Sparse X-axis ticks: first, last, midpoint.
  const ticks = [0, Math.floor(series.length / 2), series.length - 1];

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      aria-label={ariaLabel}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      <line
        x1={pad}
        x2={width - pad}
        y1={height - pad}
        y2={height - pad}
        stroke="var(--color-border)"
        strokeWidth={1}
      />

      <path d={area} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />

      {ticks.map((t) => (
        <text
          key={t}
          x={pad + t * stepX}
          y={height - 1}
          textAnchor={t === 0 ? "start" : t === series.length - 1 ? "end" : "middle"}
          className="fill-[color:var(--color-ink-soft)]"
          style={{ fontSize: 10, fontFamily: "var(--font-mono, monospace)" }}
        >
          {formatShort(series[t]!.date)}
        </text>
      ))}
    </svg>
  );
}

function formatShort(iso: string): string {
  // YYYY-MM-DD → "MMM DD"
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(d);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
