import Link from "next/link";
import {
  assetAllocation,
  latestBalances,
  listAccounts,
  netWorthSeries,
} from "@/lib/db/queries/financial";
import { Money } from "@/components/freedoms/money";
import { AreaChart } from "@/components/freedoms/financial/area-chart";
import { Donut } from "@/components/freedoms/financial/donut";

/**
 * Editorial palette for account-type buckets. Uses CSS variables when
 * available (with fallbacks) so it stays on-theme.
 */
const BUCKET_COLORS: Record<string, string> = {
  checking: "var(--color-freedom-financial, #065f46)",
  savings: "var(--color-freedom-location, #3730a3)",
  brokerage: "var(--color-freedom-time, #7c2d12)",
  retirement: "var(--color-freedom-health, #155e75)",
  crypto: "var(--color-accent, #7e22ce)",
  real_estate: "var(--color-accent-warm, #92400e)",
  loan: "var(--color-accent-warning, #9a3412)",
  credit_card: "var(--color-accent-warning, #9a3412)",
  other: "var(--color-ink-soft, #6b7280)",
};

export async function FinancialWealthTab({
  householdId,
  baseCurrency,
}: {
  householdId: string;
  baseCurrency: string;
}) {
  const [accounts, balances, series, allocation] = await Promise.all([
    listAccounts(householdId),
    latestBalances(householdId),
    netWorthSeries(householdId, 12),
    assetAllocation(householdId),
  ]);

  const currentNetWorth = series.length ? series[series.length - 1]!.netWorth : null;
  const startNetWorth = series.length ? series[0]!.netWorth : null;
  const delta =
    currentNetWorth !== null && startNetWorth !== null ? currentNetWorth - startNetWorth : null;

  const positive = allocation.filter((a) => a.value > 0);
  const liabilities = allocation.filter((a) => a.value < 0);
  const slices = positive.map((a) => ({
    label: a.bucket,
    value: a.value,
    color: BUCKET_COLORS[a.bucket] ?? BUCKET_COLORS.other!,
  }));

  const empty = accounts.length === 0;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <h2 className="font-serif text-2xl tracking-tight">Wealth</h2>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Net worth over time, account balances, and allocation across types.
        </p>
      </header>

      {empty ? (
        <EmptyWealth />
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-6">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
                  Net worth
                </span>
                <span className="font-serif text-4xl tabular-nums">
                  <Money value={currentNetWorth} currency={baseCurrency} fractionDigits={0} />
                </span>
              </div>
              {delta !== null ? (
                <div className="flex flex-col items-end">
                  <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
                    Last 12mo
                  </span>
                  <span
                    className={`font-serif text-2xl tabular-nums ${
                      delta >= 0 ? "" : "text-[color:var(--color-accent-warning,#9a3412)]"
                    }`}
                  >
                    {delta >= 0 ? "+" : ""}
                    <Money value={delta} currency={baseCurrency} fractionDigits={0} compact />
                  </span>
                </div>
              ) : null}
            </div>

            <AreaChart
              series={series.map((s) => ({ date: s.date, value: s.netWorth }))}
              color="var(--color-freedom-financial, #065f46)"
              ariaLabel="Net worth over last 12 months"
              height={200}
            />
          </section>

          <section className="grid gap-10 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <h3 className="font-serif text-xl">Allocation</h3>
              <Donut slices={slices} ariaLabel="Asset allocation by account type" />
              {liabilities.length ? (
                <ul className="mt-2 flex flex-col gap-1 border-t border-[color:var(--color-border)] pt-3 text-sm">
                  {liabilities.map((l) => (
                    <li
                      key={l.bucket}
                      className="flex items-center justify-between font-mono text-[11px] tracking-[0.14em] uppercase"
                    >
                      <span className="text-[color:var(--color-ink-soft)]">
                        {l.bucket.replace(/_/g, " ")} · debt
                      </span>
                      <span className="text-[color:var(--color-accent-warning,#9a3412)] tabular-nums">
                        <Money value={l.value} currency={baseCurrency} fractionDigits={0} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="font-serif text-xl">Balances</h3>
              <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
                {balances.map((b) => (
                  <li key={b.accountId} className="flex items-baseline justify-between gap-4 py-2">
                    <div className="flex flex-col">
                      <span className="text-sm">{b.accountName}</span>
                      <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
                        {b.type.replace(/_/g, " ")} · {b.currency}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="tabular-nums">
                        <Money value={b.balance} currency={b.currency} fractionDigits={0} />
                      </span>
                      <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase tabular-nums">
                        {b.asOf ?? "—"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function EmptyWealth() {
  return (
    <div className="flex flex-col gap-4 border border-dashed border-[color:var(--color-border)] p-10">
      <h3 className="font-serif text-xl">No accounts yet.</h3>
      <p className="max-w-lg text-sm text-[color:var(--color-ink-soft)]">
        Add your first account and record a balance to see net worth over time and asset allocation
        here.
      </p>
      <div>
        <Link
          href="/financial?tab=accounts"
          className="inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-[color:var(--color-foreground)] px-4 text-sm text-[color:var(--color-background)] hover:opacity-90"
        >
          Add an account
        </Link>
      </div>
    </div>
  );
}
