/**
 * Minimal, editorial sparkline. SVG, no libs. `null` gaps are rendered as
 * subtle dots; the line skips them.
 */
import type { DailyPoint } from "@/lib/freedoms/types";

export function Sparkline({
  series,
  color,
  width = 180,
  height = 36,
  pad = 2,
}: {
  series: DailyPoint[];
  color: string;
  width?: number;
  height?: number;
  pad?: number;
}) {
  if (!series.length) return null;

  // Fixed 0..100 domain so sparklines across freedoms are comparable.
  const max = 100;
  const min = 0;
  const stepX = (width - pad * 2) / Math.max(1, series.length - 1);

  const points = series.map((p, i) => {
    const x = pad + i * stepX;
    const y =
      p.score === null ? null : pad + (height - pad * 2) * (1 - (p.score - min) / (max - min));
    return { x, y, hasValue: p.score !== null };
  });

  // Build a path that breaks on nulls.
  let d = "";
  let open = false;
  for (const pt of points) {
    if (pt.y === null) {
      open = false;
      continue;
    }
    d += `${open ? "L" : "M"}${pt.x.toFixed(1)} ${pt.y.toFixed(1)} `;
    open = true;
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className="overflow-visible"
    >
      <line
        x1={pad}
        x2={width - pad}
        y1={height - pad}
        y2={height - pad}
        stroke="var(--color-border)"
        strokeWidth={1}
      />
      {d ? (
        <path
          d={d.trim()}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {points.map((pt, i) =>
        pt.hasValue ? (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y ?? 0}
            r={i === points.length - 1 ? 2.5 : 1.5}
            fill={color}
          />
        ) : (
          <circle key={i} cx={pt.x} cy={height - pad - 1} r={0.75} fill="var(--color-border)" />
        ),
      )}
    </svg>
  );
}
