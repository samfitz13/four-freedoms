import type { ReactNode } from "react";
import { latestBalances, listFinancialGoals } from "@/lib/db/queries/financial";
import {
  getDerivedFiInputs,
  getSavingsRateSeries,
  getTrailingSavingsRate,
  type SavingsRatePoint,
} from "@/lib/freedoms/financial-derived";
import type { FinancialGoal } from "@/lib/db/schema";
import { getHouseholdFiPlan } from "@/lib/freedoms/fi-plan-server";
import type { FiPlanView } from "@/lib/freedoms/fi-plan";
import { classifyAccount } from "@/lib/freedoms/account-subtypes";
import { AccountClass } from "@/lib/freedoms/enums";
import type { DerivedFiInputs } from "@/lib/freedoms/types";
import { Money } from "@/components/freedoms/money";
import { Sparkline } from "@/components/freedoms/sparkline";
import { FiScenarioComparison } from "@/components/freedoms/financial/fi-scenario-comparison";
import { UpdateProgressForm } from "./goals-forms";
import { NewGoalLauncher } from "./new-goal-launcher";
import { AssumptionsLauncher } from "./assumptions-launcher";
import { GoalLinksLauncher } from "./goal-links-launcher";
import { archiveGoal } from "./goals-actions";
import type { AccountOption } from "./goals-forms";
import { getUserBirthDate } from "@/lib/db/queries/profile";
import { formatProjectionDate } from "@/lib/profile/birth-date";

export async function FinancialGoalsTab({
  householdId,
  baseCurrency,
  userId,
}: {
  householdId: string;
  baseCurrency: string;
  userId: string;
}) {
  const [goals, view, observed, balances, savingsSeries, birthDate] = await Promise.all([
    listFinancialGoals(householdId),
    getHouseholdFiPlan(householdId),
    getDerivedFiInputs(householdId),
    latestBalances(householdId),
    getSavingsRateSeries(householdId, 12),
    getUserBirthDate(userId),
  ]);
  const derived = { ...observed, trailingContributions: view.trailingContributions };

  const accountOptions: AccountOption[] = balances
    .filter((b) => !b.isArchived)
    .map((b) => ({
      id: b.accountId,
      name: b.accountName,
      type: b.type as string,
      klass: classifyAccount(b.type) as AccountOption["klass"],
    }));

  const fiGoal = goals.find((g) => g.kind === "fi_number" && g.status === "active");
  const otherGoals = goals.filter(
    (g) => g.kind !== "fi_number" && g.kind !== "savings_rate_target" && g.status !== "archived",
  );
  const rateGoals = goals.filter(
    (g) => g.kind === "savings_rate_target" && g.status !== "archived",
  );

  const fiParams = view.settings;
  const todayMonth = monthStartUtc(new Date());

  const assumptionDefaults = {
    ...(fiParams ?? {
      annualSpend: undefined,
      withdrawalRate: 0.04,
      realReturn: 0.05,
      monthlyContribution: 0,
    }),
    inflationRate: fiParams?.version === 2 ? fiParams.assumptions.inflation : 0.03,
  };

  return (
    <div className="goals-workspace">
      <header className="goals-page-heading">
        <h2>Goals</h2>
        <NewGoalLauncher currency={baseCurrency} accounts={accountOptions} />
      </header>

      <FiCard
        birthDate={birthDate}
        view={view}
        milestones={otherGoals}
        todayMonth={todayMonth}
        currency={baseCurrency}
        derived={derived}
        controls={
          <AssumptionsLauncher
            defaults={assumptionDefaults}
            derived={derived}
            currency={baseCurrency}
            hasGoal={Boolean(fiGoal)}
            view={{ settings: view.settings, allocation: view.allocation }}
            birthDate={birthDate}
          />
        }
      />

      {rateGoals.length > 0 ? (
        <section className="daybreak-panel goals-group">
          <h3 className="goals-group-title">Savings rhythm</h3>
          <ul className="goals-list">
            {rateGoals.map((g) => (
              <li key={g.id}>
                <SavingsRateRow goal={g} series={savingsSeries} householdId={householdId} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {otherGoals.length > 0 ? (
        <section className="daybreak-panel goals-group">
          <h3 className="goals-group-title">Milestones</h3>
          <ul className="goals-list">
            {otherGoals.map((g) => (
              <li key={g.id}>
                <GoalRow
                  goal={g}
                  currency={baseCurrency}
                  balances={balances}
                  accounts={accountOptions}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function FiCard({
  birthDate,
  view,
  milestones,
  todayMonth,
  currency,
  derived,
  controls,
}: {
  birthDate: string | null;
  view: FiPlanView;
  milestones: FinancialGoal[];
  todayMonth: string;
  currency: string;
  controls: ReactNode;
  derived: DerivedFiInputs;
}) {
  const { settings: params, plan, actualSeries, contribution: contributionUsed } = view;
  const currentInvested = view.allocation.balance;

  if (!plan || !params) {
    return (
      <section className="daybreak-panel goals-fi goals-empty">
        <h3>Financial independence</h3>
        <p>{params ? "Projection needs attention." : "No FI target set."}</p>
        {params && (
          <ul>
            {view.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
        <div>{controls}</div>
      </section>
    );
  }

  const progressPct = Math.round(
    Math.max(0, Math.min(1, currentInvested / Math.max(1, plan.fiNumber))) * 100,
  );

  return (
    <section className="daybreak-panel goals-fi">
      <div className="goals-section-heading">
        <h3>Financial independence</h3>
        {controls}
      </div>
      <dl className="goals-stats">
        <div>
          <dt>Invested now</dt>
          <dd>
            <Money value={currentInvested} currency={currency} fractionDigits={0} />
          </dd>
        </div>
        <div>
          <dt>FI target</dt>
          <dd>
            <Money value={plan.fiNumber} currency={currency} fractionDigits={0} />
          </dd>
        </div>
        <div>
          <dt>Base plan reaches target</dt>
          <dd>
            {plan.monthsToFi === 0
              ? "Met at projection start"
              : plan.fiMonth
                ? formatProjectionDate(plan.fiMonth, birthDate)
                : "Not reached by plan end"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4 font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          <span>{progressPct}% of target</span>
          <span>
            <Money
              value={Math.max(0, plan.fiNumber - currentInvested)}
              currency={currency}
              compact
            />{" "}
            to go
          </span>
        </div>
        <div
          className="goals-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPct}
          aria-label="Progress toward FI"
        >
          <div
            className="goals-progress-fill"
            style={{
              width: `${Math.min(100, progressPct)}%`,
            }}
          />
        </div>
      </div>

      <p className="fi-chart-note">
        {params.retirementMonth
          ? `Retirement · ${formatProjectionDate(params.retirementMonth, birthDate)}`
          : "Accumulation plan · Adjust assumptions to complete retirement settings"}
        {" · "}
        Contributions ·{" "}
        <Money value={contributionUsed ?? 0} currency={currency} fractionDigits={0} /> / mo.
        {params.useManualContribution ? (
          " · Manual"
        ) : (
          <>
            {" · "}12-month average · {derived.trailingContributions.monthsObserved}/12 months
            recorded
          </>
        )}
      </p>

      <FiScenarioComparison
        scenarios={view.scenarios}
        stress={view.stress}
        returnHistory={derived.returnHistory}
        chart={{
          birthDate,
          actualSeries,
          todayMonth,
          currency,
          milestones: milestones.map((goal) => ({
            id: goal.id,
            title: goal.title,
            targetDate: goal.targetDate,
            targetAmount: goal.targetAmount === null ? null : Number(goal.targetAmount),
            status: goal.status,
          })),
        }}
      />

      <details className="goals-assumptions">
        <summary>Plan assumptions & statement history</summary>
        <dl className="goals-assumption-grid">
          <AssumptionRow
            label="Annual spend"
            value={<Money value={params.annualSpend} currency={currency} fractionDigits={0} />}
          />
          <AssumptionRow
            label="Withdrawal rate"
            value={`${(params.withdrawalRate * 100).toFixed(1)}% / yr`}
          />
          <AssumptionRow
            label="Base real return"
            value={`${(view.scenarios.find((s) => s.kind === "base")!.realReturn! * 100).toFixed(2)}% / yr · ${params.returnMode === "manual" ? "Manual, net of fees" : params.assumptions.version}`}
          />
          <AssumptionRow
            label="Monthly contribution"
            value={
              <>
                <Money value={contributionUsed ?? 0} currency={currency} fractionDigits={0} /> / mo
              </>
            }
          />
        </dl>
        <p className="fi-chart-note">
          Contributions, retirement spending (including your tax budget), and after-tax income are
          in today’s dollars. FI is a milestone, not a retirement instruction or a measure of
          whole-retirement funding.
        </p>
        {params.version === 2 && params.returnMode === "portfolio" && (
          <>
            <p className="fi-chart-note">
              Constant allocation with modeled rebalancing · Weighted fund expenses{" "}
              {(view.allocation.expenseRate * 100).toFixed(3)}%{" · "}Additional fee{" "}
              {(params.assumptions.additionalFee * 100).toFixed(2)}%{" · "}Inflation{" "}
              {(params.assumptions.inflation * 100).toFixed(1)}%. Nominal planning returns: equities{" "}
              {(params.assumptions.equities * 100).toFixed(1)}%, bonds{" "}
              {(params.assumptions.bonds * 100).toFixed(1)}%, cash{" "}
              {(params.assumptions.cash * 100).toFixed(1)}%. Equities ±2 pp, bonds ±1 pp, cash ±0.5
              pp.
            </p>
            <dl className="goals-assumption-grid">
              {(
                [
                  ["usEquity", "US equities"],
                  ["developedEquity", "Developed international"],
                  ["emergingEquity", "Emerging markets"],
                  ["bonds", "Municipal bonds"],
                  ["cash", "Cash"],
                ] as const
              ).map(([key, label]) => (
                <AssumptionRow
                  key={key}
                  label={label}
                  value={`${(view.allocation.weights[key] * 100).toFixed(1)}%`}
                />
              ))}
            </dl>
          </>
        )}
        <p className="fi-chart-note">
          Allocation: {view.allocation.coverage.filter((a) => a.included && a.allocation).length}/
          {view.allocation.coverage.filter((a) => a.included).length} accounts
          {" · "}
          <Money
            value={view.allocation.coveredBalance}
            currency={currency}
            fractionDigits={0}
          />{" "}
          covered. Statements anchor balances at month end; modeled cash flows begin the following
          month.
        </p>
        <ul className="fi-chart-note">
          {view.allocation.coverage
            .filter((a) => a.included)
            .map((a) => (
              <li key={a.id}>
                {a.name} · {a.source ?? "Allocation not set"} · Statement{" "}
                {a.statementMonth?.slice(0, 7) ?? "missing"}
                {" · "}Snapshot {a.snapshotDate ?? "missing"} · Quotes {a.quoteDate ?? "unknown"} ·
                Cash {a.cashDate ?? "unknown"}
              </li>
            ))}
        </ul>
        {params.retirementMonth && (
          <p className="fi-chart-note">
            Retirement {formatProjectionDate(params.retirementMonth, birthDate)} · Plan end{" "}
            {formatProjectionDate(params.endMonth!, birthDate)}
            {" · "}After-tax income{" "}
            <Money value={params.monthlyRetirementIncome} currency={currency} /> / mo
            {params.incomeStartMonth
              ? ` from ${formatProjectionDate(params.incomeStartMonth, birthDate)}`
              : ""}
            . No jurisdiction-specific tax calculation or account withdrawal ordering.
          </p>
        )}

        {derived.monthsObserved > 0 ? (
          <div className="goals-observed">
            <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              Realized so far
            </span>
            <p className="text-sm text-[color:var(--color-ink-soft)]">
              {derived.avgMonthlyContribution !== null ? (
                <>
                  all-history avg contribution{" "}
                  <span className="font-sans text-[color:var(--color-foreground)] tabular-nums">
                    <Money
                      value={derived.avgMonthlyContribution}
                      currency={currency}
                      fractionDigits={0}
                    />{" "}
                    / mo
                  </span>
                  {" · "}
                </>
              ) : null}
              {derived.realizedAnnualReturn !== null ? (
                <>
                  balance-based annual return estimate{" "}
                  <span className="font-sans text-[color:var(--color-foreground)] tabular-nums">
                    {(derived.realizedAnnualReturn * 100).toFixed(1)}% / yr (nominal)
                  </span>
                  {" · "}
                </>
              ) : null}
              <span className="font-sans tabular-nums">
                {derived.monthsObserved} month{derived.monthsObserved === 1 ? "" : "s"} observed
                {derived.oldestMonth ? ` since ${formatMonth(derived.oldestMonth)}` : ""}
              </span>
            </p>
          </div>
        ) : null}
      </details>
    </section>
  );
}

function AssumptionRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="font-display text-base tabular-nums">{value}</dd>
    </div>
  );
}

function GoalRow({
  goal,
  currency,
  balances,
  accounts,
}: {
  goal: FinancialGoal;
  currency: string;
  balances: Awaited<ReturnType<typeof latestBalances>>;
  accounts: AccountOption[];
}) {
  const params = (goal.params ?? {}) as Record<string, unknown>;
  const linkedAccountIds = readStringArray(params.linkedAccountIds);
  const linkedClass = readString(params.linkedClass);
  const invert = params.invert === true;

  const linkMode: "manual" | "accounts" | "class" =
    linkedAccountIds.length > 0 ? "accounts" : linkedClass !== null ? "class" : "manual";

  const target = goal.targetAmount ? Number(goal.targetAmount) : 0;
  const linkedSum = (() => {
    if (linkMode === "accounts") {
      const ids = new Set(linkedAccountIds);
      return balances.filter((b) => ids.has(b.accountId)).reduce((s, b) => s + b.balance, 0);
    }
    if (linkMode === "class" && linkedClass) {
      return balances
        .filter((b) => classifyAccount(b.type) === (linkedClass as AccountClass))
        .reduce((s, b) => s + Math.abs(b.balance), 0);
    }
    return null;
  })();

  // For inverted (debt-payoff) goals, "current" is paid-down progress vs target.
  const manualProgress = readNumber(params.currentProgress) ?? 0;
  let current = manualProgress;
  if (linkedSum !== null) {
    current = invert ? Math.max(0, target - linkedSum) : linkedSum;
  }
  const ratio = target > 0 ? Math.max(0, Math.min(1.25, current / target)) : 0;
  const pct = Math.round(ratio * 100);
  const achieved = goal.status === "achieved" || (target > 0 && current >= target);

  const linkLabel = (() => {
    if (linkMode === "manual") return "manual";
    if (linkMode === "class") return `class · ${linkedClass}`;
    const names = balances
      .filter((b) => linkedAccountIds.includes(b.accountId))
      .map((b) => b.accountName);
    return `linked · ${names.length > 2 ? `${names.length} accounts` : names.join(", ")}`;
  })();

  return (
    <div className="goals-row">
      <div className="goals-row-heading">
        <div className="flex flex-col">
          <div className="goals-title-line">
            <h4>{goal.title}</h4>
            <span className="goals-kind">{goal.kind.replace(/_/g, " ")}</span>
            {achieved ? <span className="goals-status">Achieved</span> : null}
          </div>
          <p className="goals-row-amount">
            <Money value={current} currency={currency} fractionDigits={0} />
            <span className="goals-row-target">
              {" "}
              of <Money value={target} currency={currency} fractionDigits={0} />
            </span>
          </p>
          <p className="goals-row-meta">
            {goal.targetDate ? `By ${goal.targetDate} · ` : ""}
            {linkLabel}
          </p>
        </div>
        <span className="goals-percent">{pct}%</span>
      </div>
      <div
        className="goals-progress"
        role="progressbar"
        aria-label={`${goal.title} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, pct)}
        aria-valuetext={`${pct}% of target`}
      >
        <div
          className="goals-progress-fill"
          style={{
            width: `${Math.min(100, pct)}%`,
          }}
        />
      </div>
      <details className="goals-manage">
        <summary>Manage goal</summary>
        <div className="goals-actions">
          {linkMode === "manual" ? (
            <UpdateProgressForm id={goal.id} currentProgress={current} currency={currency} />
          ) : (
            <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              Auto-updates from latest statement
            </span>
          )}
          <GoalLinksLauncher
            goalId={goal.id}
            initial={{
              linkMode,
              linkedAccountIds,
              linkedClass,
              invert,
            }}
            accounts={accounts}
          />
          <form action={archiveGoal} className="ml-auto">
            <input type="hidden" name="id" value={goal.id} />
            <button
              type="submit"
              className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-accent-warning,#9a3412)]"
            >
              Archive
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}

async function SavingsRateRow({
  goal,
  series,
  householdId,
}: {
  goal: FinancialGoal;
  series: SavingsRatePoint[];
  householdId: string;
}) {
  const params = (goal.params ?? {}) as Record<string, unknown>;
  const targetRate = readNumber(params.targetRate) ?? 0.2;
  const window = readNumber(params.window) ?? 12;
  const trailing = await getTrailingSavingsRate(householdId, window);

  // Map the savings-rate series to DailyPoint[] (sparkline scale 0..100).
  const sparkSeries = series.slice(-Math.min(12, series.length)).map((p) => ({
    date: p.month,
    score: p.savingsRate !== null ? Math.max(0, Math.min(100, p.savingsRate * 100)) : null,
  }));

  const ratePct = trailing.rate !== null ? trailing.rate * 100 : null;
  const targetPct = targetRate * 100;
  const above = ratePct !== null && ratePct >= targetPct;

  return (
    <div className="goals-row">
      <div className="goals-row-heading">
        <div className="flex flex-col">
          <div className="goals-title-line">
            <h4>{goal.title}</h4>
            <span className="goals-kind">savings rate · {window}-mo trailing</span>
            {above ? <span className="goals-status">Above target</span> : null}
          </div>
          <p className="goals-row-amount">
            {ratePct !== null ? `${ratePct.toFixed(1)}%` : "—"}
            <span className="goals-row-target"> · target {targetPct.toFixed(0)}%</span>
          </p>
          <p className="goals-row-meta">
            {trailing.months > 0 ? `${trailing.months} mo observed` : "Waiting for statements"}
          </p>
        </div>
        <div className="goals-rate-trend">
          <Sparkline series={sparkSeries} color="var(--color-accent)" width={160} height={32} />
          <span className="goals-row-meta">Monthly savings rate</span>
        </div>
      </div>
      <details className="goals-manage">
        <summary>Manage target</summary>
        <div className="goals-actions">
          <form action={archiveGoal} className="ml-auto">
            <input type="hidden" name="id" value={goal.id} />
            <button
              type="submit"
              className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-accent-warning,#9a3412)]"
            >
              Archive
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}

function readNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function readString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function readStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function formatMonth(m: string): string {
  const d = new Date(m + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}

function monthStartUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
