import Link from "next/link";
import type { FreedomMeta, TimeSummary } from "@/lib/freedoms/types";
import { listTimePursuits } from "@/lib/db/queries/time";
import { computeHabitProgress } from "@/lib/freedoms/time-habits";
import { computeTimeAllocation } from "@/lib/freedoms/time-allocation";
import { listAgendaEvents } from "@/lib/freedoms/time-agenda";
import { Sparkline } from "@/components/freedoms/sparkline";
import { ScoreRing } from "@/components/freedoms/score-ring";
import { toggleCheckin } from "./habits-actions";
import { upsertLogEntry } from "./log-actions";

export async function TimeOverview({
  meta,
  data,
  householdId,
}: {
  meta: FreedomMeta;
  data: TimeSummary;
  householdId: string;
}) {
  const [allocation, pursuits, habits, events] = await Promise.all([
    computeTimeAllocation(householdId),
    listTimePursuits(householdId),
    computeHabitProgress(householdId),
    listAgendaEvents(householdId, new Date(), daysFromNow(7)),
  ]);
  const answer = buildAnswer(data);
  const trendLabel = buildTrendLabel(data.trend, data.entriesThisWeek);
  const today = new Date().toISOString().slice(0, 10);
  const defaultPursuit = pursuits[0];
  const hasScore = data.entriesThisWeek > 0 || data.habitsTargetedThisWeek > 0;

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
            <span className="font-display text-3xl tabular-nums">{data.score}</span>
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
        <Stat label="Total · 7d" value={`${data.totalHours7.toFixed(1)}h`} />
        <Stat label="Matters · 7d" value={`${data.mattersHours7.toFixed(1)}h`} />
        <Stat label="On purpose" value={`${Math.round(data.mattersShare7 * 100)}%`} />
        <Stat
          label="Habits"
          value={`${data.habitsHitThisWeek}/${data.habitsTargetedThisWeek || 0}`}
        />
      </dl>

      <AllocationBar rows={allocation} />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-6">
          <h2 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            Up next
          </h2>
          {events.slice(0, 3).length ? (
            <ul className="divide-y divide-[color:var(--color-border)]">
              {events.slice(0, 3).map((event) => (
                <li key={`${event.id}-${event.occurrenceStartsAt.toISOString()}`} className="py-3">
                  <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                    {event.occurrenceStartsAt.toLocaleString("en", {
                      weekday: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="font-display text-lg tracking-tight">{event.title}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[color:var(--color-ink-soft)]">
              Nothing scheduled in the next week.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-6">
          <h2 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            Today’s habits
          </h2>
          {habits.length ? (
            <ul className="divide-y divide-[color:var(--color-border)]">
              {habits.map((habit) => {
                const hitToday = habit.trailing28.at(-1)?.hit ?? false;
                return (
                  <li key={habit.habitId} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm">{habit.title}</span>
                    <form action={toggleCheckin}>
                      <input type="hidden" name="habitId" value={habit.habitId} />
                      <input type="hidden" name="occurredOn" value={today} />
                      <button className="daybreak-button border border-[color:var(--color-border)] px-2 py-1 font-sans text-xs tracking-normal">
                        {hitToday ? "Done" : "Mark"}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[color:var(--color-ink-soft)]">
              No habits yet. Add one when cadence matters more than hours.
            </p>
          )}
        </div>
      </section>

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

      <LogForm pursuits={pursuits} defaultPursuitId={defaultPursuit?.id} />

      <ScoreRubric data={data} />
    </div>
  );
}

function LogForm({
  pursuits,
  defaultPursuitId,
}: {
  pursuits: Array<{ id: string; name: string }>;
  defaultPursuitId?: string;
}) {
  return (
    <section className="daybreak-panel flex flex-col gap-3 p-6">
      <h2 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        Log today
      </h2>
      {pursuits.length ? (
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Record the hours that mattered. Leave the rest unmeasured.
        </p>
      ) : (
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Create a pursuit before logging time. A pursuit is the thing the hours were for.{" "}
          <Link
            href="/time/pursuits"
            className="underline underline-offset-4 hover:text-[color:var(--color-foreground)]"
          >
            Add one.
          </Link>
        </p>
      )}
      {pursuits.length ? (
        <form action={upsertLogEntry} className="flex flex-wrap items-end gap-3 text-sm">
          <input type="hidden" name="recordedOn" value={new Date().toISOString().slice(0, 10)} />
          <select
            name="pursuitId"
            defaultValue={defaultPursuitId}
            className="daybreak-field border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] py-1 focus:border-[color:var(--color-foreground)]"
          >
            {pursuits.map((pursuit) => (
              <option key={pursuit.id} value={pursuit.id}>
                {pursuit.name}
              </option>
            ))}
          </select>
          <input
            name="hours"
            type="number"
            min={0}
            max={24}
            step={0.25}
            placeholder="Hours"
            className="daybreak-field w-24 border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-1 py-1 font-sans text-sm tabular-nums focus:border-[color:var(--color-foreground)]"
          />
          <button
            type="submit"
            className="daybreak-button border border-[color:var(--color-border)] px-3 py-1 font-sans text-xs tracking-normal hover:bg-[color:var(--color-paper-soft)]"
          >
            Save time
          </button>
        </form>
      ) : null}
    </section>
  );
}

function ScoreRubric({ data }: { data: TimeSummary }) {
  return (
    <details className="daybreak-panel group flex flex-col gap-3 p-6">
      <summary className="flex cursor-pointer items-center justify-between font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] select-none hover:text-[color:var(--color-foreground)]">
        <span>How this score is built</span>
        <span aria-hidden className="transition-transform group-open:rotate-90">
          →
        </span>
      </summary>
      <dl className="mt-3 grid grid-cols-[max-content_1fr_max-content] items-baseline gap-x-6 gap-y-2 text-sm">
        <dt className="font-display text-base tracking-tight">Deep work</dt>
        <dd className="text-[color:var(--color-ink-soft)]">
          Share of logged time attached to pursuits marked as what matters.
        </dd>
        <dd className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
          {data.components.intention}/40
        </dd>

        <dt className="font-display text-base tracking-tight">Cadence</dt>
        <dd className="text-[color:var(--color-ink-soft)]">
          Habit check-ins divided by this week’s habit targets.
        </dd>
        <dd className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
          {data.components.cadence}/30
        </dd>

        <dt className="font-display text-base tracking-tight">Balance</dt>
        <dd className="text-[color:var(--color-ink-soft)]">Non-zero work, play, care, and rest.</dd>
        <dd className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
          {data.components.balance}/20
        </dd>

        <dt className="font-display text-base tracking-tight">Coverage</dt>
        <dd className="text-[color:var(--color-ink-soft)]">Logged days this week.</dd>
        <dd className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
          {data.components.coverage}/10
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

function buildAnswer(data: TimeSummary): string | null {
  if (data.totalHours7 === 0 && data.habitsTargetedThisWeek === 0) return null;
  return `${data.totalHours7.toFixed(1)}h this week — ${Math.round(
    data.mattersShare7 * 100,
  )}% on what matters. ${data.habitsHitThisWeek}/${data.habitsTargetedThisWeek} habits hit.`;
}

function buildTrendLabel(trend: number, entriesThisWeek: number): string {
  if (entriesThisWeek === 0) return "no entries this week";
  if (trend === 0) return "flat vs last week";
  return trend > 0 ? `up ${trend} vs last week` : `down ${Math.abs(trend)} vs last week`;
}

function AllocationBar({
  rows,
}: {
  rows: Array<{ pursuitId: string; name: string; colorVar: string; hours7: number }>;
}) {
  const total = rows.reduce((sum, row) => sum + row.hours7, 0);
  if (total <= 0) return null;
  return (
    <section className="daybreak-panel flex flex-col gap-3 p-6">
      <h2 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        Weekly allocation
      </h2>
      <div className="flex min-h-11 overflow-hidden border border-[color:var(--color-border)]">
        {rows
          .filter((row) => row.hours7 > 0)
          .map((row) => (
            <div
              key={row.pursuitId}
              className="flex min-w-8 items-center px-2 font-sans text-xs text-[color:var(--color-paper)] tabular-nums"
              style={{ width: `${(row.hours7 / total) * 100}%`, background: row.colorVar }}
              title={`${row.name}: ${row.hours7.toFixed(1)}h`}
            >
              {row.hours7 / total > 0.14 ? `${row.name} ${row.hours7.toFixed(1)}h` : ""}
            </div>
          ))}
      </div>
    </section>
  );
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
