import {
  budgetActuals,
  cashflowByMonth,
  listAccounts,
  listBudgetCategories,
  listLedger,
  peerAccountsForTransfers,
} from "@/lib/db/queries/financial";
import { Money } from "@/components/freedoms/money";
import { StackedBars } from "@/components/freedoms/financial/stacked-bars";
import { BudgetHeatmap } from "@/components/freedoms/financial/heatmap";
import { Sparkline } from "@/components/freedoms/sparkline";
import { AddCategoryForm, SetPlanRow } from "./cashflow-forms";
import { AddTransactionLauncher } from "./add-transaction-launcher";
import { LedgerView } from "./ledger";
import { archiveCategory } from "./cashflow-actions";
import type { PeerInfo } from "./types";

export async function FinancialCashflowTab({
  householdId,
  baseCurrency,
}: {
  householdId: string;
  baseCurrency: string;
}) {
  const monthStart = firstOfCurrentMonth();
  const [monthly, actuals, accounts, categories, ledgerPage] = await Promise.all([
    cashflowByMonth(householdId, 12, { fromEarliest: true }),
    budgetActuals(householdId, monthStart),
    listAccounts(householdId, { includeArchived: true }),
    listBudgetCategories(householdId),
    listLedger(householdId, {}, null, 50),
  ]);

  const transferGroupIds = Array.from(
    new Set(
      ledgerPage.rows
        .filter((t) => t.kind === "transfer" && t.transferGroupId)
        .map((t) => t.transferGroupId as string),
    ),
  );
  const peerMap = await peerAccountsForTransfers(householdId, transferGroupIds);

  const initialPeers: Record<string, PeerInfo> = {};
  for (const r of ledgerPage.rows) {
    if (r.kind !== "transfer" || !r.transferGroupId) continue;
    const group = peerMap.get(r.transferGroupId);
    if (!group) continue;
    const peer = group.find((g) => g.id !== r.id);
    if (peer) {
      initialPeers[r.id] = { accountId: peer.accountId, accountName: peer.accountName };
    }
  }
  const transactions = ledgerPage.rows;

  const currentMonth = monthly[monthly.length - 1];
  const totalPlanned = actuals.reduce((s, a) => s + a.planned, 0);
  const totalActual = actuals.reduce((s, a) => s + a.actual, 0);

  // Sparkline for savings rate (0..100 to fit existing component).
  const savingsSeries = monthly.map((m) => ({
    date: m.month,
    score: Math.round(Math.max(0, Math.min(1, m.savingsRate)) * 100),
  }));

  const empty = transactions.length === 0 && accounts.length === 0 && categories.length === 0;
  const hasFlow = monthly.some((m) => m.income > 0 || m.expense > 0);
  const hasCategories = categories.length > 0;
  const hasTransactions = transactions.length > 0;

  const cashflowStats: Array<{ label: string; value: React.ReactNode }> = [];
  if (currentMonth && currentMonth.income > 0) {
    cashflowStats.push({
      label: "Income · this mo",
      value: <Money value={currentMonth.income} currency={baseCurrency} compact />,
    });
  }
  if (currentMonth && currentMonth.expense > 0) {
    cashflowStats.push({
      label: "Expenses · this mo",
      value: <Money value={currentMonth.expense} currency={baseCurrency} compact />,
    });
  }
  if (currentMonth && (currentMonth.income > 0 || currentMonth.expense > 0)) {
    cashflowStats.push({
      label: "Net · this mo",
      value:
        currentMonth.net === 0 ? (
          <Money value={0} currency={baseCurrency} compact />
        ) : currentMonth.net > 0 ? (
          <>
            +<Money value={currentMonth.net} currency={baseCurrency} compact />
          </>
        ) : (
          <span className="text-[color:var(--color-accent-warning,#9a3412)]">
            <Money value={currentMonth.net} currency={baseCurrency} compact />
          </span>
        ),
    });
  }
  if (currentMonth && currentMonth.income > 0) {
    cashflowStats.push({
      label: "Savings rate",
      value: `${Math.round(currentMonth.savingsRate * 100)}%`,
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <h2 className="font-display text-2xl tracking-tight">Cashflow</h2>
        {empty ? (
          <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
            Add a transaction below. Monthly flow, budget, and savings rate fill in as you go.
          </p>
        ) : null}
      </header>

      {cashflowStats.length ? (
        <section className="flex flex-wrap gap-x-10 gap-y-8">
          {cashflowStats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} />
          ))}
        </section>
      ) : null}

      {hasFlow ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl">Monthly flow · 12mo</h3>
            <Sparkline
              series={savingsSeries}
              color="var(--color-freedom-financial, #065f46)"
              width={180}
              interactive
              valueSuffix="% saved"
            />
          </div>
          <StackedBars
            data={monthly}
            ariaLabel="Monthly income vs. expenses for the last 12 months"
          />
          <Legend />
        </section>
      ) : null}

      {hasCategories ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-display text-xl">Budget · {monthLabel(monthStart)}</h3>
            <p className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
              <Money value={totalActual} currency={baseCurrency} compact /> /{" "}
              <Money value={totalPlanned} currency={baseCurrency} compact />
            </p>
          </div>
          <BudgetHeatmap rows={actuals} currency={baseCurrency} />
        </section>
      ) : null}

      {hasTransactions ? (
        <section className="flex flex-col gap-3">
          <header className="flex items-baseline justify-between gap-6">
            <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              Transactions
            </h3>
            <AddTransactionLauncher
              accounts={accounts
                .filter((a) => !a.isArchived)
                .map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
              categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
            />
          </header>
          <LedgerView
            initial={{
              rows: ledgerPage.rows,
              nextCursor: ledgerPage.nextCursor,
              peers: initialPeers,
            }}
            accounts={accounts.map((a) => ({
              id: a.id,
              name: a.name,
              currency: a.currency,
              isArchived: a.isArchived,
            }))}
            categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
          />
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <header className="flex items-baseline justify-between gap-6">
            <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              Transactions
            </h3>
            <AddTransactionLauncher
              accounts={accounts
                .filter((a) => !a.isArchived)
                .map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
              categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
            />
          </header>
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            No transactions yet. Add one to get started, or import a CSV from Accounts.
          </p>
        </section>
      )}

      <details className="daybreak-panel flex flex-col gap-3 p-6">
        <summary className="cursor-pointer font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] select-none hover:text-[color:var(--color-foreground)]">
          Manage categories &amp; plans
        </summary>
        <div className="mt-4 flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <h4 className="font-display text-lg">Categories</h4>
            <AddCategoryForm />
            {categories.length > 0 ? (
              <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
                {categories.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2">
                    <span className="text-sm">{c.name}</span>
                    <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                      {c.kind}
                    </span>
                    <form action={archiveCategory} className="ml-auto">
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-accent-warning,#9a3412)]"
                      >
                        Archive
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {actuals.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h4 className="font-display text-lg">Plan · {monthLabel(monthStart)}</h4>
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
            </section>
          ) : null}
        </div>
      </details>
    </div>
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

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-6 font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
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
