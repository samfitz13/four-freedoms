import Link from "next/link";
import { latestBalances, listAccounts } from "@/lib/db/queries/financial";
import { Money } from "@/components/freedoms/money";
import { EditAccountForm, NewAccountForm, RecordBalanceForm } from "./account-form";

export async function FinancialAccountsTab({
  householdId,
  baseCurrency,
}: {
  householdId: string;
  baseCurrency: string;
}) {
  const [accounts, balances] = await Promise.all([
    listAccounts(householdId),
    latestBalances(householdId),
  ]);
  const latestByAccount = new Map(balances.map((b) => [b.accountId, b] as const));

  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-start justify-between gap-6 border-b border-[color:var(--color-border)] pb-6">
        <div className="flex flex-col gap-2">
          <h2 className="font-serif text-2xl tracking-tight">Accounts</h2>
          <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
            Manual accounts you maintain by hand. Each balance snapshot is point-in-time; the Wealth
            tab forward-fills between snapshots.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Link
            href="/financial/import"
            className="inline-flex h-9 items-center rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 font-mono text-[11px] tracking-[0.14em] uppercase hover:bg-[color:var(--color-surface-muted,transparent)]"
          >
            Import CSV
          </Link>
          <button
            type="button"
            disabled
            className="inline-flex h-9 items-center rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-border)] px-3 font-mono text-[11px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase"
            aria-disabled
          >
            Connect bank · soon
          </button>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h3 className="font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
          New account
        </h3>
        <NewAccountForm defaultCurrency={baseCurrency} />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
          Your accounts
        </h3>
        {accounts.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            No accounts yet. Add one above to start tracking balances.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
            {accounts.map((a) => {
              const latest = latestByAccount.get(a.id);
              return (
                <li key={a.id} className="flex flex-col gap-4 py-6">
                  <div className="flex items-baseline justify-between gap-6">
                    <div className="flex flex-col">
                      <span className="font-serif text-lg tracking-tight">{a.name}</span>
                      <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
                        {a.type.replace(/_/g, " ")}
                        {a.institution ? ` · ${a.institution}` : ""} · {a.currency}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-serif text-2xl tabular-nums">
                        <Money
                          value={latest?.balance ?? null}
                          currency={a.currency}
                          fractionDigits={2}
                        />
                      </span>
                      <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase tabular-nums">
                        {latest?.asOf ? `as of ${latest.asOf}` : "no snapshot yet"}
                      </span>
                    </div>
                  </div>

                  <details className="flex flex-col gap-3 pt-2">
                    <summary className="cursor-pointer font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase select-none hover:text-[color:var(--color-foreground)]">
                      Edit · record balance
                    </summary>
                    <div className="mt-4 flex flex-col gap-6 border-l border-dashed border-[color:var(--color-border)] pl-4">
                      <EditAccountForm account={a} />
                      <RecordBalanceForm accountId={a.id} />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
