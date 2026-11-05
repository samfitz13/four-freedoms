import Link from "next/link";
import { requireUser } from "@/lib/auth-server";
import { getPrimaryHouseholdId } from "@/lib/db/scope";
import { computeCorrespondences } from "@/lib/correspondences";
import { computeFinancialSummary } from "@/lib/freedoms/financial-summary";
import { computeLocationSummary } from "@/lib/freedoms/location-summary";
import { computeTimeSummary } from "@/lib/freedoms/time-summary";
import { computeHealthSummary } from "@/lib/freedoms/health-summary";
import { FREEDOMS } from "@/lib/freedoms/constants";
import { CorrespondenceList } from "@/components/freedoms/correspondence-list";

export const metadata = { title: "This week" };
export const dynamic = "force-dynamic";

export default async function ThisWeekReviewPage() {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const [financial, location, time, health, correspondences] = await Promise.all([
    computeFinancialSummary(householdId),
    computeLocationSummary(householdId),
    computeTimeSummary(householdId),
    computeHealthSummary(householdId),
    computeCorrespondences(householdId),
  ]);
  const rows = [
    {
      key: "financial",
      score: financial.score,
      lines: [
        financial.netWorth === null
          ? "Net worth needs a statement."
          : `Net worth $${Math.round(financial.netWorth).toLocaleString()}.`,
        financial.savingsRate === null
          ? "Savings rate unmeasured."
          : `Savings rate ${Math.round(financial.savingsRate * 100)}%.`,
        financial.runwayMonths === null
          ? "Runway needs cashflow history."
          : `Runway ${financial.runwayMonths.toFixed(1)} months.`,
      ],
    },
    {
      key: "location",
      score: location.score,
      lines: [
        location.currentPlace
          ? `Currently in ${location.currentPlace}.`
          : "No current place logged.",
        `Away ${location.daysAway365} days in the trailing year.`,
        location.meanSatisfaction30 === null
          ? "Satisfaction unmeasured."
          : `Satisfaction ${location.meanSatisfaction30.toFixed(1)}/10.`,
      ],
    },
    {
      key: "time",
      score: time.score,
      lines: [
        `${time.totalHours7.toFixed(1)} hours logged this week.`,
        `${time.mattersHours7.toFixed(1)} hours on what matters.`,
        `${time.habitsHitThisWeek}/${time.habitsTargetedThisWeek} habit targets hit.`,
      ],
    },
    {
      key: "health",
      score: health.score,
      lines: [
        health.meanSleep30 === null
          ? "Sleep unmeasured."
          : `Mean sleep ${health.meanSleep30.toFixed(1)}h.`,
        `${health.trainingDays30} training days in the trailing month.`,
        health.meanEnergy30 === null
          ? "Energy unmeasured."
          : `Energy ${health.meanEnergy30.toFixed(1)}/10.`,
      ],
    },
  ] as const;

  return (
    <section className="flex flex-col gap-10 print:gap-6">
      <Link
        href="/dashboard"
        className="brand-mark hover:text-[color:var(--color-foreground)] print:hidden"
      >
        ← dashboard
      </Link>
      <header className="daybreak-section-head border-b border-[color:var(--color-border)] pb-6">
        <p className="eyebrow">This week</p>
        <h1 className="font-display mt-2 text-4xl tracking-tight">Four freedoms review.</h1>
      </header>

      <div className="grid gap-px border border-[color:var(--color-border)] bg-[color:var(--color-border)] md:grid-cols-4">
        {rows.map((row) => {
          const meta = FREEDOMS.find((freedom) => freedom.key === row.key)!;
          return (
            <section key={row.key} className="bg-[color:var(--color-paper)] p-5">
              <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                {meta.label}
              </p>
              <p className="font-display mt-4 text-4xl tabular-nums">{row.score}</p>
              <ul className="mt-6 flex flex-col divide-y divide-[color:var(--color-border)]">
                {row.lines.map((line) => (
                  <li key={line} className="py-3 text-sm leading-6">
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl tracking-tight">Correspondences</h2>
        <CorrespondenceList correspondences={correspondences} limit={6} />
      </section>
    </section>
  );
}
