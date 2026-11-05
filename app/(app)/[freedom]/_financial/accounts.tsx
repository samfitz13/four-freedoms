import Link from "next/link";
import { latestBalances, listAccounts } from "@/lib/db/queries/financial";
import { listIsoOptionSummaries } from "@/lib/db/queries/iso-options";
import { listInvestmentSnapshots } from "@/lib/db/queries/investment-snapshots";
import { Money } from "@/components/freedoms/money";
import { titleCaseSubtype } from "@/lib/freedoms/account-subtypes";
import { AccountEditLauncher } from "./account-edit-launcher";
import { IsoOptionsLauncher } from "./iso-options-panel";
import { NewAccountLauncher } from "./new-account-launcher";
import { InvestmentSnapshotPanel } from "./investment-snapshots";

const MONTH_FMT = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
function formatMonth(month: string | null): string {
  if (!month) return "no statements yet";
  return `as of ${MONTH_FMT.format(new Date(month + "T00:00:00Z"))}`;
}

export async function FinancialAccountsTab({
  householdId,
  baseCurrency,
}: {
  householdId: string;
  baseCurrency: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [accounts, balances, isoSummaries, snapshots] = await Promise.all([
    listAccounts(householdId),
    latestBalances(householdId),
    listIsoOptionSummaries(householdId, today),
    listInvestmentSnapshots(householdId),
  ]);
  const latestByAccount = new Map(balances.map((b) => [b.accountId, b] as const));
  const isoByAccount = new Map(
    isoSummaries.map((summary) => [summary.accountId, summary] as const),
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-wrap items-start justify-between gap-6 border-b border-[color:var(--color-border)] pb-6">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-2xl tracking-tight">Accounts</h2>
          <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
            Configure the accounts you track. Balances and contributions are entered each month from
            the Statements tab.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
          <NewAccountLauncher defaultCurrency={baseCurrency} />
          <Link
            href="/financial/import"
            className="daybreak-button inline-flex min-h-11 items-center border border-[color:var(--color-border)] px-3 font-sans text-xs tracking-normal hover:bg-[color:var(--color-surface-muted,transparent)]"
          >
            Import CSV
          </Link>
        </div>
      </header>

      <InvestmentSnapshotPanel rows={snapshots} />

      <section className="flex flex-col gap-4">
        <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
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
              const isoSummary = isoByAccount.get(a.id);
              const isIsoAccount =
                a.type === "iso_options" || (a.type === "equity_comp" && a.subtype === "iso");
              return (
                <li key={a.id} className="flex flex-col gap-4 py-6">
                  <div className="flex items-baseline justify-between gap-6">
                    <div className="flex flex-col">
                      <span className="font-display text-lg tracking-tight">{a.name}</span>
                      <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                        {a.type.replace(/_/g, " ")}
                        {a.subtype ? ` · ${titleCaseSubtype(a.subtype)}` : ""}
                        {a.institution ? ` · ${a.institution}` : ""} · {a.currency}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="font-display text-2xl tabular-nums">
                        <Money
                          value={
                            isIsoAccount
                              ? (isoSummary?.totalValue ?? latest?.balance ?? null)
                              : (latest?.balance ?? null)
                          }
                          currency={a.currency}
                          fractionDigits={2}
                        />
                      </span>
                      <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
                        {formatMonth(latest?.asOf ?? null)}
                      </span>
                      <span className="flex items-center gap-3">
                        {isIsoAccount ? (
                          <IsoOptionsLauncher
                            accountName={a.name}
                            accountId={a.id}
                            currency={a.currency}
                            summary={isoSummary}
                          />
                        ) : null}
                        <AccountEditLauncher account={a} />
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
