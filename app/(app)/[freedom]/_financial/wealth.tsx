import Link from "next/link";
import {
  assetAllocation,
  latestBalances,
  listAccounts,
  netWorthBreakdownSeries,
  wealthCategorySeries,
} from "@/lib/db/queries/financial";
import { Money } from "@/components/freedoms/money";
import { Donut } from "@/components/freedoms/financial/donut";
import { StackedAreaChart } from "@/components/freedoms/financial/stacked-area-chart";
import type { StackedAreaLayer } from "@/components/freedoms/financial/types";
import { yearToDateChange } from "@/lib/freedoms/wealth";

/**
 * Dedicated categorical tokens distinguish account types in both themes.
 */
const BUCKET_COLORS: Record<string, string> = {
  checking: "var(--color-allocation-checking)",
  savings: "var(--color-allocation-savings)",
  brokerage: "var(--color-allocation-brokerage)",
  retirement: "var(--color-allocation-retirement)",
  crypto: "var(--color-allocation-crypto)",
  real_estate: "var(--color-allocation-real-estate)",
  loan: "var(--color-accent-warning)",
  credit_card: "var(--color-accent-warning)",
  equity_comp: "var(--color-allocation-equity)",
  iso_options: "var(--color-allocation-options)",
  other: "var(--color-allocation-other)",
};
const STACKED_CATEGORY_ORDER = [
  "checking",
  "savings",
  "brokerage",
  "retirement",
  "crypto",
  "real_estate",
  "other",
  "equity_comp",
] as const;
const EQUITY_COMP_COLORS = [
  "var(--color-allocation-equity)",
  "var(--color-allocation-options)",
  "var(--color-allocation-crypto)",
  "var(--color-allocation-savings)",
] as const;
type StackedCategory = (typeof STACKED_CATEGORY_ORDER)[number];
const STACKED_CATEGORY_LABELS: Record<StackedCategory, string> = {
  checking: "Checking",
  savings: "Savings",
  brokerage: "Brokerage",
  retirement: "Retirement",
  crypto: "Crypto",
  real_estate: "Real estate",
  other: "Other",
  equity_comp: "Equity comp",
};

export async function FinancialWealthTab({
  householdId,
  baseCurrency,
}: {
  householdId: string;
  baseCurrency: string;
}) {
  const [accounts, balances, series, categorySeries, allocation] = await Promise.all([
    listAccounts(householdId, { includeArchived: true }),
    latestBalances(householdId),
    netWorthBreakdownSeries(householdId, 12, { fromEarliest: true }),
    wealthCategorySeries(householdId, 12, { fromEarliest: true }),
    assetAllocation(householdId),
  ]);

  const currentNetWorth = series.length ? series[series.length - 1]!.netWorth : null;
  const delta = yearToDateChange(series);

  const positive = allocation.filter((a) => a.value > 0);
  const liabilities = allocation.filter((a) => a.value < 0);
  const slices = positive.map((a) => ({
    label: a.bucket,
    value: a.value,
    color: BUCKET_COLORS[a.bucket] ?? BUCKET_COLORS.other!,
  }));
  const visibleBalances = balances.filter((b) => b.balance !== 0 && !b.isArchived);
  const equityAccounts = accounts.filter(
    (account) => account.type === "equity_comp" || account.type === "iso_options",
  );
  const stableLayers: StackedAreaLayer[] = STACKED_CATEGORY_ORDER.filter(
    (category) => category !== "equity_comp",
  ).map((category) => ({
    key: category,
    label: STACKED_CATEGORY_LABELS[category],
    color: BUCKET_COLORS[category] ?? BUCKET_COLORS.other!,
    outline: "solid" as const,
    points: categorySeries.map((point) => ({
      date: point.date,
      value: point.categories[category] ?? 0,
    })),
  }));
  const equityLayers: StackedAreaLayer[] = equityAccounts.map((account, index) => ({
    key: account.id,
    label: account.name,
    color: EQUITY_COMP_COLORS[index % EQUITY_COMP_COLORS.length]!,
    outline: "dotted" as const,
    points: categorySeries.map((point) => ({
      date: point.date,
      value: point.accounts[account.id] ?? 0,
    })),
  }));
  const stackedLayers = [...stableLayers, ...equityLayers].filter((layer) =>
    layer.points.some((point) => point.value > 0),
  );

  const empty = accounts.length === 0;

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <h2 className="font-display text-2xl tracking-tight">Wealth</h2>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Net worth at month-end, allocation across types, and the latest balance per account.
        </p>
      </header>

      {empty ? (
        <EmptyWealth label="account" />
      ) : series.length === 0 ? (
        <EmptyWealth label="statement" />
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-6">
              <div className="flex flex-col">
                <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                  Net worth
                </span>
                <span className="font-display text-4xl tabular-nums">
                  <Money value={currentNetWorth} currency={baseCurrency} fractionDigits={0} />
                </span>
              </div>
              <div className="flex flex-col items-end" aria-label="Year-to-date net worth change">
                <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                  Year to date
                </span>
                <span
                  className={`font-display text-2xl tabular-nums ${
                    delta === null || delta >= 0 ? "" : "text-[color:var(--color-accent-warning)]"
                  }`}
                >
                  {delta !== null && delta >= 0 ? "+" : ""}
                  <Money value={delta} currency={baseCurrency} fractionDigits={0} compact />
                </span>
              </div>
            </div>

            <StackedAreaChart layers={stackedLayers} ariaLabel="Assets by category over time" />
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[color:var(--color-border)] pt-3 font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              {stackedLayers.map((layer) => (
                <LegendItem
                  key={layer.key}
                  color={layer.color}
                  label={layer.label}
                  dashed={layer.outline === "dotted"}
                />
              ))}
            </div>
          </section>

          <section className="grid gap-10 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <h3 className="font-display text-xl">Allocation</h3>
              <Donut slices={slices} ariaLabel="Asset allocation by account type" />
              {liabilities.length ? (
                <ul className="mt-2 flex flex-col gap-1 border-t border-[color:var(--color-border)] pt-3 text-sm">
                  {liabilities.map((l) => (
                    <li
                      key={l.bucket}
                      className="flex items-center justify-between font-sans text-xs tracking-normal"
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
              <h3 className="font-display text-xl">Balances</h3>
              {visibleBalances.length > 0 ? (
                <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
                  {visibleBalances.map((b) => (
                    <li
                      key={b.accountId}
                      className="flex items-baseline justify-between gap-4 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm">{b.accountName}</span>
                        <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                          {b.type.replace(/_/g, " ")} · {b.currency}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="tabular-nums">
                          <Money value={b.balance} currency={b.currency} fractionDigits={0} />
                        </span>
                        <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
                          {b.asOf
                            ? new Date(b.asOf + "T00:00:00Z").toLocaleDateString(undefined, {
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[color:var(--color-ink-soft)]">
                  No non-zero balances recorded yet.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function LegendItem({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-px w-7"
        style={{
          backgroundImage: dashed
            ? `repeating-linear-gradient(to right, ${color} 0 4px, transparent 4px 8px)`
            : undefined,
          backgroundColor: dashed ? undefined : color,
        }}
      />
      {label}
    </span>
  );
}

function EmptyWealth({ label }: { label: "account" | "statement" }) {
  const heading = label === "account" ? "No accounts yet." : "No statements yet.";
  const body =
    label === "account"
      ? "Add your first account, then record a month-end statement to see net worth over time and asset allocation here."
      : "Once you save a month from the Statements tab, the running net worth and allocation will appear here.";
  const href = label === "account" ? "/financial/accounts" : "/financial/statements";
  const cta = label === "account" ? "Add an account" : "Open Statements";
  return (
    <div className="daybreak-panel flex flex-col gap-4 border-dashed p-10">
      <h3 className="font-display text-xl">{heading}</h3>
      <p className="max-w-lg text-sm text-[color:var(--color-ink-soft)]">{body}</p>
      <div>
        <Link
          href={href}
          className="daybreak-button inline-flex min-h-11 items-center bg-[color:var(--glass-primary)] px-4 text-sm text-[color:var(--glass-primary-ink)] hover:opacity-90"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
