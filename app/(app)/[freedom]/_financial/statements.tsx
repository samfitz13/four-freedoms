import Link from "next/link";
import { listAccounts } from "@/lib/db/queries/financial";
import { listStatementMonths, monthEnd, monthStart, shiftMonth } from "@/lib/db/queries/statements";
import { isIsoOptionAccount, isoOptionAccountValues } from "@/lib/db/queries/iso-options";
import { computeMonthlyRollup, getCompositionHistory } from "@/lib/freedoms/financial-statements";
import type { MonthlyRollup } from "@/lib/freedoms/types";
import {
  acceptsContribution,
  acceptsEmployerMatch,
  classifyAccount,
} from "@/lib/freedoms/account-subtypes";
import { AccountClass } from "@/lib/freedoms/enums";
import { Money } from "@/components/freedoms/money";
import { StatementsEditLauncher } from "./statements-edit-modal";
import type { EditableRow } from "./types";
import { seedNewMonth } from "./statements-actions";

const MONTH_FMT = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatMonth(month: string): string {
  return MONTH_FMT.format(new Date(month + "T00:00:00Z"));
}

export async function FinancialStatementsTab({
  householdId,
  baseCurrency,
  selectedMonth,
}: {
  householdId: string;
  baseCurrency: string;
  selectedMonth?: string;
}) {
  const months = await listStatementMonths(householdId);
  const today = monthStart(new Date());
  const month =
    (selectedMonth && /^\d{4}-\d{2}-01$/.test(selectedMonth) ? selectedMonth : null) ??
    months[0] ??
    today;

  const [rollup, accounts, history, isoValues] = await Promise.all([
    computeMonthlyRollup(householdId, month),
    listAccounts(householdId),
    getCompositionHistory(householdId, month, 12),
    isoOptionAccountValues(householdId, monthEnd(month)),
  ]);

  const monthLabel = formatMonth(month);
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  // Build the editable rows: prefer existing statement values, fall back to
  // zeros so every account shows in the modal.
  const rowsById = new Map(rollup.rows.map((r) => [r.accountId, r]));
  const editableRows: EditableRow[] = accounts.map((a) => {
    const r = rowsById.get(a.id);
    const isIso = isIsoOptionAccount(a.type, a.subtype);
    return {
      accountId: a.id,
      accountName: a.name,
      type: a.type,
      subtype: a.subtype ?? null,
      klass: classifyAccount(a.type),
      endingBalance: isIso ? (isoValues.get(a.id) ?? 0) : (r?.endingBalance ?? 0),
      employeeContribution: r?.employeeContribution ?? 0,
      employerMatch: r?.employerMatch ?? 0,
      isDerived: isIso,
    };
  });

  const monthsAvailable = months.length;

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-col gap-6 border-b border-[color:var(--color-border)] pb-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-2xl tracking-tight">Statements</h2>
            <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
              Month-end balances, contributions, and computed gain per account. Recreates the wealth
              ledger you keep in spreadsheet form.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/financial/income?year=${month.slice(0, 4)}`}
              replace
              scroll={false}
              className="daybreak-button inline-flex min-h-11 items-center border border-[color:var(--color-border)] px-3 font-sans text-xs tracking-normal hover:bg-[color:var(--color-surface-muted,transparent)]"
            >
              Edit income →
            </Link>
            <StatementsEditLauncher
              month={month}
              monthLabel={monthLabel}
              rows={editableRows}
              savingsRateGoal={rollup.savingsRateGoal}
            />
            {!rollup.hasData ? (
              <form action={seedNewMonth}>
                <input type="hidden" name="month" value={month} />
                <button
                  type="submit"
                  className="daybreak-button inline-flex min-h-11 items-center border border-[color:var(--color-border)] px-3 font-sans text-xs tracking-normal hover:bg-[color:var(--color-foreground)] hover:text-[color:var(--color-paper)]"
                >
                  + Seed month
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <MonthPicker
          monthLabel={monthLabel}
          prevMonth={prevMonth}
          nextMonth={nextMonth}
          totalMonths={monthsAvailable}
        />
      </header>

      {rollup.hasData ? (
        <>
          <RollupPanel rollup={rollup} currency={baseCurrency} />
          <CompositionPanel history={history} currency={baseCurrency} />
          <AccountsTable rollup={rollup} currency={baseCurrency} />
        </>
      ) : (
        <EmptyState month={month} />
      )}
    </div>
  );
}

function MonthPicker({
  monthLabel,
  prevMonth,
  nextMonth,
  totalMonths,
}: {
  monthLabel: string;
  prevMonth: string;
  nextMonth: string;
  totalMonths: number;
}) {
  return (
    <nav className="flex items-center gap-3">
      <Link
        href={`/financial/statements?month=${prevMonth}`}
        replace
        scroll={false}
        className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
      >
        ◀ {formatMonth(prevMonth)}
      </Link>
      <span className="font-display text-xl tracking-tight">{monthLabel}</span>
      <Link
        href={`/financial/statements?month=${nextMonth}`}
        replace
        scroll={false}
        className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
      >
        {formatMonth(nextMonth)} ▶
      </Link>
      <span className="ml-auto font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
        {totalMonths} {totalMonths === 1 ? "month" : "months"} on file
      </span>
    </nav>
  );
}

function RollupPanel({ rollup, currency }: { rollup: MonthlyRollup; currency: string }) {
  const goalDelta =
    rollup.savingsRate !== null && rollup.savingsRateGoal !== null
      ? rollup.savingsRate - rollup.savingsRateGoal
      : null;
  return (
    <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <KvCard label="Net worth">
        <span className="font-display text-3xl tabular-nums">
          <Money value={rollup.netWorth} currency={currency} fractionDigits={0} />
        </span>
        {rollup.delta !== null ? (
          <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
            Δ <Money value={rollup.delta} currency={currency} fractionDigits={0} />
            {rollup.deltaPct !== null ? ` · ${(rollup.deltaPct * 100).toFixed(1)}%` : ""}
          </span>
        ) : (
          <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            no prior month
          </span>
        )}
      </KvCard>

      <KvCard label="Net income">
        <span className="font-display text-3xl tabular-nums">
          <Money value={rollup.netIncome} currency={currency} fractionDigits={0} />
        </span>
        <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
          paystubs <Money value={rollup.netIncomeFromPaystubs} currency={currency} compact /> ·
          cashflow <Money value={rollup.netIncomeFromCashflow} currency={currency} compact />
          {rollup.netIncomeFromPaystubs > 0 &&
          rollup.netIncomeFromCashflow > 0 &&
          Math.abs(rollup.netIncomeFromPaystubs - rollup.netIncomeFromCashflow) > 50
            ? " · ⚠ drift"
            : ""}
        </span>
      </KvCard>

      <KvCard label="Savings rate">
        <span className="font-display text-3xl tabular-nums">
          {rollup.savingsRate !== null ? `${(rollup.savingsRate * 100).toFixed(1)}%` : "—"}
        </span>
        <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
          saved <Money value={rollup.totalSaved} currency={currency} compact /> ·{" "}
          {rollup.savingsRateGoal !== null
            ? `goal ${(rollup.savingsRateGoal * 100).toFixed(1)}%${
                goalDelta !== null
                  ? ` · ${goalDelta >= 0 ? "+" : ""}${(goalDelta * 100).toFixed(1)}pp`
                  : ""
              }`
            : "no goal"}
        </span>
      </KvCard>

      <KvCard label="Financial independence">
        <span className="font-display text-3xl tabular-nums">
          {rollup.fiPercent !== null ? `${(rollup.fiPercent * 100).toFixed(1)}%` : "—"}
        </span>
        <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
          {rollup.fiPercentDelta !== null
            ? `Δ ${rollup.fiPercentDelta >= 0 ? "+" : ""}${(rollup.fiPercentDelta * 100).toFixed(2)}pp · `
            : ""}
          SW <Money value={rollup.swMonthly} currency={currency} compact />
          /mo · <Money value={rollup.swYearly} currency={currency} compact />
          /yr
        </span>
      </KvCard>
    </section>
  );
}

function KvCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-l border-[color:var(--color-border)] pl-4">
      <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {label}
      </span>
      {children}
    </div>
  );
}

function CompositionPanel({
  history,
  currency,
}: {
  history: Array<{ klass: string; points: Array<{ month: string; value: number }> }>;
  currency: string;
}) {
  const labels: Record<string, string> = {
    cash: "Cash",
    investments: "Investments",
    equity: "Equity",
    debt: "Debt",
  };
  const colors: Record<string, string> = {
    cash: "var(--color-ink-soft)",
    investments: "var(--color-freedom-financial, #065f46)",
    equity: "var(--color-freedom-time, #b45309)",
    debt: "var(--color-accent-warning, #9a3412)",
  };
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        Composition · trailing 12 months
      </h3>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {history.map((s) => {
          const last = s.points[s.points.length - 1]?.value ?? 0;
          return (
            <div key={s.klass} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                  {labels[s.klass] ?? s.klass}
                </span>
                <span className="font-display tabular-nums">
                  <Money value={last} currency={currency} compact />
                </span>
              </div>
              <MiniSparkline
                values={s.points.map((p) => p.value)}
                color={colors[s.klass] ?? "var(--color-foreground)"}
                ariaLabel={`${s.klass} 12-month sparkline`}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AccountsTable({ rollup, currency }: { rollup: MonthlyRollup; currency: string }) {
  // Group by klass for editorial readability.
  const order = [
    AccountClass.Cash,
    AccountClass.Investments,
    AccountClass.Equity,
    AccountClass.Debt,
    AccountClass.Other,
  ] as const;
  // Hide zero-balance rows on the page — they're noise here. They still
  // appear in the Edit-month modal so users can fill them in.
  const visibleRows = rollup.rows.filter((r) => r.endingBalance !== 0 || r.isArchived);
  const groups = order
    .map((klass) => ({
      klass,
      rows: visibleRows.filter((r) => r.klass === klass),
    }))
    .filter((g) => g.rows.length > 0);

  // Section-wide decision so column widths stay aligned across groups: only
  // render Match if at least one visible row this month is eligible.
  const showMatchCol = visibleRows.some((r) => acceptsEmployerMatch(r.type, r.subtype));
  const cols = showMatchCol
    ? "grid-cols-[1.4fr_1fr_1fr_1fr_1.4fr]"
    : "grid-cols-[1.4fr_1fr_1fr_1.4fr]";

  return (
    <section className="flex flex-col gap-4">
      <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        Accounts · {formatMonth(rollup.month)}
      </h3>

      <div className="flex flex-col gap-6">
        {groups.map((g) => {
          return (
            <div key={g.klass} className="flex flex-col gap-1">
              <div
                className={`grid ${cols} gap-3 border-b border-[color:var(--color-border)] pb-1 text-xs text-[color:var(--color-ink-soft)]`}
              >
                <span>{g.klass}</span>
                <span className="text-right">Ending</span>
                <span className="text-right">Contribution</span>
                {showMatchCol ? <span className="text-right">Match</span> : null}
                <span className="text-right">Gain · flags</span>
              </div>
              {g.rows.map((r) => (
                <div
                  key={r.accountId}
                  className={`grid ${cols} gap-3 border-b border-dashed border-[color:var(--color-border)] py-2 text-sm`}
                >
                  <div className="flex flex-col">
                    <span className="font-display">{r.accountName}</span>
                    {r.isArchived && (
                      <span className="text-xs text-[color:var(--color-ink-soft)]">
                        Archived
                        {r.carriedFromMonth
                          ? ` · last recorded ${r.carriedFromMonth.slice(0, 7)}`
                          : ""}
                      </span>
                    )}
                    {r.subtype ? (
                      <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                        {r.subtype.replace(/_/g, " ")}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-right tabular-nums">
                    <Money value={r.endingBalance} currency={currency} fractionDigits={0} />
                  </span>
                  <span className="text-right tabular-nums">
                    {acceptsContribution(r.type) ? (
                      <Money
                        value={r.employeeContribution}
                        currency={currency}
                        fractionDigits={0}
                      />
                    ) : (
                      <span className="text-[color:var(--color-ink-soft)]">—</span>
                    )}
                  </span>
                  {showMatchCol ? (
                    <span className="text-right tabular-nums">
                      {acceptsEmployerMatch(r.type, r.subtype) ? (
                        <Money value={r.employerMatch} currency={currency} fractionDigits={0} />
                      ) : (
                        <span className="text-[color:var(--color-ink-soft)]">—</span>
                      )}
                    </span>
                  ) : null}
                  <div className="flex flex-col items-end gap-1 tabular-nums">
                    <span
                      className={
                        r.gain >= 0
                          ? "font-display text-[color:var(--color-freedom-financial,#065f46)]"
                          : "font-display text-[color:var(--color-accent-warning,#9a3412)]"
                      }
                    >
                      {r.gain >= 0 ? "+" : ""}
                      <Money value={r.gain} currency={currency} fractionDigits={0} />
                    </span>
                    {r.flags.length > 0 ? (
                      <span className="flex flex-wrap justify-end gap-1">
                        {r.flags.map((f, i) => (
                          <span
                            key={`${f.kind}:${i}`}
                            title={`expected ${f.expected.toFixed(2)} · actual ${f.actual.toFixed(
                              2,
                            )} · Δ ${f.delta.toFixed(2)}`}
                            className="font-sans text-xs tracking-normal text-[color:var(--color-accent-warning,#9a3412)]"
                          >
                            ⚠ {labelFlag(f.kind)}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MiniSparkline({
  values,
  color,
  width = 200,
  height = 36,
  pad = 2,
  ariaLabel,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  pad?: number;
  ariaLabel?: string;
}) {
  if (values.length < 2 || values.every((v) => v === 0)) {
    return (
      <div aria-label={ariaLabel} className="h-9 text-xs text-[color:var(--color-ink-soft)]">
        not enough data
      </div>
    );
  }
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = hi - lo || 1;
  const stepX = (width - pad * 2) / (values.length - 1);
  const toY = (v: number) => pad + (height - pad * 2) * (1 - (v - lo) / range);
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(pad + i * stepX).toFixed(1)} ${toY(v).toFixed(1)}`)
    .join(" ");
  const last = values[values.length - 1]!;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      aria-label={ariaLabel}
      className="overflow-visible"
    >
      <path d={path} fill="none" stroke={color} strokeWidth={1.25} strokeLinejoin="round" />
      <circle cx={pad + (values.length - 1) * stepX} cy={toY(last)} r={2} fill={color} />
    </svg>
  );
}

function labelFlag(kind: string): string {
  switch (kind) {
    case "balance_drift":
      return "balance";
    case "contribution_drift":
      return "contrib";
    case "paystub_match_drift":
      return "match";
    default:
      return kind;
  }
}

function EmptyState({ month }: { month: string }) {
  return (
    <section className="daybreak-panel flex flex-col gap-3 p-6">
      <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {formatMonth(month)}
      </span>
      <h3 className="font-display text-2xl tracking-tight">No statements yet for this month</h3>
      <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
        Use <span className="font-sans text-xs tracking-normal">Seed month</span> to carry every
        active account&apos;s last known balance forward, then{" "}
        <span className="font-sans text-xs tracking-normal">Edit month</span> to enter ending
        balances and contributions. Once two months exist, gain (= Δ balance − contributions)
        appears in the per-account ledger.
      </p>
      <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        Cutoff: {monthEnd(month)}
      </p>
    </section>
  );
}
