import Link from "next/link";
import type { FreedomMeta, LocationSummary } from "@/lib/freedoms/types";
import { listConnections } from "@/lib/db/queries/location";
import { Sparkline } from "@/components/freedoms/sparkline";
import { ScoreRing } from "@/components/freedoms/score-ring";
import { logSatisfaction } from "./actions";

export async function LocationOverview({
  meta,
  data,
  householdId,
}: {
  meta: FreedomMeta;
  data: LocationSummary;
  householdId: string;
}) {
  const connections = await listConnections(householdId);
  const hasScore = data.score > 0;
  const answer = buildAnswer(data);
  const trendLabel = buildTrendLabel(data.trend, data.entriesThisWeek);

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-wrap items-start justify-between gap-6 border-b border-[color:var(--color-border)] pb-10">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="h-[2px] w-8 rounded-full"
              style={{ background: meta.colorVar }}
            />
            <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              {meta.label}
            </span>
          </div>
          <h1 className="font-display max-w-xl text-4xl leading-[1.1] tracking-tight">
            {meta.question}
          </h1>
          {answer ? (
            <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">{answer}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <ScoreRing score={data.score} color={meta.colorVar} size={64} stroke={4} />
          <div className="flex items-baseline gap-1">
            <span className="font-display text-3xl tabular-nums">
              {hasScore ? data.score : "—"}
            </span>
            <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              /100
            </span>
          </div>
          <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            {trendLabel}
          </span>
        </div>
      </header>

      <dl className="daybreak-inset flex flex-wrap gap-x-8 gap-y-8 p-6">
        <Stat label="Where" value={data.currentPlace ?? "—"} />
        {data.daysAtCurrent !== null ? (
          <Stat label="Days here" value={`${data.daysAtCurrent}d`} />
        ) : null}
        {data.meanSatisfaction30 !== null ? (
          <Stat label="Satisfaction · 30d" value={`${data.meanSatisfaction30.toFixed(1)}/10`} />
        ) : null}
        <Stat label="Away" value={`${data.daysAwayYtd}d`} />
      </dl>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="daybreak-panel p-6">
          <h2 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            Where I am
          </h2>
          <p className="font-display mt-3 text-2xl">{data.currentPlace ?? "No current stay"}</p>
          {data.currentCountry ? (
            <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">{data.currentCountry}</p>
          ) : (
            <Link
              href="/location/places"
              className="mt-1 text-sm text-[color:var(--color-ink-soft)] underline underline-offset-4 hover:text-[color:var(--color-foreground)]"
            >
              Start a stay in Places to anchor today.
            </Link>
          )}
        </section>
        <section className="daybreak-panel p-6">
          <h2 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            Next trip
          </h2>
          {data.nextTrip ? (
            <>
              <p className="font-display mt-3 text-2xl">{data.nextTrip.name}</p>
              <p className="mt-1 font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                {data.nextTrip.startsOn} → {data.nextTrip.endsOn}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-[color:var(--color-ink-soft)]">
              No trip planned. Add one when travel becomes real.
            </p>
          )}
        </section>
      </div>

      <YearPlaceBreakdown rows={data.yearPlaceBreakdown} />

      <dl className="daybreak-inset flex flex-wrap items-start gap-x-8 gap-y-6 p-6 text-sm">
        <Meter label="Days logged · 7d" value={data.entriesThisWeek} />
        <div className="flex flex-col gap-1">
          <dt className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            Trend · 14d
          </dt>
          <dd className="flex flex-col gap-2">
            <span className="font-display text-2xl tabular-nums">
              {hasScore ? `${data.trend > 0 ? "+" : ""}${data.trend}` : "—"}
            </span>
            <Sparkline
              series={data.series}
              color={meta.colorVar}
              width={140}
              height={28}
              interactive
              valueSuffix="/100"
            />
          </dd>
        </div>
        <Meter label="Streak" value={`${data.streak}d`} />
      </dl>

      <LogForm connections={connections} />

      <ScoreRubric data={data} />
    </div>
  );
}

function YearPlaceBreakdown({ rows }: { rows: LocationSummary["yearPlaceBreakdown"] }) {
  return (
    <section className="daybreak-panel p-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          Year in places
        </h2>
        {rows.length ? (
          <>
            <div className="mt-2 flex h-2 overflow-hidden bg-[color:var(--color-paper-soft)]">
              {rows.map((row, index) => {
                const color = placeBreakdownColor(index);
                return (
                  <span
                    key={row.placeId}
                    title={`${row.placeName}: ${row.days}d`}
                    className="h-full border-r border-[color:var(--color-paper)] last:border-r-0"
                    style={{
                      width: `${row.share * 100}%`,
                      background: color,
                    }}
                  />
                );
              })}
            </div>
            <ol className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
              {rows.map((row, index) => {
                const color = placeBreakdownColor(index);
                return (
                  <li
                    key={`${row.placeId}-label`}
                    className="grid grid-cols-[0.75rem_1fr_max-content] items-baseline gap-2"
                  >
                    <span aria-hidden className="h-2 w-2" style={{ background: color }} />
                    <span>
                      {row.placeName}
                      {row.country ? (
                        <span className="ml-2 font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                          {row.country}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                      {row.days}d
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            No places logged this year. Start with where you slept last night.
          </p>
        )}
      </div>
    </section>
  );
}

function placeBreakdownColor(index: number) {
  return placeBreakdownColors[index % placeBreakdownColors.length]!;
}

const placeBreakdownColors = [
  "var(--color-freedom-location)",
  "var(--color-freedom-financial)",
  "var(--color-freedom-time)",
  "var(--color-freedom-health)",
  "color-mix(in oklch, var(--color-freedom-location) 62%, var(--color-ink))",
  "color-mix(in oklch, var(--color-freedom-financial) 62%, var(--color-ink))",
  "color-mix(in oklch, var(--color-freedom-time) 62%, var(--color-ink))",
  "color-mix(in oklch, var(--color-freedom-health) 62%, var(--color-ink))",
];

function LogForm({ connections }: { connections: Awaited<ReturnType<typeof listConnections>> }) {
  return (
    <section className="daybreak-panel flex flex-col gap-3 p-6">
      <h2 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        Log today
      </h2>
      <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
        Give today a 1–10 read. Add a note only if the number needs context.
      </p>
      <form action={logSatisfaction} className="flex flex-wrap items-baseline gap-4">
        <label htmlFor="satisfaction" className="text-sm">
          Satisfaction (1–10)
        </label>
        <input
          id="satisfaction"
          name="satisfaction"
          type="number"
          min={1}
          max={10}
          step={1}
          required
          className="daybreak-field w-20 border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-1 py-1 font-sans text-sm tabular-nums focus:border-[color:var(--color-foreground)]"
        />
        <input
          name="note"
          placeholder="Note (optional)"
          maxLength={500}
          className="daybreak-field min-w-[16rem] flex-1 border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-1 py-1 text-sm focus:border-[color:var(--color-foreground)]"
        />
        {connections.length ? (
          <div className="flex flex-wrap gap-2">
            {connections.map((connection) => (
              <label
                key={connection.id}
                className="inline-flex items-center gap-1 border border-[color:var(--color-border)] px-2 py-1 font-sans text-xs tracking-normal"
              >
                <input type="checkbox" name="withConnectionIds" value={connection.id} />
                {connection.name}
              </label>
            ))}
          </div>
        ) : null}
        <button
          type="submit"
          className="daybreak-button border border-[color:var(--color-border)] px-3 py-1 font-sans text-xs tracking-normal hover:bg-[color:var(--color-surface-muted,transparent)]"
        >
          Save
        </button>
      </form>
    </section>
  );
}

function ScoreRubric({ data }: { data: LocationSummary }) {
  return (
    <details className="daybreak-panel group flex flex-col gap-3 p-6">
      <summary className="flex cursor-pointer items-center justify-between font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] select-none hover:text-[color:var(--color-foreground)]">
        <span>How this score is built</span>
        <span aria-hidden className="transition-transform group-open:rotate-90">
          →
        </span>
      </summary>
      <dl className="mt-3 grid grid-cols-[max-content_1fr_max-content] items-baseline gap-x-6 gap-y-2 text-sm">
        <dt className="font-display text-base tracking-tight">Rootedness</dt>
        <dd className="text-[color:var(--color-ink-soft)]">
          Years at the open primary residence, saturated at three years.
        </dd>
        <dd className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
          {data.components.rootedness}/35
        </dd>

        <dt className="font-display text-base tracking-tight">Belonging</dt>
        <dd className="text-[color:var(--color-ink-soft)]">
          Connections seen within their cadence window.
        </dd>
        <dd className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
          {data.components.belonging}/25
        </dd>

        <dt className="font-display text-base tracking-tight">Exploration</dt>
        <dd className="text-[color:var(--color-ink-soft)]">
          Days away from the primary residence in the trailing year.
        </dd>
        <dd className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
          {data.components.exploration}/20
        </dd>

        <dt className="font-display text-base tracking-tight">Satisfaction</dt>
        <dd className="text-[color:var(--color-ink-soft)]">
          Mean 1–10 location satisfaction over the last 30 days.
        </dd>
        <dd className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
          {data.components.satisfaction}/20
        </dd>
      </dl>
    </details>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="font-display text-2xl tabular-nums">{value}</dd>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="font-display text-2xl tabular-nums">{value}</dd>
    </div>
  );
}

function buildAnswer(data: LocationSummary): string | null {
  if (!data.primaryResidenceName) return "No primary residence yet.";
  return `${formatYears(data.yearsAtPrimary)} in ${data.primaryResidenceName} — ${data.connectionsOnCadence}/${data.connectionsWithCadence} connections on cadence · ${data.daysAwayYtd} days away this year.`;
}

function buildTrendLabel(trend: number, entriesThisWeek: number): string {
  if (entriesThisWeek === 0) return "no entries this week";
  if (trend === 0) return "flat vs last week";
  return trend > 0 ? `up ${trend} vs last week` : `down ${Math.abs(trend)} vs last week`;
}

function formatYears(years: number) {
  if (years < 1) return `${Math.round(years * 12)}mo`;
  return `${Math.round(years * 10) / 10}y`;
}
