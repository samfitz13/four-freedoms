import Link from "next/link";
import { listPaystubsForYear } from "@/lib/db/queries/statements";
import { toNumber } from "@/lib/db/queries/financial";
import { listIsoOptionCompensationForYear } from "@/lib/db/queries/iso-options";
import { PaystubKind } from "@/lib/freedoms/enums";
import { totalPaystubTaxes } from "@/lib/freedoms/paystub-math";
import { Money } from "@/components/freedoms/money";
import { IncomeGrid } from "./income-grid";
import type { MonthlyIncomeSummary, PaystubRow } from "./types";
import type { IsoOptionYearCompensation } from "@/lib/db/queries/types";

export async function FinancialIncomeTab({
  householdId,
  baseCurrency,
  selectedYear,
}: {
  householdId: string;
  baseCurrency: string;
  selectedYear?: string;
}) {
  const currentYear = new Date().getUTCFullYear();
  const year = selectedYear && /^\d{4}$/.test(selectedYear) ? Number(selectedYear) : currentYear;
  const [paystubs, isoCompensation] = await Promise.all([
    listPaystubsForYear(householdId, year),
    listIsoOptionCompensationForYear(householdId, year),
  ]);
  const rows = paystubs.map(toPaystubRow);
  const monthly = buildMonthly(rows);
  const totals = totalRows(rows);

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-col gap-6 border-b border-[color:var(--color-border)] pb-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-col gap-2">
            <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              Income · {year}
            </p>
            <h2 className="font-display text-2xl tracking-tight">Paystub ledger</h2>
            <p className="max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
              A spreadsheet-style record of each pay date, tax line, benefit, contribution, and net
              deposit. Statements read this ledger first when calculating monthly income.
            </p>
          </div>
          <YearPicker year={year} />
        </div>

        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Gross pay">
            <Money value={totals.gross} currency={baseCurrency} fractionDigits={0} />
          </Stat>
          <Stat label="Employer match">
            <Money value={totals.employerMatch} currency={baseCurrency} fractionDigits={0} />
          </Stat>
          <Stat label="Total comp">
            <Money
              value={totals.gross + totals.employerMatch}
              currency={baseCurrency}
              fractionDigits={0}
            />
          </Stat>
          <Stat label="Net">
            <Money value={totals.net} currency={baseCurrency} fractionDigits={0} />
          </Stat>
          <Stat label="Effective tax">
            {totals.gross > 0 ? `${((totals.taxes / totals.gross) * 100).toFixed(1)}%` : "—"}
          </Stat>
        </section>

        {monthly.length > 0 ? <SparklineStrip monthly={monthly} currency={baseCurrency} /> : null}
      </header>

      <IncomeGrid key={year} rows={rows} year={year} currency={baseCurrency} monthly={monthly} />
      {isoCompensation.accounts.length > 0 ? (
        <IsoCompensationSection iso={isoCompensation} currency={baseCurrency} />
      ) : null}
    </div>
  );
}

function YearPicker({ year }: { year: number }) {
  return (
    <nav className="flex items-center gap-3 font-sans text-xs tracking-normal">
      <Link
        href={`/financial/income?year=${year - 1}`}
        replace
        scroll={false}
        className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
      >
        ← {year - 1}
      </Link>
      <span className="font-display text-xl tracking-tight">{year}</span>
      <Link
        href={`/financial/income?year=${year + 1}`}
        replace
        scroll={false}
        className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
      >
        {year + 1} →
      </Link>
    </nav>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-l border-[color:var(--color-border)] pl-4">
      <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {label}
      </span>
      <span className="font-display text-3xl tracking-tight tabular-nums">{children}</span>
    </div>
  );
}

function SparklineStrip({
  monthly,
  currency,
}: {
  monthly: MonthlyIncomeSummary[];
  currency: string;
}) {
  return (
    <section className="grid gap-6 sm:grid-cols-3">
      <TinySeries
        label="Gross monthly"
        values={monthly.map((m) => m.gross)}
        end={<Money value={monthly[monthly.length - 1]?.gross ?? 0} currency={currency} compact />}
      />
      <TinySeries
        label="Net monthly"
        values={monthly.map((m) => m.net)}
        end={<Money value={monthly[monthly.length - 1]?.net ?? 0} currency={currency} compact />}
      />
      <TinySeries
        label="Effective tax"
        values={monthly.map((m) => (m.gross > 0 ? (m.taxes / m.gross) * 100 : 0))}
        end={`${(monthly[monthly.length - 1]?.effectiveTax ?? 0).toFixed(1)}%`}
      />
    </section>
  );
}

function TinySeries({
  label,
  values,
  end,
}: {
  label: string;
  values: number[];
  end: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-[color:var(--color-border)] pb-3">
      <div className="flex flex-col gap-1">
        <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          {label}
        </span>
        <span className="font-display text-xl tabular-nums">{end}</span>
      </div>
      <MiniSparkline values={values} />
    </div>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2 || values.every((v) => v === 0)) {
    return <span className="font-sans text-xs text-[color:var(--color-ink-soft)]">—</span>;
  }
  const width = 120;
  const height = 28;
  const pad = 2;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = hi - lo || 1;
  const stepX = (width - pad * 2) / Math.max(1, values.length - 1);
  const toY = (v: number) => pad + (height - pad * 2) * (1 - (v - lo) / range);
  const d = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(pad + i * stepX).toFixed(1)} ${toY(v).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="var(--color-freedom-financial, #065f46)"
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IsoCompensationSection({
  iso,
  currency,
}: {
  iso: IsoOptionYearCompensation;
  currency: string;
}) {
  return (
    <section className="daybreak-panel flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          ISO Compensation · {iso.year}
        </p>
        <h3 className="font-display text-2xl tracking-tight">
          Vesting, exercises, and option value
        </h3>
        <p className="max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
          Non-cash compensation from ISO vesting. It is shown apart from paystub gross and net
          income.
        </p>
      </div>

      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="ISO Compensation">
          <Money value={iso.compensation} currency={currency} fractionDigits={0} />
        </Stat>
        <Stat label="Vested shares">{iso.vestedShares.toLocaleString()}</Stat>
        <Stat label="Owned vested">{iso.ownedVestedShares.toLocaleString()}</Stat>
        <Stat label="Exercisable">{iso.exercisableShares.toLocaleString()}</Stat>
        <Stat label={iso.forfeitedShares > 0 ? "Forfeited" : "Unvested"}>
          {(iso.forfeitedShares > 0 ? iso.forfeitedShares : iso.unvestedShares).toLocaleString()}
        </Stat>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        <TinySeries
          label="Monthly ISO comp"
          values={iso.monthly.map((m) => m.compensation)}
          end={<Money value={iso.monthly.at(-1)?.compensation ?? 0} currency={currency} compact />}
        />
        <TinySeries
          label="Vested shares"
          values={iso.monthly.map((m) => m.vestedShares)}
          end={iso.vestedShares.toLocaleString()}
        />
        <TinySeries
          label="Owned vested"
          values={iso.monthly.map((m) => m.ownedVestedShares)}
          end={iso.ownedVestedShares.toLocaleString()}
        />
      </section>

      <div className="flex flex-col divide-y divide-[color:var(--color-border)] border-y border-[color:var(--color-border)]">
        {iso.accounts.flatMap((account) =>
          account.grants.map((grant) => (
            <div
              key={grant.id}
              className="grid gap-3 py-3 text-sm md:grid-cols-[1.2fr_repeat(7,1fr)]"
            >
              <div className="flex flex-col">
                <span className="font-display">{grant.label}</span>
                <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                  {account.employerName ?? account.accountName}
                </span>
              </div>
              <IsoLedgerCell label="Vested" value={grant.vestedShares.toLocaleString()} />
              <IsoLedgerCell
                label="Owned vested"
                value={grant.ownedVestedShares.toLocaleString()}
              />
              <IsoLedgerCell label="Exercisable" value={grant.exercisableShares.toLocaleString()} />
              <IsoLedgerCell
                label={grant.forfeitedShares > 0 ? "Forfeited" : "Unvested"}
                value={(grant.forfeitedShares > 0
                  ? grant.forfeitedShares
                  : grant.unvestedShares
                ).toLocaleString()}
              />
              <IsoLedgerCell
                label="Owned unvested"
                value={grant.ownedUnvestedShares.toLocaleString()}
              />
              <IsoLedgerCell
                label="Owned value"
                value={
                  <Money value={grant.exercisedShareValue} currency={currency} fractionDigits={0} />
                }
              />
              <IsoLedgerCell
                label="Exercise cost"
                value={<Money value={grant.exerciseCost} currency={currency} fractionDigits={0} />}
              />
              <IsoLedgerCell
                label="Option spread"
                value={
                  <Money
                    value={grant.optionIntrinsicValue}
                    currency={currency}
                    fractionDigits={0}
                  />
                }
              />
            </div>
          )),
        )}
      </div>
    </section>
  );
}

function IsoLedgerCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 md:items-end">
      <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {label}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function toPaystubRow(p: Awaited<ReturnType<typeof listPaystubsForYear>>[number]): PaystubRow {
  return {
    id: p.id,
    payDate: p.payDate as unknown as string,
    kind: p.kind as PaystubKind,
    employer: p.employer,
    gross: toNumber(p.gross),
    federalIncomeTax: toNumber(p.federalIncomeTax),
    socialSecurity: toNumber(p.socialSecurity),
    medicare: toNumber(p.medicare),
    additionalMedicare: toNumber(p.additionalMedicare),
    benefits: toNumber(p.benefits),
    otherIncome: toNumber(p.otherIncome),
    net: toNumber(p.net),
    employee401k: toNumber(p.employee401k),
    employeeRoth401k: toNumber(p.employeeRoth401k),
    employerMatch: toNumber(p.employerMatch),
    hsa: toNumber(p.hsa),
    otherPretax: toNumber(p.otherPretax),
    otherPosttax: toNumber(p.otherPosttax),
    stateTaxes: p.stateTaxes,
    netOverridden: p.netOverridden,
    notes: p.notes,
  };
}

function buildMonthly(rows: PaystubRow[]): MonthlyIncomeSummary[] {
  const byMonth = new Map<string, MonthlyIncomeSummary>();
  for (const row of rows) {
    const month = row.payDate.slice(0, 7) + "-01";
    const current = byMonth.get(month) ?? {
      month,
      count: 0,
      gross: 0,
      net: 0,
      taxes: 0,
      effectiveTax: 0,
    };
    current.count += 1;
    current.gross += row.gross;
    current.net += row.net;
    current.taxes += totalRowTaxes(row);
    current.effectiveTax = current.gross > 0 ? (current.taxes / current.gross) * 100 : 0;
    byMonth.set(month, current);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function totalRows(rows: PaystubRow[]) {
  return rows.reduce(
    (sum, row) => ({
      gross: sum.gross + row.gross,
      net: sum.net + row.net,
      taxes: sum.taxes + totalRowTaxes(row),
      employerMatch: sum.employerMatch + row.employerMatch,
    }),
    { gross: 0, net: 0, taxes: 0, employerMatch: 0 },
  );
}

function totalRowTaxes(row: PaystubRow): number {
  return totalPaystubTaxes(row);
}
