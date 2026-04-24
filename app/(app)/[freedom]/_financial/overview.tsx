import type { Entry } from "@/lib/db/schema";
import type { FreedomMeta, FreedomSummary } from "@/lib/freedoms/types";
import type { DailyPoint } from "@/lib/freedoms/types";
import type { FinancialPayload } from "@/lib/freedoms/types";
import { Sparkline } from "@/components/freedoms/sparkline";
import { ScoreRing } from "@/components/freedoms/score-ring";
import { Money } from "@/components/freedoms/money";

type OverviewEntry = Pick<Entry, "id" | "occurredOn" | "source"> & { payload: FinancialPayload };

export function FinancialOverview({
  meta,
  summary,
  series,
  entries,
  baseCurrency,
}: {
  meta: FreedomMeta;
  summary: FreedomSummary;
  series: DailyPoint[];
  entries: OverviewEntry[];
  baseCurrency: string;
}) {
  const mostRecent = findLatest(entries, (p) => p.netWorth !== undefined);
  const earliest30 = findEarliestIn(entries, 30, (p) => p.netWorth !== undefined);
  const netWorth = mostRecent?.payload.netWorth ?? null;
  const netWorth30 = earliest30?.payload.netWorth ?? null;
  const delta30 =
    netWorth !== null && netWorth30 !== null && netWorth30 !== 0 ? netWorth - netWorth30 : null;

  const latestRate = findLatest(entries, (p) => p.savingsRate !== undefined)?.payload.savingsRate;
  const latestRunway = findLatest(entries, (p) => p.runwayMonths !== undefined)?.payload
    .runwayMonths;
  const latestFi = findLatest(entries, (p) => p.fiProgress !== undefined)?.payload.fiProgress;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-start justify-between gap-6 border-b border-[color:var(--color-border)] pb-10">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="h-[2px] w-8 rounded-full"
              style={{ background: meta.colorVar }}
            />
            <span className="font-mono text-xs tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
              {meta.label}
            </span>
          </div>
          <h1 className="max-w-xl font-serif text-4xl leading-[1.1] tracking-tight">
            {meta.question}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ScoreRing score={summary.score} color={meta.colorVar} size={64} stroke={4} />
          <span className="font-serif text-3xl tabular-nums">
            {summary.entriesThisWeek ? summary.score : "—"}
          </span>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-5">
        <Stat
          label="Net worth"
          value={
            netWorth !== null ? <Money value={netWorth} currency={baseCurrency} compact /> : "—"
          }
        />
        <Stat
          label="Δ 30d"
          value={
            delta30 !== null ? (
              <span
                className={delta30 >= 0 ? "" : "text-[color:var(--color-accent-warning,#9a3412)]"}
              >
                {delta30 >= 0 ? "+" : ""}
                <Money value={delta30} currency={baseCurrency} compact />
              </span>
            ) : (
              "—"
            )
          }
        />
        <Stat
          label="Savings rate"
          value={latestRate !== undefined ? `${Math.round(latestRate * 100)}%` : "—"}
        />
        <Stat
          label="Runway"
          value={latestRunway !== undefined ? `${latestRunway.toFixed(1)}mo` : "—"}
        />
        <Stat
          label="FI progress"
          value={latestFi !== undefined ? `${Math.round(latestFi * 100)}%` : "—"}
        />
      </dl>

      <div className="flex items-end justify-between gap-6">
        <dl className="grid grid-cols-3 gap-10 text-sm">
          <Meter label="Entries · 7d" value={summary.entriesThisWeek} />
          <Meter
            label="Trend"
            value={
              summary.entriesThisWeek ? `${summary.trend > 0 ? "+" : ""}${summary.trend}` : "—"
            }
          />
          <Meter label="Streak" value={`${summary.streak}d`} />
        </dl>
        <Sparkline series={series} color={meta.colorVar} width={260} height={48} />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-xl">Recent check-ins</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-soft)]">No entries yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
            {entries.slice(0, 10).map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-6 py-3">
                <span className="font-mono text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                  {e.occurredOn}
                </span>
                <span className="flex-1 text-sm">{summarize(e.payload, baseCurrency)}</span>
                <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
                  {e.source}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
        {label}
      </dt>
      <dd className="font-serif text-2xl tabular-nums">{value}</dd>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
        {label}
      </dt>
      <dd className="font-serif text-2xl tabular-nums">{value}</dd>
    </div>
  );
}

function findLatest<T extends { payload: FinancialPayload }>(
  entries: T[],
  pred: (p: FinancialPayload) => boolean,
): T | undefined {
  // entries arrive newest-first.
  return entries.find((e) => pred(e.payload));
}

function findEarliestIn<T extends { payload: FinancialPayload; occurredOn: string }>(
  entries: T[],
  days: number,
  pred: (p: FinancialPayload) => boolean,
): T | undefined {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  let earliest: T | undefined;
  for (const e of entries) {
    if (e.occurredOn < cutoffIso) break;
    if (pred(e.payload)) earliest = e;
  }
  return earliest;
}

function summarize(p: FinancialPayload, currency: string): string {
  const parts: string[] = [];
  if (p.netWorth !== undefined) {
    parts.push(
      `net worth ${new Intl.NumberFormat("en", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(p.netWorth)}`,
    );
  }
  if (p.savingsRate !== undefined) parts.push(`${Math.round(p.savingsRate * 100)}% saved`);
  if (p.runwayMonths !== undefined) parts.push(`${p.runwayMonths.toFixed(1)}mo runway`);
  if (p.fiProgress !== undefined) parts.push(`${Math.round(p.fiProgress * 100)}% FI`);
  return parts.join(" · ") || (p.note ?? "—");
}
