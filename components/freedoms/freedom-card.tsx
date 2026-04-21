import Link from "next/link";
import type { FreedomMeta, FreedomSummary } from "@/lib/freedoms/types";
import type { DailyPoint } from "@/lib/freedoms/summary";
import { Sparkline } from "./sparkline";
import { ScoreRing } from "./score-ring";

export function FreedomCard({
  meta,
  summary,
  series,
}: {
  meta: FreedomMeta;
  summary: FreedomSummary;
  series: DailyPoint[];
}) {
  const trendSign = summary.trend > 0 ? "+" : "";
  const empty = summary.entriesThisWeek === 0;

  return (
    <Link
      href={`/${meta.key}`}
      className="group flex flex-col gap-5 py-8 transition-opacity hover:opacity-90"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-[2px] w-6 rounded-full"
            style={{ background: meta.colorVar }}
          />
          <h3 className="font-serif text-2xl tracking-tight">{meta.label}</h3>
        </div>
        <ScoreRing score={summary.score} color={meta.colorVar} />
      </div>

      <p className="text-sm text-[color:var(--color-ink-soft)]">{meta.question}</p>

      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
            Score · 7d
          </span>
          <span className="font-serif text-3xl tabular-nums">{empty ? "—" : summary.score}</span>
        </div>

        <Sparkline series={series} color={meta.colorVar} />
      </div>

      <div className="flex items-center justify-between font-mono text-xs text-[color:var(--color-ink-soft)]">
        <span>
          trend{" "}
          <span className="text-[color:var(--color-foreground)]">
            {empty ? "—" : `${trendSign}${summary.trend}`}
          </span>
        </span>
        <span>
          streak <span className="text-[color:var(--color-foreground)]">{summary.streak}d</span>
        </span>
      </div>
    </Link>
  );
}
