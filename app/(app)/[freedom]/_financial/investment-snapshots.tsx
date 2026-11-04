import { Money } from "@/components/freedoms/money";
import { summarizeSnapshot } from "@/lib/financial/portfolio/atlas";
import type { InvestmentSnapshotView } from "@/lib/financial/portfolio/types";

export function InvestmentSnapshotPanel({ rows }: { rows: InvestmentSnapshotView[] }) {
  if (!rows.length) return null;
  const ordered = [...rows].sort(
    (a, b) =>
      b.data.funds.length - a.data.funds.length || a.accountName.localeCompare(b.accountName),
  );
  const summaries = ordered.map((row) => ({ row, totals: summarizeSnapshot(row.data) }));
  const comparable = new Set(rows.map((row) => `${row.sourceKey}:${row.currency}`)).size === 1;
  const total = summaries.reduce((sum, item) => sum + item.totals.totalCents, 0);
  const allocation = [
    {
      label: "Stocks",
      cents: summaries.reduce((sum, item) => sum + item.totals.stocksCents, 0),
      color: "var(--color-freedom-financial)",
    },
    {
      label: "Municipal bonds",
      cents: summaries.reduce((sum, item) => sum + item.totals.bondsCents, 0),
      color: "var(--color-freedom-location)",
    },
    {
      label: "Broker cash",
      cents: summaries.reduce((sum, item) => sum + item.totals.cashCents, 0),
      color: "var(--color-ink-soft)",
    },
  ];

  return (
    <section
      aria-labelledby="portfolio-snapshot-heading"
      className="daybreak-panel min-w-0 space-y-8 p-5 sm:p-8"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <h3 id="portfolio-snapshot-heading" className="font-display text-2xl">
            Portfolio snapshot
          </h3>
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            Holdings and cash attached to your existing accounts. These are not additional assets
            and do not replace statements or change net worth, savings, or performance calculations.
          </p>
        </div>
        {comparable ? (
          <div className="space-y-1">
            <p className="text-sm text-[color:var(--color-ink-soft)]">
              Estimated total · {rows.length} {rows.length === 1 ? "account" : "accounts"}
            </p>
            <p className="font-display text-3xl">
              <Money value={total / 100} currency={ordered[0]!.currency} fractionDigits={2} />
            </p>
          </div>
        ) : null}
      </header>

      {comparable ? (
        <div className="space-y-3">
          {total > 0 ? (
            <div aria-hidden="true" className="flex h-3 overflow-hidden rounded-full">
              {allocation.map((item) => (
                <div
                  key={item.label}
                  style={{ width: `${(item.cents / total) * 100}%`, backgroundColor: item.color }}
                />
              ))}
            </div>
          ) : null}
          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {allocation.map((item) => (
              <div key={item.label}>
                <dt className="text-[color:var(--color-ink-soft)]">{item.label}</dt>
                <dd className="tabular-nums">
                  {total > 0 ? `${((item.cents / total) * 100).toFixed(2)}% · ` : ""}
                  <Money
                    value={item.cents / 100}
                    currency={ordered[0]!.currency}
                    fractionDigits={2}
                  />
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            Snapshot accounts only, not your household asset allocation. Other accounts, including
            your separate money market, are excluded.
          </p>
        </div>
      ) : null}

      {summaries.map(({ row, totals }) => (
        <section
          key={row.id}
          id={`holdings-${row.accountId}`}
          aria-labelledby={`holdings-title-${row.id}`}
          className="daybreak-panel min-w-0 space-y-5 p-6"
        >
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h4 id={`holdings-title-${row.id}`} className="font-display text-xl">
                {row.accountName}
              </h4>
              <p className="text-sm text-[color:var(--color-ink-soft)]">
                Prepared {row.preparedOn} ·{" "}
                {totals.positions.length
                  ? "price timestamp unavailable"
                  : "balance date unverified"}
              </p>
            </div>
            <div>
              <p className="text-sm text-[color:var(--color-ink-soft)]">
                Estimated snapshot balance
              </p>
              <p className="font-display text-2xl">
                <Money value={totals.totalCents / 100} currency={row.currency} fractionDigits={2} />
              </p>
            </div>
          </header>

          {totals.positions.length ? (
            <>
              <div
                role="region"
                aria-label={`${row.accountName} ETF holdings, scroll horizontally for all columns`}
                tabIndex={0}
                className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                <table className="w-full text-sm whitespace-nowrap">
                  <caption className="pb-3 text-left text-[color:var(--color-ink-soft)]">
                    Screenshot holdings. Average costs are rounded, not verified tax basis.
                  </caption>
                  <thead className="border-b border-[color:var(--color-border)] text-[color:var(--color-ink-soft)]">
                    <tr>
                      <th scope="col" className="py-3 pr-5 text-left font-medium">
                        ETF
                      </th>
                      {["Shares", "Last price", "Average cost", "Value", "Approx. gain"].map(
                        (label) => (
                          <th key={label} scope="col" className="px-3 py-3 text-right font-medium">
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--color-border)]">
                    {totals.positions.map((fund) => (
                      <tr key={fund.symbol}>
                        <th scope="row" className="py-3 pr-5 text-left font-medium">
                          <span>{fund.symbol}</span>
                          <span className="block font-normal text-[color:var(--color-ink-soft)]">
                            {fund.short}
                          </span>
                        </th>
                        <td className="px-3 py-3 text-right tabular-nums">{fund.shares}</td>
                        <td className="px-3 py-3 text-right">
                          <Money value={fund.price} currency={row.currency} fractionDigits={2} />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Money value={fund.average} currency={row.currency} fractionDigits={2} />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Money
                            value={fund.valueCents / 100}
                            currency={row.currency}
                            fractionDigits={2}
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Money
                            value={fund.gainCents / 100}
                            currency={row.currency}
                            fractionDigits={2}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-[color:var(--color-border)] font-semibold">
                    <tr>
                      <th scope="row" colSpan={4} className="py-3 text-left">
                        ETF total
                      </th>
                      <td className="px-3 py-3 text-right">
                        <Money
                          value={totals.holdingsCents / 100}
                          currency={row.currency}
                          fractionDigits={2}
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Money
                          value={totals.gainCents / 100}
                          currency={row.currency}
                          fractionDigits={2}
                        />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-sm text-[color:var(--color-ink-soft)]">
                Approximate unrealized gain is value minus rounded average cost × shares. It
                excludes realized gains, dividends, fees, and tax. It is not total return.
              </p>
            </>
          ) : null}

          <div className="daybreak-inset space-y-1 p-4 text-sm">
            <p className="font-semibold">
              {row.data.cash.basis === "reconstructed"
                ? "Reconstructed broker cash"
                : "Approximate money-market balance"}
              : <Money value={totals.cashCents / 100} currency={row.currency} fractionDigits={2} />
              {row.data.cash.asOf ? ` · through ${row.data.cash.asOf}` : ""}
            </p>
            <p className="text-[color:var(--color-ink-soft)]">{row.data.cash.note}</p>
          </div>

          {totals.positions.length ? (
            <details className="border-t border-[color:var(--color-border)] pt-2">
              <summary className="min-h-11 cursor-pointer py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4">
                Fund research and sources
              </summary>
              <p className="py-3 text-sm text-[color:var(--color-ink-soft)]">
                Issuer facts use different dates from the screenshot. Lists below are partial, not a
                full holdings or overlap analysis. Fund expenses are embedded in fund returns; they
                exclude advisory fees and money-market expenses.
              </p>
              <div className="divide-y divide-[color:var(--color-border)]">
                {totals.positions.map((fund) => (
                  <details key={fund.symbol} className="py-2">
                    <summary className="min-h-11 cursor-pointer py-3 focus-visible:outline-2 focus-visible:outline-offset-4">
                      <strong>{fund.symbol}</strong> · {fund.name}
                    </summary>
                    <div className="space-y-4 pb-5 text-sm">
                      <p className="text-[color:var(--color-ink-soft)]">
                        {fund.index} · {fund.count.toLocaleString("en")} holdings ·{" "}
                        {fund.expense.toFixed(2)}% expense ratio · facts dated {fund.date}
                      </p>
                      <p>{fund.role}</p>
                      <p>
                        <strong>Potential upside:</strong> {fund.upside}
                      </p>
                      <p>
                        <strong>Risk:</strong> {fund.risk}
                      </p>
                      <p>{fund.note}</p>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                          <p className="mb-2 font-semibold">
                            {fund.symbol === "MUB" ? "Selected bond issuers" : "Selected companies"}{" "}
                            · {fund.holdingsDate ?? fund.date}
                          </p>
                          <dl className="space-y-1">
                            {fund.holdings.map(([name, weight]) => (
                              <div key={name} className="flex justify-between gap-4">
                                <dt>{name}</dt>
                                <dd className="tabular-nums">{weight.toFixed(2)}%</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                        {fund.countries ? (
                          <div>
                            <p className="mb-2 font-semibold">Selected countries · {fund.date}</p>
                            <dl className="space-y-1">
                              {fund.countries.map(([name, weight]) => (
                                <div key={name} className="flex justify-between gap-4">
                                  <dt>{name}</dt>
                                  <dd className="tabular-nums">{weight.toFixed(2)}%</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        ) : null}
                      </div>
                      <p className="text-[color:var(--color-ink-soft)]">
                        Weights are percentages of this fund, not your portfolio.
                      </p>
                      <ul className="space-y-2">
                        {row.data.sources
                          .filter(
                            (source) =>
                              source.id === fund.source || source.id === fund.holdingsSource,
                          )
                          .map((source) => (
                            <li key={source.id}>
                              <a
                                className="underline underline-offset-4"
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {source.title}
                              </a>
                              <span className="text-[color:var(--color-ink-soft)]">
                                {" "}
                                · {source.date}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      ))}
    </section>
  );
}
