import Link from "next/link";
import { ArrowRight, BookOpen, MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth-server";
import { getPrimaryHouseholdId } from "@/lib/db/scope";
import { FREEDOMS } from "@/lib/freedoms/constants";
import type { DailyPoint, FreedomSummary } from "@/lib/freedoms/types";
import { computeFinancialSummary } from "@/lib/freedoms/financial-summary";
import { computeLocationSummary } from "@/lib/freedoms/location-summary";
import { computeTimeSummary } from "@/lib/freedoms/time-summary";
import { computeHealthSummary } from "@/lib/freedoms/health-summary";
import { getBaseCurrency } from "@/lib/freedoms/financial-settings";
import { computeCorrespondences, computeTodayStrip } from "@/lib/correspondences";
import { FreedomCard } from "@/components/freedoms/freedom-card";
import { CorrespondenceList } from "@/components/freedoms/correspondence-list";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(
      ((t.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    )
  );
}

function masthead(now: Date): string {
  const weekday = new Intl.DateTimeFormat("en", { weekday: "long" }).format(now);
  const day = now.getDate();
  const month = new Intl.DateTimeFormat("en", { month: "long" }).format(now);
  const year = now.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);

  const now = new Date();
  const head = masthead(now);
  const [financial, location, time, health, correspondences, todayStrip, currency] =
    await Promise.all([
      computeFinancialSummary(householdId),
      computeLocationSummary(householdId),
      computeTimeSummary(householdId),
      computeHealthSummary(householdId),
      computeCorrespondences(householdId, now),
      computeTodayStrip(householdId, head, now),
      getBaseCurrency(householdId),
    ]);

  const dataByKey = {
    financial,
    location,
    time,
    health,
  } as const;
  const primaryMetrics = {
    financial:
      financial.netWorth === null
        ? undefined
        : {
            label: "Net worth",
            value: formatMoney(financial.netWorth, currency),
            detail: "Your latest recorded balances",
          },
    location:
      location.currentPlace === null
        ? undefined
        : {
            label: "Where you are",
            value: location.currentPlace,
            detail: location.currentCountry ?? undefined,
          },
    time:
      time.entriesThisWeek > 0
        ? {
            label: "Meaningful time · past 7 days",
            value: formatHours(time.mattersHours7),
            detail: `${formatHours(time.totalHours7)} total logged`,
          }
        : undefined,
    health:
      health.meanSleep30 === null
        ? undefined
        : {
            label: "Average sleep · past 30 days",
            value: formatHours(health.meanSleep30),
            detail: "From your recorded sleep",
          },
  };

  const cards = FREEDOMS.map((meta) => {
    const d = dataByKey[meta.key];
    const summary: FreedomSummary = {
      key: meta.key,
      score: d.score,
      trend: d.trend,
      entriesThisWeek: d.entriesThisWeek,
      streak: d.streak,
    };
    const series: DailyPoint[] = d.series;
    return { meta, summary, series };
  });

  const liveActive = cards.filter((c) => (c.summary.entriesThisWeek ?? 0) > 0);
  const nothingMeasured = liveActive.length === 0;
  const attention = liveActive.reduce<TodayAttention | null>((lowest, card) => {
    const score = card.summary.score;
    if (score === null) return lowest;
    if (lowest !== null && score >= lowest.score) return lowest;
    return {
      href: `/${card.meta.key}`,
      label: card.meta.label,
      score,
    };
  }, null);

  return (
    <section className="flex flex-col gap-9 sm:gap-11">
      <header className="flex flex-col gap-5 px-1">
        <p className="eyebrow">{head}</p>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h1 className="dashboard-title font-display max-w-2xl">A little more room.</h1>
          <span className="daybreak-inset px-4 py-2 text-xs font-semibold tabular-nums">
            Week {isoWeek(now)} · {liveActive.length} of 4 measured
          </span>
        </div>
        <p className="max-w-xl text-base leading-7 text-[color:var(--color-ink-soft)]">
          A little perspective on the life you&rsquo;re building.
        </p>
      </header>

      <div className="flex min-w-0 flex-col gap-6">
        <section aria-labelledby="freedoms-heading" className="min-w-0">
          <h2 id="freedoms-heading" className="sr-only">
            Your freedoms this week
          </h2>
          <ul className="daybreak-home-grid">
            {cards.map(({ meta, summary, series }) => (
              <li key={meta.key} className="min-w-0">
                <FreedomCard
                  meta={meta}
                  summary={summary}
                  series={series}
                  primaryMetric={primaryMetrics[meta.key]}
                />
              </li>
            ))}
          </ul>
        </section>

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <TodayStrip strip={todayStrip} attention={attention} currency={currency} />
          <section className="daybreak-panel flex flex-col items-start gap-4 p-6 sm:p-8">
            <BookOpen
              size={23}
              strokeWidth={1.5}
              className="text-[color:var(--color-ink-soft)]"
              aria-hidden
            />
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-2xl tracking-tight">
                {nothingMeasured ? "Start small." : "Make room to reflect."}
              </h2>
              <p className="text-sm leading-6 text-[color:var(--color-ink-soft)]">
                {nothingMeasured
                  ? "One honest entry is enough. Pick a freedom and begin wherever you are."
                  : "Step back from the numbers. Notice what helped, and what you want to change."}
              </p>
            </div>
            <Link href="/review/this-week" className="daybreak-button">
              Your weekly review <ArrowRight size={15} aria-hidden />
            </Link>
          </section>
        </div>
      </div>

      <section
        aria-labelledby="patterns-heading"
        className="daybreak-panel flex flex-col gap-5 p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow mb-2">The bigger picture</p>
            <h2 id="patterns-heading" className="font-display text-2xl tracking-tight sm:text-3xl">
              Everything is connected.
            </h2>
          </div>
          <Link href="/relations" className="app-nav-link">
            All patterns <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
        <CorrespondenceList correspondences={correspondences} limit={4} />
      </section>
    </section>
  );
}

type TodayAttention = {
  href: string;
  label: string;
  score: number;
};

function TodayStrip({
  strip,
  attention,
  currency,
}: {
  strip: Awaited<ReturnType<typeof computeTodayStrip>>;
  attention: TodayAttention | null;
  currency: string;
}) {
  const place = strip.place ?? "Where are you today?";
  const details = [
    { label: "Sleep", value: strip.sleepHours === null ? null : formatHours(strip.sleepHours) },
    {
      label: "Deep work",
      value: strip.deepWorkHours === null ? null : formatHours(strip.deepWorkHours),
    },
    {
      label: "Net worth",
      value: strip.netWorth === null ? null : formatMoney(strip.netWorth, currency),
    },
  ].filter((part) => part.value !== null);

  return (
    <aside aria-labelledby="today-heading" className="daybreak-inset p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="today-heading" className="eyebrow">
          A moment for today
        </h2>
        <MapPin size={16} className="shrink-0 text-[color:var(--color-ink-soft)]" aria-hidden />
      </div>
      <div className="mt-5 flex flex-col gap-4">
        <p className="font-display text-2xl leading-snug tracking-tight break-words">{place}</p>
        {strip.place === null ? (
          <Link
            href="/location/overview"
            className="daybreak-button flex min-h-11 items-center gap-2 text-sm font-bold"
          >
            Log your place <ArrowRight size={14} aria-hidden />
          </Link>
        ) : null}
        {details.length ? (
          <dl className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4 text-sm">
            {details.map(({ label, value }) => (
              <div
                key={label}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
              >
                <dt className="text-[color:var(--color-ink-soft)]">{label}</dt>
                <dd className="font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm leading-6 text-[color:var(--color-ink-soft)]">
            Your place, rest, and focus will find a home here.
          </p>
        )}
        {attention ? (
          <Link
            href={attention.href}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-border)] pt-4"
          >
            <span className="flex flex-col gap-1">
              <span className="micro-action">Worth a little attention</span>
              <span className="font-display text-lg tracking-tight">{attention.label}</span>
            </span>
            <span className="text-xs font-semibold text-[color:var(--color-ink-soft)] tabular-nums">
              {attention.score}/100 →
            </span>
          </Link>
        ) : null}
        {strip.notes.length ? (
          <p className="border-t border-[color:var(--color-border)] pt-3 text-xs text-[color:var(--color-ink-soft)]">
            {strip.notes[0]}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function formatHours(value: number): string {
  const totalMinutes = Math.round(value * 60);
  const whole = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${whole}h` : `${whole}h${String(minutes).padStart(2, "0")}`;
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
