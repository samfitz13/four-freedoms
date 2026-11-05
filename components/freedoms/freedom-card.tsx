import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { DailyPoint, FreedomMeta, FreedomSummary } from "@/lib/freedoms/types";
import { Sparkline } from "./sparkline";
import { FreedomIcon } from "./freedom-icon";

export function FreedomCard({
  meta,
  summary,
  series,
  primaryMetric,
}: {
  meta: FreedomMeta;
  summary: FreedomSummary;
  series: DailyPoint[];
  primaryMetric?: { label: string; value: string; detail?: string };
}) {
  const score = summary.score;
  const entries = summary.entriesThisWeek ?? 0;
  const hasScore = score !== null && entries > 0;
  const trend = summary.trend;
  const starts = {
    financial: { href: "/financial/accounts", label: "Add an account" },
    location: { href: "/location/overview", label: "Rate today’s place" },
    time: { href: "/time/overview", label: "Log meaningful hours" },
    health: { href: "/health/log", label: "Add a body signal" },
  };
  const start = starts[meta.key];

  return (
    <Link
      href={entries > 0 || primaryMetric ? `/${meta.key}/overview` : start.href}
      data-freedom={meta.key}
      className="daybreak-panel daybreak-interactive dashboard-card"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="daybreak-icon">
            <FreedomIcon freedom={meta.key} size={18} />
          </span>
          <h3 className="text-sm font-semibold">{meta.label}</h3>
        </div>
        <ArrowUpRight
          size={18}
          className="shrink-0 text-[color:var(--daybreak-accent)]"
          aria-hidden
        />
      </div>

      <p className="dashboard-card-question">{meta.question}</p>
      {primaryMetric ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[color:var(--color-ink-soft)]">{primaryMetric.label}</p>
          <p className="daybreak-card-metric">{primaryMetric.value}</p>
          {primaryMetric.detail ? (
            <p className="text-xs text-[color:var(--color-ink-soft)]">{primaryMetric.detail}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[color:var(--color-ink-soft)]">
            {entries > 0 ? "Score · past 7 days" : "Not yet measured"}
          </span>
          <span className="font-display text-2xl tabular-nums">
            {hasScore ? (
              <>
                {score}
                <span className="ml-1 font-sans text-sm text-[color:var(--color-ink-soft)]">
                  / 100
                </span>
              </>
            ) : (
              <span aria-label="No score yet">—</span>
            )}
          </span>
        </div>
        {hasScore ? (
          <span className="flex flex-col items-end gap-2">
            <Sparkline series={series} color={meta.colorVar} width={112} height={36} />
            <span className="text-xs text-[color:var(--color-ink-soft)]">Score trend</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--color-border)] pt-4 text-xs text-[color:var(--color-ink-soft)] tabular-nums">
        {entries > 0 ? (
          <>
            <span>
              {entries} {entries === 1 ? "entry" : "entries"} this week
            </span>
            {hasScore && trend !== null ? (
              <span>
                {trend > 0 ? "+" : ""}
                {trend} point trend
              </span>
            ) : null}
            {summary.streak !== null ? <span>{summary.streak}d streak</span> : null}
          </>
        ) : (
          <span className="font-semibold text-[color:var(--daybreak-accent)]">
            {primaryMetric ? `Explore ${meta.label}` : start.label} →
          </span>
        )}
      </div>
    </Link>
  );
}
