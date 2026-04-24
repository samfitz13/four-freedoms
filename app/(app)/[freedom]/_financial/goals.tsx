import {
  currentInvestedBalance,
  latestReportedNetWorth,
  listFinancialGoals,
} from "@/lib/db/queries/financial";
import type { FinancialGoal } from "@/lib/db/schema";
import { projectFi } from "@/lib/freedoms/fi-projection";
import type { FiProjection } from "@/lib/freedoms/types";
import { Money } from "@/components/freedoms/money";
import { ScoreRing } from "@/components/freedoms/score-ring";
import { AreaChart } from "@/components/freedoms/financial/area-chart";
import { FiGoalForm, NewGoalForm, UpdateProgressForm } from "./goals-forms";
import { archiveGoal } from "./goals-actions";

export async function FinancialGoalsTab({
  householdId,
  baseCurrency,
}: {
  householdId: string;
  baseCurrency: string;
}) {
  const [goals, invested, reportedNw] = await Promise.all([
    listFinancialGoals(householdId),
    currentInvestedBalance(householdId),
    latestReportedNetWorth(householdId),
  ]);

  const fiGoal = goals.find((g) => g.kind === "fi_number" && g.status === "active");
  const otherGoals = goals.filter((g) => g.kind !== "fi_number" && g.status !== "archived");

  const fiParams = readFiParams(fiGoal);
  // Prefer summed invested balances when the user has accounts wired up;
  // fall back to reported net worth from daily check-ins.
  const currentInvested = invested > 0 ? invested : (reportedNw ?? 0);

  const projection = fiParams
    ? projectFi({
        currentInvested,
        monthlyContribution: fiParams.monthlyContribution,
        realReturn: fiParams.realReturn,
        withdrawalRate: fiParams.withdrawalRate,
        targetAnnualSpend: fiParams.annualSpend,
      })
    : null;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <h2 className="font-serif text-2xl tracking-tight">Goals</h2>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Your FI number, projection, and shorter-horizon targets. FI progress uses your invested
          accounts (brokerage, retirement, crypto) when available and falls back to your latest
          reported net worth.
        </p>
      </header>

      <FiCard
        fiGoal={fiGoal}
        projection={projection}
        currentInvested={currentInvested}
        currency={baseCurrency}
      />

      <section className="flex flex-col gap-4">
        <h3 className="font-serif text-xl">Other goals</h3>
        {otherGoals.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-soft)]">No goals yet. Add one below.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
            {otherGoals.map((g) => (
              <li key={g.id} className="py-4">
                <GoalRow goal={g} currency={baseCurrency} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
          New goal
        </h3>
        <NewGoalForm currency={baseCurrency} />
      </section>
    </div>
  );
}

function FiCard({
  fiGoal,
  projection,
  currentInvested,
  currency,
}: {
  fiGoal: FinancialGoal | undefined;
  projection: FiProjection | null;
  currentInvested: number;
  currency: string;
}) {
  const params = readFiParams(fiGoal);
  const defaults = params ?? {
    annualSpend: undefined as number | undefined,
    withdrawalRate: 0.04,
    realReturn: 0.05,
    monthlyContribution: 0,
  };

  const progressPct = projection
    ? Math.round(Math.max(0, Math.min(1, currentInvested / Math.max(1, projection.fiNumber))) * 100)
    : 0;

  return (
    <section className="flex flex-col gap-6 border border-[color:var(--color-border)] p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
            Financial independence
          </span>
          <h3 className="font-serif text-2xl tracking-tight">
            {projection ? (
              <>
                <Money value={projection.fiNumber} currency={currency} fractionDigits={0} />
                <span className="ml-3 font-mono text-sm tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
                  FI number
                </span>
              </>
            ) : (
              "Set your FI target"
            )}
          </h3>
          {projection ? (
            <p className="text-sm text-[color:var(--color-ink-soft)]">
              At <span className="font-mono">{(projection.realReturn * 100).toFixed(1)}%</span> real
              return and{" "}
              <span className="font-mono">{(projection.withdrawalRate * 100).toFixed(1)}%</span>{" "}
              SWR,{" "}
              {projection.yearsToFi !== null
                ? `you reach FI in ~${projection.yearsToFi} year${projection.yearsToFi === 1 ? "" : "s"}.`
                : "your current plan doesn't reach FI within 50 years."}
            </p>
          ) : null}
        </div>
        {projection ? (
          <div className="flex flex-col items-end gap-1">
            <ScoreRing
              score={progressPct}
              color="var(--color-freedom-financial, #065f46)"
              size={72}
              stroke={5}
            />
            <span className="font-serif text-2xl tabular-nums">{progressPct}%</span>
            <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
              <Money value={currentInvested} currency={currency} compact /> invested
            </span>
          </div>
        ) : null}
      </div>

      {projection ? (
        <div className="flex flex-col gap-2">
          <AreaChart
            series={projection.years.map((y) => ({
              date: isoYear(y.year),
              value: y.balance,
            }))}
            color="var(--color-freedom-financial, #065f46)"
            ariaLabel="Projected FI balance by year"
            height={180}
          />
          <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
            <span>
              year 0 · <Money value={projection.years[0]!.balance} currency={currency} compact />
            </span>
            <span>
              FI line · <Money value={projection.fiNumber} currency={currency} compact />
            </span>
            <span>
              year {projection.years[projection.years.length - 1]!.year} ·{" "}
              <Money
                value={projection.years[projection.years.length - 1]!.balance}
                currency={currency}
                compact
              />
            </span>
          </div>
        </div>
      ) : null}

      <details
        open={!fiGoal}
        className="flex flex-col gap-3 border-t border-dashed border-[color:var(--color-border)] pt-4"
      >
        <summary className="cursor-pointer font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase select-none hover:text-[color:var(--color-foreground)]">
          {fiGoal ? "Adjust assumptions" : "Set FI target"}
        </summary>
        <div className="mt-4">
          <FiGoalForm defaults={defaults} currency={currency} />
        </div>
      </details>
    </section>
  );
}

function GoalRow({ goal, currency }: { goal: FinancialGoal; currency: string }) {
  const current = readNumber((goal.params as Record<string, unknown> | null)?.currentProgress) ?? 0;
  const target = goal.targetAmount ? Number(goal.targetAmount) : 0;
  const ratio = target > 0 ? Math.max(0, Math.min(1.25, current / target)) : 0;
  const pct = Math.round(ratio * 100);
  const achieved = goal.status === "achieved";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-lg tracking-tight">{goal.title}</span>
            <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
              {goal.kind.replace(/_/g, " ")}
            </span>
            {achieved ? (
              <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-freedom-financial,#065f46)] uppercase">
                Achieved
              </span>
            ) : null}
          </div>
          <span className="font-mono text-[11px] text-[color:var(--color-ink-soft)] tabular-nums">
            <Money value={current} currency={currency} fractionDigits={0} /> /{" "}
            <Money value={target} currency={currency} fractionDigits={0} />
            {goal.targetDate ? ` · by ${goal.targetDate}` : ""}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ScoreRing
            score={pct}
            color={achieved ? "var(--color-freedom-financial, #065f46)" : "var(--color-foreground)"}
          />
          <span className="font-mono text-[11px] tabular-nums">{pct}%</span>
        </div>
      </div>
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-border)" }}
        aria-hidden
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${Math.min(100, pct)}%`,
            background: achieved
              ? "var(--color-freedom-financial, #065f46)"
              : "var(--color-foreground)",
            opacity: 0.85,
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <UpdateProgressForm id={goal.id} currentProgress={current} currency={currency} />
        <form action={archiveGoal} className="ml-auto">
          <input type="hidden" name="id" value={goal.id} />
          <button
            type="submit"
            className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase hover:text-[color:var(--color-accent-warning,#9a3412)]"
          >
            Archive
          </button>
        </form>
      </div>
    </div>
  );
}

function readFiParams(goal: FinancialGoal | undefined) {
  if (!goal) return null;
  const p = (goal.params ?? {}) as Record<string, unknown>;
  const annualSpend = readNumber(p.annualSpend);
  if (annualSpend === undefined) return null;
  return {
    annualSpend,
    withdrawalRate: readNumber(p.withdrawalRate) ?? 0.04,
    realReturn: readNumber(p.realReturn) ?? 0.05,
    monthlyContribution: readNumber(p.monthlyContribution) ?? 0,
  };
}

function readNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Synthetic ISO date for the Area chart's X-axis (year-over-year points). */
function isoYear(n: number): string {
  const base = new Date();
  const year = base.getUTCFullYear() + n;
  return `${year}-01-01`;
}
