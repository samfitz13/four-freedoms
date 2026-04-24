import {
  budgetActuals,
  cashflowByMonth,
  listAccounts,
  listBudgetCategories,
  listRecentTransactions,
} from "@/lib/db/queries/financial";
import { Money } from "@/components/freedoms/money";
import { StackedBars } from "@/components/freedoms/financial/stacked-bars";
import { BudgetHeatmap } from "@/components/freedoms/financial/heatmap";
import { Sparkline } from "@/components/freedoms/sparkline";
import { AddCategoryForm, AddTransactionForm, SetPlanRow } from "./cashflow-forms";
import { archiveCategory, deleteTransaction } from "./cashflow-actions";

export async function FinancialCashflowTab({
  householdId,
  baseCurrency,
}: {
  householdId: string;
  baseCurrency: string;
}) {
  const monthStart = firstOfCurrentMonth();
  const [monthly, actuals, accounts, categories, transactions] = await Promise.all([
    cashflowByMonth(householdId, 12),
    budgetActuals(householdId, monthStart),
    listAccounts(householdId),
    listBudgetCategories(householdId),
    listRecentTransactions(householdId, 15),
  ]);

  const currentMonth = monthly[monthly.length - 1];
  const totalPlanned = actuals.reduce((s, a) => s + a.planned, 0);
  const totalActual = actuals.reduce((s, a) => s + a.actual, 0);

  // Sparkline for savings rate (0..100 to fit existing component).
  const savingsSeries = monthly.map((m) => ({
    date: m.month,
    score: Math.round(Math.max(0, Math.min(1, m.savingsRate)) * 100),
  }));

  const empty = transactions.length === 0 && accounts.length === 0 && categories.length === 0;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <h2 className="font-serif text-2xl tracking-tight">Cashflow</h2>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Monthly income vs. expenses, savings rate, and budget actuals for{" "}
          <span className="font-mono text-xs">{monthLabel(monthStart)}</span>.
        </p>
      </header>

      {empty ? <EmptyCashflow /> : null}

      <section className="grid gap-4 sm:grid-cols-4">
        <Stat
          label="Income · this mo"
          value={
            currentMonth ? (
              <Money value={currentMonth.income} currency={baseCurrency} compact />
            ) : (
              "—"
            )
          }
        />
        <Stat
          label="Expenses · this mo"
          value={
            currentMonth ? (
              <Money value={currentMonth.expense} currency={baseCurrency} compact />
            ) : (
              "—"
            )
          }
        />
        <Stat
          label="Net · this mo"
          value={
            currentMonth ? (
              <span
                className={
                  currentMonth.net >= 0 ? "" : "text-[color:var(--color-accent-warning,#9a3412)]"
                }
              >
                {currentMonth.net >= 0 ? "+" : ""}
                <Money value={currentMonth.net} currency={baseCurrency} compact />
              </span>
            ) : (
              "—"
            )
          }
        />
        <Stat
          label="Savings rate"
          value={
            currentMonth && currentMonth.income > 0
              ? `${Math.round(currentMonth.savingsRate * 100)}%`
              : "—"
          }
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl">Monthly flow · 12mo</h3>
          <Sparkline
            series={savingsSeries}
            color="var(--color-freedom-financial, #065f46)"
            width={180}
          />
        </div>
        <StackedBars
          data={monthly}
          ariaLabel="Monthly income vs. expenses for the last 12 months"
        />
        <Legend />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-serif text-xl">Budget · {monthLabel(monthStart)}</h3>
          <p className="font-mono text-[11px] text-[color:var(--color-ink-soft)] tabular-nums">
            <Money value={totalActual} currency={baseCurrency} compact /> /{" "}
            <Money value={totalPlanned} currency={baseCurrency} compact />
          </p>
        </div>
        <BudgetHeatmap rows={actuals} currency={baseCurrency} />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
          New transaction
        </h3>
        <AddTransactionForm
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
          Recent transactions
        </h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-soft)]">No transactions yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
            {transactions.map((t) => {
              const amt = Number(t.amount);
              const isIncome = amt > 0;
              return (
                <li key={t.id} className="flex items-center gap-4 py-2">
                  <span className="font-mono text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                    {t.occurredOn}
                  </span>
                  <span className="flex-1 text-sm">{t.description ?? "—"}</span>
                  <span
                    className={`tabular-nums ${
                      isIncome ? "" : "text-[color:var(--color-accent-warning,#9a3412)]"
                    }`}
                  >
                    {isIncome ? "+" : ""}
                    <Money value={amt} currency={t.currency} fractionDigits={2} />
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
                    {t.source}
                  </span>
                  <form action={deleteTransaction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      aria-label="Delete transaction"
                      className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase hover:text-[color:var(--color-accent-warning,#9a3412)]"
                    >
                      Delete
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <details className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-6">
        <summary className="cursor-pointer font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase select-none hover:text-[color:var(--color-foreground)]">
          Manage categories &amp; plans
        </summary>
        <div className="mt-4 flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <h4 className="font-serif text-lg">Categories</h4>
            <AddCategoryForm />
            {categories.length === 0 ? (
              <p className="text-sm text-[color:var(--color-ink-soft)]">
                No categories yet. Add your first one above (e.g. Rent, Groceries, Salary).
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
                {categories.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2">
                    <span className="text-sm">{c.name}</span>
                    <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
                      {c.kind}
                    </span>
                    <form action={archiveCategory} className="ml-auto">
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase hover:text-[color:var(--color-accent-warning,#9a3412)]"
                      >
                        Archive
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h4 className="font-serif text-lg">Plan · {monthLabel(monthStart)}</h4>
            {actuals.length === 0 ? (
              <p className="text-sm text-[color:var(--color-ink-soft)]">
                Add categories first, then set this month&rsquo;s plan.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
                {actuals.map((row) => (
                  <li key={row.categoryId}>
                    <SetPlanRow
                      month={monthStart}
                      categoryId={row.categoryId}
                      name={row.name}
                      kind={row.kind}
                      planned={row.planned}
                      currency={baseCurrency}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </details>
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

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-6 font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2 w-4 rounded-sm"
          style={{ background: "var(--color-freedom-financial, #065f46)", opacity: 0.85 }}
        />
        Income
      </span>
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2 w-4 rounded-sm"
          style={{ background: "var(--color-accent-warning, #9a3412)", opacity: 0.85 }}
        />
        Expense
      </span>
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-[2px] w-5"
          style={{ background: "var(--color-foreground)" }}
        />
        Net
      </span>
    </div>
  );
}

function EmptyCashflow() {
  return (
    <div className="flex flex-col gap-3 border border-dashed border-[color:var(--color-border)] p-6">
      <h3 className="font-serif text-xl">No cashflow yet.</h3>
      <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
        Add a couple of categories and a few transactions below to see your monthly flow, savings
        rate, and plan vs. actual come to life.
      </p>
    </div>
  );
}

function firstOfCurrentMonth(): string {
  const d = new Date();
  const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  return iso.slice(0, 10);
}

function monthLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(d);
}
