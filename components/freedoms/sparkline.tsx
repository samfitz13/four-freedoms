"use client";

/**
 * Minimal, editorial sparkline. SVG, no libs. `null` gaps are rendered as
 * subtle dots; the line skips them. When `interactive` is set, hovering the
 * sparkline reveals a quiet mono readout of the value at that point — a small
 * margin note for the curious reader. Zero readout, zero layout shift when
 * not interactive.
 */
import { useMemo, useState, type MouseEvent } from "react";
import type { DailyPoint } from "@/lib/freedoms/types";

export function Sparkline({
  series,
  color,
  width = 180,
  height = 36,
  pad = 2,
  interactive = false,
  valueSuffix = "",
}: {
  series: DailyPoint[];
  color: string;
  width?: number;
  height?: number;
  pad?: number;
  interactive?: boolean;
  /** Optional unit suffix appended to the hover readout value (e.g. "%", "/100"). */
  valueSuffix?: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (!series.length) return null;
    const max = 100;
    const min = 0;
    const stepX = (width - pad * 2) / Math.max(1, series.length - 1);
    const points = series.map((p, i) => {
      const x = pad + i * stepX;
      const y =
        p.score === null ? null : pad + (height - pad * 2) * (1 - (p.score - min) / (max - min));
      return { x, y, hasValue: p.score !== null };
    });

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

    return { points, stepX, d: d.trim() };
  }, [series, width, height, pad]);

  if (!series.length || !geometry) return null;
  const { points, stepX, d } = geometry;

  const handleMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width - pad;
    const i = Math.max(0, Math.min(series.length - 1, Math.round(relX / Math.max(1, stepX))));
    setHoverIndex(i);
  };

  const handleLeave = () => setHoverIndex(null);

  const active = hoverIndex != null ? points[hoverIndex] : null;
  const activePoint = hoverIndex != null ? series[hoverIndex] : null;

  const svg = (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden={!interactive}
      role={interactive ? "img" : undefined}
      aria-label={
        interactive
          ? activePoint
            ? `${activePoint.date}: ${activePoint.score == null ? "not available" : activePoint.score}`
            : `${series.length}-point sparkline`
          : undefined
      }
      className="overflow-visible"
      onMouseMove={interactive ? handleMove : undefined}
      onMouseLeave={interactive ? handleLeave : undefined}
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
          d={d}
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
      {interactive && active ? (
        <>
          <line
            x1={active.x}
            x2={active.x}
            y1={pad}
            y2={height - pad}
            stroke="var(--color-ink-soft)"
            strokeWidth={0.5}
            strokeDasharray="1 2"
          />
          {active.hasValue && active.y !== null ? (
            <circle
              cx={active.x}
              cy={active.y}
              r={2.75}
              fill="var(--color-background)"
              stroke={color}
              strokeWidth={1.25}
            />
          ) : null}
        </>
      ) : null}
    </svg>
  );

  if (!interactive) return svg;

  const readout = activePoint
    ? `${formatDateCompact(activePoint.date)} · ${
        activePoint.score == null ? "—" : `${activePoint.score}${valueSuffix}`
      }`
    : "\u00A0";

  return (
    <span className="inline-flex flex-col items-start gap-[3px] leading-none">
      {svg}
      <span
        aria-live="polite"
        className="font-sans text-[9.5px] leading-none tracking-normal text-[color:var(--color-ink-soft)] tabular-nums"
      >
        {readout}
      </span>
    </span>
  );
}

function formatDateCompact(iso: string): string {
  // Expect YYYY-MM-DD or YYYY-MM.
  const parts = iso.split("-");
  const year = Number(parts[0]);
  const monthIdx = Number(parts[1]) - 1;
  const day = parts[2] ? Number(parts[2]) : undefined;
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const mm = months[monthIdx] ?? "";
  if (!mm || Number.isNaN(year)) return iso;
  return day ? `${mm} ${day}` : `${mm} ${year}`;
}
