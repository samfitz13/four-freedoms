"use client";

import { useState } from "react";
import type { StackedAreaLayer } from "./types";

export function StackedAreaChart({
  layers,
  width = 640,
  height = 200,
  pad = 12,
  ariaLabel,
}: {
  layers: StackedAreaLayer[];
  width?: number;
  height?: number;
  pad?: number;
  ariaLabel?: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const activeLayers = layers.filter((layer) => layer.points.some((point) => point.value > 0));
  const pointCount = activeLayers[0]?.points.length ?? 0;
  if (activeLayers.length === 0 || pointCount < 2) {
    return (
      <div
        className="flex h-40 items-center justify-center text-sm text-[color:var(--color-ink-soft)]"
        aria-label={ariaLabel}
      >
        Not enough data yet.
      </div>
    );
  }

  const totals = Array.from({ length: pointCount }, (_, i) =>
    activeLayers.reduce((sum, layer) => sum + Math.max(0, layer.points[i]?.value ?? 0), 0),
  );
  const hi = Math.max(...totals, 1);
  const stepX = (width - pad * 2) / (pointCount - 1);
  const toX = (i: number) => pad + i * stepX;
  const toY = (v: number) => pad + (height - pad * 2) * (1 - v / hi);

  const cumulative = Array(pointCount).fill(0) as number[];
  const paths = activeLayers.map((layer) => {
    const bottom = cumulative.map((v) => v);
    const top = cumulative.map((v, i) => v + Math.max(0, layer.points[i]?.value ?? 0));
    for (let i = 0; i < cumulative.length; i++) cumulative[i] = top[i]!;
    const topPath = top
      .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
      .join(" ");
    const bottomPath = bottom
      .map((v, i) => `L${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
      .reverse()
      .join(" ");
    return {
      ...layer,
      area: `${topPath} ${bottomPath} Z`,
      topPath,
    };
  });

  const dates = activeLayers[0]!.points.map((point) => point.date);
  const ticks = [0, Math.floor(pointCount / 2), pointCount - 1];
  const hover =
    hoverIndex === null
      ? null
      : {
          x: toX(hoverIndex),
          date: dates[hoverIndex]!,
          total: activeLayers.reduce(
            (sum, layer) => sum + Math.max(0, layer.points[hoverIndex]?.value ?? 0),
            0,
          ),
          rows: activeLayers
            .map((layer) => ({
              label: layer.label,
              color: layer.color,
              value: Math.max(0, layer.points[hoverIndex]?.value ?? 0),
              dotted: layer.outline === "dotted",
            }))
            .filter((row) => row.value > 0)
            .reverse(),
        };

  return (
    <div className="relative">
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        aria-label={ariaLabel}
        className="overflow-visible"
        onPointerLeave={() => setHoverIndex(null)}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * width;
          const idx = Math.round((x - pad) / stepX);
          setHoverIndex(Math.max(0, Math.min(pointCount - 1, idx)));
        }}
      >
        <line
          x1={pad}
          x2={width - pad}
          y1={height - pad}
          y2={height - pad}
          stroke="var(--color-border)"
          strokeWidth={1}
        />

        {paths.map((layer) => (
          <g key={layer.key}>
            <path
              d={layer.area}
              fill={layer.color}
              opacity={layer.outline === "dotted" ? 0.04 : 0.18}
            />
            <path
              d={layer.topPath}
              fill="none"
              stroke={layer.color}
              strokeWidth={layer.outline === "dotted" ? 1.25 : 0.75}
              strokeDasharray={layer.outline === "dotted" ? "4 4" : undefined}
              strokeLinejoin="round"
            />
          </g>
        ))}

        {hover ? (
          <line
            x1={hover.x}
            x2={hover.x}
            y1={pad}
            y2={height - pad}
            stroke="var(--color-ink-soft)"
            strokeWidth={0.75}
            strokeDasharray="2 4"
          />
        ) : null}

        {ticks.map((t) => (
          <text
            key={t}
            x={toX(t)}
            y={height - 1}
            textAnchor={t === 0 ? "start" : t === pointCount - 1 ? "end" : "middle"}
            className="fill-[color:var(--color-ink-soft)]"
            style={{ fontSize: 10, fontFamily: "var(--font-sans, monospace)" }}
          >
            {formatShort(dates[t]!)}
          </text>
        ))}
      </svg>
      {hover ? (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-52 border border-[color:var(--color-border)] bg-[color:var(--color-paper)] p-3 text-xs shadow-sm"
          style={{
            left: `${(hover.x / width) * 100}%`,
            transform: hover.x > width * 0.72 ? "translateX(-100%)" : "translateX(0)",
          }}
        >
          <div className="mb-2 flex items-baseline justify-between gap-4 border-b border-[color:var(--color-border)] pb-2">
            <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              {formatLong(hover.date)}
            </span>
            <span className="font-display tabular-nums">{formatMoney(hover.total)}</span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {hover.rows.map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-2 text-[color:var(--color-ink-soft)]">
                  <span
                    aria-hidden
                    className="inline-block h-px w-5"
                    style={{
                      backgroundImage: row.dotted
                        ? `repeating-linear-gradient(to right, ${row.color} 0 4px, transparent 4px 8px)`
                        : undefined,
                      backgroundColor: row.dotted ? undefined : row.color,
                    }}
                  />
                  {row.label}
                </span>
                <span className="tabular-nums">{formatMoney(row.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function formatShort(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit" }).format(d);
}

function formatLong(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(d);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
