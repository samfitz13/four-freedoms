/**
 * Monthly income vs. expense bars. Income rendered above the x-axis, expense
 * below. A net line overlays the bars to show the delta.
 */
type MonthPoint = {
  month: string; // "YYYY-MM-01"
  income: number;
  expense: number;
  net: number;
};

export function StackedBars({
  data,
  incomeColor = "var(--color-freedom-financial, #065f46)",
  expenseColor = "var(--color-accent-warning, #9a3412)",
  netColor = "var(--color-foreground)",
  width = 720,
  height = 220,
  pad = 18,
  ariaLabel,
}: {
  data: MonthPoint[];
  incomeColor?: string;
  expenseColor?: string;
  netColor?: string;
  width?: number;
  height?: number;
  pad?: number;
  ariaLabel?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-[color:var(--color-ink-soft)]">
        No cashflow yet.
      </div>
    );
  }

  const hi = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const midY = pad + innerH / 2;
  const scale = innerH / 2 / hi;

  const bandW = innerW / data.length;
  const barW = Math.max(4, Math.min(28, bandW * 0.5));

  // Net overlay as a polyline across month centers.
  const netPoints = data.map((d, i) => {
    const cx = pad + bandW * (i + 0.5);
    const ny = midY - d.net * scale;
    return { x: cx, y: ny };
  });
  const netPath = netPoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      aria-label={ariaLabel}
      className="overflow-visible"
    >
      <line
        x1={pad}
        x2={width - pad}
        y1={midY}
        y2={midY}
        stroke="var(--color-border)"
        strokeWidth={1}
      />

      {data.map((d, i) => {
        const cx = pad + bandW * (i + 0.5);
        const incH = d.income * scale;
        const expH = d.expense * scale;
        return (
          <g key={d.month}>
            <rect
              x={cx - barW / 2}
              y={midY - incH}
              width={barW}
              height={incH}
              fill={incomeColor}
              opacity={0.85}
            />
            <rect
              x={cx - barW / 2}
              y={midY}
              width={barW}
              height={expH}
              fill={expenseColor}
              opacity={0.85}
            />
            {i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2) ? (
              <text
                x={cx}
                y={height - 2}
                textAnchor="middle"
                className="fill-[color:var(--color-ink-soft)]"
                style={{ fontSize: 10, fontFamily: "var(--font-mono, monospace)" }}
              >
                {monthLabel(d.month)}
              </text>
            ) : null}
          </g>
        );
      })}

      <path d={netPath} fill="none" stroke={netColor} strokeWidth={1.25} strokeLinejoin="round" />
      {netPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.75} fill={netColor} />
      ))}
    </svg>
  );
}

function monthLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en", { month: "short" }).format(d);
}
