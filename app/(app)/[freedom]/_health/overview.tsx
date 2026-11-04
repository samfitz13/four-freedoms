import Link from "next/link";
import type { FreedomMeta, HealthSummary } from "@/lib/freedoms/types";
import { Sparkline } from "@/components/freedoms/sparkline";
import { ScoreRing } from "@/components/freedoms/score-ring";
import { listRecentBody, listRecentSleep, listRecentWorkouts } from "@/lib/db/queries/health";
import { formatWeightDeltaLb, formatWeightLb, kgToLb } from "@/lib/freedoms/health-units";

export async function HealthOverview({
  meta,
  data,
  householdId,
}: {
  meta: FreedomMeta;
  data: HealthSummary;
  householdId: string;
}) {
  const [sleepRows, workoutRows, bodyRows] = await Promise.all([
    listRecentSleep(householdId, 90),
    listRecentWorkouts(householdId, 90),
    listRecentBody(householdId, 90),
  ]);
  const hasScore = data.entriesThisWeek > 0;
  const answer = buildAnswer(data);
  const trendLabel = buildTrendLabel(data.trend, data.entriesThisWeek);
  const sleepSeries = sleepRows
    .slice()
    .reverse()
    .map((row) => ({ date: row.recordedOn, value: Number(row.sleepHours) }));
  const weightSeries = bodyRows
    .filter((row) => row.weightKg !== null)
    .slice()
    .reverse()
    .map((row) => ({
      date: row.recordedAt.toISOString().slice(0, 10),
      value: kgToLb(Number(row.weightKg)),
    }));
  const rhrSeries = bodyRows
    .filter((row) => row.restingHr !== null)
    .slice()
    .reverse()
    .slice(-14)
    .map((row) => ({ date: row.recordedAt.toISOString().slice(0, 10), score: row.restingHr }));
  const weeklyTraining = buildWeeklyTraining(workoutRows);

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

      <p className="max-w-2xl text-sm leading-6 text-[color:var(--color-ink-soft)]">
        {answer
          ? "Keep the signal current with sleep, training, body, or energy entries."
          : "Start with the health entry that feels true today: sleep, training, body, or energy."}{" "}
        <Link
          href="/health/log"
          className="underline underline-offset-4 hover:text-[color:var(--color-foreground)]"
        >
          Log health.
        </Link>
      </p>

      <dl className="daybreak-inset flex flex-wrap gap-x-8 gap-y-8 p-6">
        {data.meanSleep30 !== null ? (
          <Stat label="Sleep" value={`${data.meanSleep30.toFixed(1)}h`} detail="30d average" />
        ) : null}
        <Stat
          label="Training"
          value={`${Math.round(data.trainingMinutes30 / (30 / 7))}`}
          detail="min / wk"
        />
        {data.latestWeightKg !== null ? (
          <Stat
            label="Weight"
            value={formatWeightLb(data.latestWeightKg)}
            detail={
              data.weightDelta30 === null
                ? "latest"
                : `${formatWeightDeltaLb(data.weightDelta30)} lbs · 30d`
            }
          />
        ) : null}
        {data.meanEnergy30 !== null ? (
          <Stat label="Energy" value={`${data.meanEnergy30.toFixed(1)}/10`} detail="30d average" />
        ) : null}
        {data.meanRhr30 !== null ? (
          <div className="flex flex-col gap-1">
            <dt className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              Resting HR
            </dt>
            <dd className="flex items-end gap-3">
              <span className="font-display text-2xl tabular-nums">
                {Math.round(data.meanRhr30)}
              </span>
              <MiniLine values={rhrSeries} color={meta.colorVar} />
            </dd>
          </div>
        ) : null}
      </dl>

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

      <section className="grid gap-8 lg:grid-cols-2">
        <ChartBlock title="Sleep · 30d">
          <RangeLineChart series={sleepSeries.slice(-30)} color={meta.colorVar} suffix="h" />
        </ChartBlock>
        <ChartBlock title="Training · 12 weeks">
          <WeeklyStackedBars weeks={weeklyTraining} color={meta.colorVar} />
        </ChartBlock>
        <ChartBlock title="Weight · 90d">
          <RangeLineChart series={weightSeries} color={meta.colorVar} suffix=" lbs" endLabel />
        </ChartBlock>
      </section>

      <ScoreRubric data={data} />
    </div>
  );
}

function ScoreRubric({ data }: { data: HealthSummary }) {
  return (
    <details className="daybreak-panel group flex flex-col gap-3 p-6">
      <summary className="flex cursor-pointer items-center justify-between font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] select-none hover:text-[color:var(--color-foreground)]">
        <span>How this score is built</span>
        <span aria-hidden className="transition-transform group-open:rotate-90">
          →
        </span>
      </summary>
      <dl className="mt-3 grid grid-cols-[max-content_1fr_max-content] items-baseline gap-x-6 gap-y-2 text-sm">
        <dt className="font-display text-base tracking-tight">Sleep</dt>
        <dd className="text-[color:var(--color-ink-soft)]">
          Mean 30d sleep closest to 8h, with a small premium for low variance.
        </dd>
        <dd className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
          {data.components.sleep}/30
        </dd>

        <dt className="font-display text-base tracking-tight">Frequency</dt>
        <dd className="text-[color:var(--color-ink-soft)]">
          Training days against a four-days-per-week target.
        </dd>
        <dd className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
          {data.components.trainingFrequency}/25
        </dd>

        <dt className="font-display text-base tracking-tight">Volume</dt>
        <dd className="text-[color:var(--color-ink-soft)]">
          Training minutes against a 150-minute weekly target.
        </dd>
        <dd className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
          {data.components.trainingVolume}/15
        </dd>

        <dt className="font-display text-base tracking-tight">Recovery</dt>
        <dd className="text-[color:var(--color-ink-soft)]">
          Resting heart rate stability against the 30d baseline.
        </dd>
        <dd className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
          {data.components.recovery}/15
        </dd>

        <dt className="font-display text-base tracking-tight">Energy</dt>
        <dd className="text-[color:var(--color-ink-soft)]">
          Subjective 1–10 rating, linear to full points.
        </dd>
        <dd className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
          {data.components.energy}/15
        </dd>
      </dl>
    </details>
  );
}

function Stat({ label, value, detail }: { label: string; value: React.ReactNode; detail: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="font-display text-2xl tabular-nums">{value}</dd>
      <dd className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
        {detail}
      </dd>
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

function buildAnswer(data: HealthSummary): string | null {
  const parts: string[] = [];
  if (data.meanSleep30 !== null) {
    parts.push(`${data.meanSleep30.toFixed(1)}h sleep`);
  }
  if (data.trainingDays30 > 0) {
    parts.push(`${(data.trainingDays30 / (30 / 7)).toFixed(1)} workouts/wk`);
  }
  if (data.weightDelta30 !== null) {
    parts.push(`weight ${formatWeightDeltaLb(data.weightDelta30)} lbs over 30 days`);
  }
  return parts.length ? parts.join("; ") + "." : null;
}

function buildTrendLabel(trend: number, entriesThisWeek: number): string {
  if (entriesThisWeek === 0) return "no entries this week";
  if (trend === 0) return "flat vs last week";
  return trend > 0 ? `up ${trend} vs last week` : `down ${Math.abs(trend)} vs last week`;
}

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4">
      <h2 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function RangeLineChart({
  series,
  color,
  suffix,
  endLabel = false,
}: {
  series: { date: string; value: number }[];
  color: string;
  suffix: string;
  endLabel?: boolean;
}) {
  if (series.length < 2) {
    return <p className="text-sm text-[color:var(--color-ink-soft)]">Not enough signal yet.</p>;
  }
  const width = 520;
  const height = 150;
  const pad = 18;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const step = (width - pad * 2) / Math.max(1, series.length - 1);
  const points = series.map((point, index) => ({
    ...point,
    x: pad + index * step,
    y: pad + (height - pad * 2) * (1 - (point.value - min) / span),
  }));
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
  const last = points.at(-1)!;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${series.length}-point line chart`}
    >
      <line x1={pad} x2={width - pad} y1={pad} y2={pad} stroke="var(--color-border)" />
      <line
        x1={pad}
        x2={width - pad}
        y1={height - pad}
        y2={height - pad}
        stroke="var(--color-border)"
      />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
      <text x={pad} y={pad - 5} className="fill-[color:var(--color-ink-soft)] font-sans text-xs">
        {max.toFixed(1)}
        {suffix}
      </text>
      <text x={pad} y={height - 2} className="fill-[color:var(--color-ink-soft)] font-sans text-xs">
        {min.toFixed(1)}
        {suffix}
      </text>
      {endLabel ? (
        <text
          x={last.x + 6}
          y={last.y + 3}
          className="fill-[color:var(--color-ink-soft)] font-sans text-xs"
        >
          {last.value.toFixed(1)}
          {suffix}
        </text>
      ) : null}
    </svg>
  );
}

function MiniLine({
  values,
  color,
}: {
  values: { date: string; score: number | null }[];
  color: string;
}) {
  return values.length ? (
    <Sparkline series={values} color={color} width={90} height={22} valueSuffix=" bpm" />
  ) : null;
}

function WeeklyStackedBars({
  weeks,
  color,
}: {
  weeks: { label: string; total: number; kinds: Record<string, number> }[];
  color: string;
}) {
  const max = Math.max(150, ...weeks.map((week) => week.total));
  return (
    <div className="flex h-40 items-end gap-2">
      {weeks.map((week) => (
        <div key={week.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-28 w-full max-w-8 flex-col justify-end border-b border-[color:var(--color-border)]">
            {Object.entries(week.kinds)
              .filter(([, minutes]) => minutes > 0)
              .map(([kind, minutes], index) => (
                <span
                  key={kind}
                  title={`${kind}: ${minutes} min`}
                  className="block"
                  style={{
                    height: `${Math.max(2, (minutes / max) * 112)}px`,
                    background: index === 0 ? color : "var(--color-ink-soft)",
                    opacity: 1 - index * 0.12,
                  }}
                />
              ))}
          </div>
          <span className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
            {week.total || "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function buildWeeklyTraining(rows: Awaited<ReturnType<typeof listRecentWorkouts>>) {
  const weeks = Array.from({ length: 12 }, (_, index) => {
    const start = new Date();
    start.setDate(start.getDate() - (11 - index) * 7);
    return {
      start,
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      total: 0,
      kinds: { strength: 0, cardio: 0, mobility: 0, sport: 0, other: 0 },
    };
  });
  for (const row of rows) {
    const diff = Date.now() - row.performedAt.getTime();
    const idx = 11 - Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
    if (idx >= 0 && idx < weeks.length) {
      weeks[idx]!.total += row.minutes;
      weeks[idx]!.kinds[row.kind] += row.minutes;
    }
  }
  return weeks;
}
