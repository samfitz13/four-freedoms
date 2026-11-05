import Link from "next/link";
import type { ReactNode } from "react";
import { Money } from "@/components/freedoms/money";
import {
  FinancialAttentionVerdict,
  FinancialFiVerdict,
  FinancialHealthVerdict,
} from "@/lib/freedoms/enums";
import type {
  FinancialOverviewBalanceRow,
  FinancialOverviewData,
  FreedomMeta,
} from "@/lib/freedoms/types";

export function FinancialOverview({
  meta,
  baseCurrency,
  data,
}: {
  meta: FreedomMeta;
  baseCurrency: string;
  data: FinancialOverviewData;
}) {
  const hasBalanceSheet =
    data.balanceSheet.assets.length + data.balanceSheet.liabilities.length > 0;
  const hasAttention =
    data.verdict.attention !== FinancialAttentionVerdict.Clear && data.attention.length > 0;

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head grid gap-8 border-b border-[color:var(--color-border)] pb-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="h-[2px] w-8 rounded-full"
              style={{ background: meta.colorVar }}
            />
            <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              {meta.label} board report
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
              {data.month ? monthLabel(data.month) : "Awaiting first statement"}
            </p>
            <h1 className="font-display max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-5xl">
              {data.verdict.sentence}
            </h1>
          </div>
        </div>
        <VerdictPanel data={data} />
      </header>

      {data.kpis.netWorth === null && !hasBalanceSheet ? (
        <EmptyOverview />
      ) : (
        <>
          <KpiStrip data={data} currency={baseCurrency} />

          <section
            className={`grid gap-10 ${hasAttention ? "xl:grid-cols-[minmax(0,1fr)_24rem]" : ""}`}
          >
            {hasAttention && <AttentionList items={data.attention} />}
            <BoardNotes data={data} currency={baseCurrency} />
          </section>

          <section className="grid gap-10 xl:grid-cols-2">
            <BalanceSheetBlock data={data} currency={baseCurrency} />
            <MovementBridgeBlock data={data} currency={baseCurrency} />
            <IncomeQualityBlock data={data} currency={baseCurrency} />
            <FiTrackBlock data={data} currency={baseCurrency} />
          </section>
        </>
      )}
    </div>
  );
}

function VerdictPanel({ data }: { data: FinancialOverviewData }) {
  return (
    <dl className="daybreak-inset grid grid-cols-1 divide-y divide-[color:var(--color-border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0 xl:grid-cols-1 xl:divide-x-0 xl:divide-y">
      <VerdictItem
        label="Health"
        value={healthLabel(data.verdict.health)}
        tone={toneHealth(data.verdict.health)}
      />
      <VerdictItem
        label="FI track"
        value={fiLabel(data.verdict.fi)}
        tone={toneFi(data.verdict.fi)}
      />
      <VerdictItem
        label="Attention"
        value={attentionLabel(data.verdict.attention)}
        tone={toneAttention(data.verdict.attention)}
      />
    </dl>
  );
}

function VerdictItem({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <dt className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="font-display flex items-center gap-2 text-lg tracking-tight">
        <span aria-hidden className={`h-2 w-2 rounded-full ${tone}`} />
        {value}
      </dd>
    </div>
  );
}

function KpiStrip({ data, currency }: { data: FinancialOverviewData; currency: string }) {
  return (
    <dl
      aria-label="Financial summary"
      className="daybreak-inset daybreak-kpis grid gap-x-6 gap-y-7 p-6"
    >
      <Kpi
        label="Net worth"
        sub={
          data.kpis.netWorthDelta !== null ? (
            <Delta value={data.kpis.netWorthDelta} currency={currency} compact />
          ) : (
            "—"
          )
        }
      >
        <Money value={data.kpis.netWorth} currency={currency} fractionDigits={0} />
      </Kpi>
      <Kpi
        label="Saved this month"
        sub={formatPct(data.kpis.savingsRate, 0) ?? "Add income and expenses"}
      >
        <Money value={data.kpis.savedThisMonth} currency={currency} fractionDigits={0} compact />
      </Kpi>
      <Kpi label="Gain / loss" sub="Market and balance movement">
        <Delta value={data.kpis.gainLoss ?? 0} currency={currency} compact />
      </Kpi>
      <Kpi
        label="FI progress"
        sub={
          data.fiTrack.gap !== null ? (
            <>
              Gap <Money value={data.fiTrack.gap} currency={currency} fractionDigits={0} compact />
            </>
          ) : (
            "Set FI goals"
          )
        }
      >
        {formatPct(data.kpis.fiProgress, 1) ?? "—"}
      </Kpi>
      <Kpi label="Runway" sub={<RunwayBasis runway={data.runway} currency={currency} />}>
        {data.kpis.runwayMonths !== null ? `${data.kpis.runwayMonths.toFixed(1)}mo` : "—"}
      </Kpi>
    </dl>
  );
}

function RunwayBasis({
  runway,
  currency,
}: {
  runway: FinancialOverviewData["runway"];
  currency: string;
}) {
  if (runway.monthlyBurn === null) return "Needs expense history";
  return (
    <>
      <Money value={runway.availableCash} currency={currency} fractionDigits={0} compact />{" "}
      available ÷{" "}
      <Money value={runway.monthlyBurn} currency={currency} fractionDigits={0} compact /> burn ·{" "}
      {runwayLabel(runway.basis, runway.windowMonths)}
    </>
  );
}

function AttentionList({ items }: { items: FinancialOverviewData["attention"] }) {
  if (items.length === 0) return null;
  return (
    <section className="daybreak-panel flex flex-col gap-4 p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl tracking-tight">Needs attention</h2>
        <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </div>
      <ol className="flex flex-col divide-y divide-[color:var(--color-border)]">
        {items.map((item, index) => (
          <li key={`${item.title}:${item.href}`} className="py-4 first:pt-0 last:pb-0">
            <Link href={item.href} className="group grid gap-3 sm:grid-cols-[2.5rem_minmax(0,1fr)]">
              <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-display text-xl tracking-tight group-hover:underline">
                  {item.title}
                </span>
                <span className="text-sm leading-6 text-[color:var(--color-ink-soft)]">
                  {item.detail}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function BoardNotes({ data, currency }: { data: FinancialOverviewData; currency: string }) {
  const movement = data.movementBridge;
  return (
    <aside className="flex flex-col gap-4 border-t border-[color:var(--color-border)] pt-5">
      <h2 className="font-display text-2xl tracking-tight">Board notes</h2>
      <div className="flex flex-col divide-y divide-[color:var(--color-border)] text-sm leading-6">
        <p className="py-3 first:pt-0">
          Net worth{" "}
          {movement.end !== null && movement.start !== null
            ? "closed at"
            : "is not fully measured yet"}{" "}
          {movement.end !== null ? (
            <Money value={movement.end} currency={currency} fractionDigits={0} />
          ) : null}
          {movement.end !== null && movement.start !== null
            ? ", after contributions, match, and balance movement."
            : "."}
        </p>
        <p className="py-3">
          Income quality uses {data.incomeQuality.paystubRows} paystub row
          {data.incomeQuality.paystubRows === 1 ? "" : "s"}; payroll-to-cashflow drift is{" "}
          {data.incomeQuality.drift !== null ? (
            <Delta value={data.incomeQuality.drift} currency={currency} compact />
          ) : (
            "not measured yet"
          )}
          .
        </p>
        <p className="py-3 last:pb-0">
          FI requires{" "}
          {data.fiTrack.fiNumber !== null ? (
            <Money value={data.fiTrack.fiNumber} currency={currency} fractionDigits={0} compact />
          ) : (
            "goal assumptions"
          )}{" "}
          {data.fiTrack.monthsToFi !== null
            ? `and is roughly ${(data.fiTrack.monthsToFi / 12).toFixed(1)} years away at the current plan.`
            : data.fiTrack.projection?.plan
              ? "but is not reached by plan end."
              : "before timing can be estimated."}
        </p>
      </div>
    </aside>
  );
}

function BalanceSheetBlock({ data, currency }: { data: FinancialOverviewData; currency: string }) {
  const totalAssets = data.balanceSheet.assets.reduce((sum, row) => sum + row.value, 0);
  const totalDebt = Math.abs(
    data.balanceSheet.liabilities.reduce((sum, row) => sum + row.value, 0),
  );
  return (
    <Panel title="Balance sheet" href="/financial/wealth">
      <CompositionBar rows={data.balanceSheet.assets} />
      <div className="grid gap-6 md:grid-cols-2">
        <BalanceRows title="Assets" rows={data.balanceSheet.assets} currency={currency} />
        <BalanceRows title="Liabilities" rows={data.balanceSheet.liabilities} currency={currency} />
      </div>
      <dl className="grid grid-cols-3 gap-4 border-t border-[color:var(--color-border)] pt-4">
        <MiniStat label="Assets">
          <Money value={totalAssets} currency={currency} fractionDigits={0} compact />
        </MiniStat>
        <MiniStat label="Debt">
          <Money value={totalDebt} currency={currency} fractionDigits={0} compact />
        </MiniStat>
        <MiniStat label="Net">
          <Money
            value={data.balanceSheet.netWorth}
            currency={currency}
            fractionDigits={0}
            compact
          />
        </MiniStat>
      </dl>
    </Panel>
  );
}

function MovementBridgeBlock({
  data,
  currency,
}: {
  data: FinancialOverviewData;
  currency: string;
}) {
  const movement = data.movementBridge;
  const rows = [
    { label: "Starting net worth", value: movement.start, delta: false },
    { label: "Saved", value: movement.saved, delta: true },
    { label: "Employer match", value: movement.employerMatch, delta: true },
    { label: "Gain / loss", value: movement.gainLoss, delta: true },
    { label: "Debt movement", value: movement.debtDrag, delta: true },
    { label: "Ending net worth", value: movement.end, delta: false },
  ];
  return (
    <Panel title="Monthly movement" href="/financial/statements">
      <ol className="flex flex-col divide-y divide-[color:var(--color-border)]">
        {rows.map((row) => (
          <li key={row.label} className="flex items-baseline gap-4 py-3 first:pt-0 last:pb-0">
            <span className="text-sm text-[color:var(--color-ink-soft)]">{row.label}</span>
            <span className="font-display ml-auto text-xl tabular-nums">
              {row.value === null ? (
                "—"
              ) : row.delta ? (
                <Delta value={row.value} currency={currency} compact />
              ) : (
                <Money value={row.value} currency={currency} fractionDigits={0} compact />
              )}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function IncomeQualityBlock({ data, currency }: { data: FinancialOverviewData; currency: string }) {
  return (
    <Panel title="Cashflow and income quality" href="/financial/income">
      <div className="grid gap-4 sm:grid-cols-2">
        <MiniStat label="Paystub net">
          <Money
            value={data.incomeQuality.paystubNet}
            currency={currency}
            fractionDigits={0}
            compact
          />
        </MiniStat>
        <MiniStat label="Cashflow income">
          <Money
            value={data.incomeQuality.cashflowIncome}
            currency={currency}
            fractionDigits={0}
            compact
          />
        </MiniStat>
        <MiniStat label="Expenses">
          <Money
            value={data.incomeQuality.expenses}
            currency={currency}
            fractionDigits={0}
            compact
          />
        </MiniStat>
        <MiniStat label="Saved">
          <Money value={data.incomeQuality.saved} currency={currency} fractionDigits={0} compact />
        </MiniStat>
      </div>
      <div className="flex items-end justify-between gap-4 border-t border-[color:var(--color-border)] pt-4">
        <MiniStat label="Savings rate">
          {formatPct(data.incomeQuality.savingsRate, 0) ?? "—"}
        </MiniStat>
        <SavingsSparkline points={data.incomeQuality.savingsSeries} />
      </div>
    </Panel>
  );
}

function FiTrackBlock({ data, currency }: { data: FinancialOverviewData; currency: string }) {
  return (
    <Panel title="FI track" href="/financial/goals">
      <ProgressRail value={data.fiTrack.progress} />
      <div className="grid gap-4 sm:grid-cols-2">
        <MiniStat label="Invested">
          <Money value={data.fiTrack.invested} currency={currency} fractionDigits={0} compact />
        </MiniStat>
        <MiniStat label="FI number">
          <Money value={data.fiTrack.fiNumber} currency={currency} fractionDigits={0} compact />
        </MiniStat>
        <MiniStat label="Monthly contribution">
          <Money
            value={data.fiTrack.monthlyContribution}
            currency={currency}
            fractionDigits={0}
            compact
          />
        </MiniStat>
        <MiniStat label="Years to FI">
          {data.fiTrack.monthsToFi !== null ? (data.fiTrack.monthsToFi / 12).toFixed(1) : "—"}
        </MiniStat>
      </div>
      {data.fiTrack.projection?.errors.length ? (
        <p className="fi-chart-note">
          {data.fiTrack.projection.errors[0]} Review the FI plan in Goals.
        </p>
      ) : null}
      {data.fiTrack.projection?.settings && (
        <p className="fi-chart-note">
          {data.fiTrack.projection.settings.returnMode === "manual"
            ? "Manual return mode"
            : "Portfolio planning assumptions"}
          {" · "}
          {data.fiTrack.projection.settings.retirementMonth
            ? "Retirement cash flows included"
            : "Accumulation plan, complete retirement settings in Goals"}
        </p>
      )}
    </Panel>
  );
}

function Kpi({ label, sub, children }: { label: string; sub: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <dt className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="flex flex-col gap-2">
        <span className="font-display text-[1.75rem] leading-none tracking-tight tabular-nums">
          {children}
        </span>
        <span className="min-h-5 text-xs text-[color:var(--color-ink-soft)] tabular-nums">
          {sub}
        </span>
      </dd>
    </div>
  );
}

function Panel({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  return (
    <section className="daybreak-panel flex flex-col gap-5 p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl tracking-tight">{title}</h2>
        <Link
          href={href}
          className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
        >
          Open →
        </Link>
      </div>
      {children}
    </section>
  );
}

function MiniStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="font-display text-xl tracking-tight tabular-nums">{children}</dd>
    </div>
  );
}

function BalanceRows({
  title,
  rows,
  currency,
}: {
  title: string;
  rows: FinancialOverviewBalanceRow[];
  currency: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-[color:var(--color-ink-soft)]">None recorded.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
          {rows.map((row) => (
            <li key={`${row.klass}:${row.label}`} className="flex items-baseline gap-4 py-2">
              <span className="text-sm">{row.label}</span>
              <span className="font-display ml-auto text-base tabular-nums">
                <Money value={Math.abs(row.value)} currency={currency} fractionDigits={0} compact />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CompositionBar({ rows }: { rows: FinancialOverviewBalanceRow[] }) {
  const visible = rows.filter((row) => row.share !== null && row.share > 0);
  if (visible.length === 0) return null;
  return (
    <div className="flex h-2 overflow-hidden bg-[color:var(--color-border)]" aria-hidden>
      {visible.map((row) => (
        <span
          key={`${row.klass}:${row.label}`}
          className="h-full border-r border-[color:var(--color-background)] last:border-r-0"
          style={{
            width: `${Math.max(2, (row.share ?? 0) * 100)}%`,
            background: barColor(row.klass),
          }}
        />
      ))}
    </div>
  );
}

function SavingsSparkline({
  points,
}: {
  points: Array<{ month: string; savingsRate: number | null }>;
}) {
  const values = points
    .map((p) => p.savingsRate)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  if (values.length < 2) {
    return (
      <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        No trend
      </span>
    );
  }
  const width = 140;
  const height = 34;
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const step = width / Math.max(1, points.length - 1);
  const path = points
    .map((point, index) => {
      if (point.savingsRate === null) return null;
      const x = index * step;
      const y = height - ((point.savingsRate - min) / Math.max(0.01, max - min)) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .filter((value): value is string => value !== null)
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Savings rate trend"
      className="overflow-visible"
    >
      <path
        d={path}
        fill="none"
        stroke="var(--color-freedom-financial)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProgressRail({ value }: { value: number | null }) {
  const pct = Math.min(100, Math.max(0, (value ?? 0) * 100));
  return (
    <div className="flex flex-col gap-2">
      <div className="h-1.5 bg-[color:var(--color-border)]">
        <div
          className="h-full bg-[color:var(--color-freedom-financial)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
        {value !== null
          ? `${(value * 100).toFixed(1)}% funded`
          : "Set FI assumptions to compute progress"}
      </p>
    </div>
  );
}

function Delta({
  value,
  currency,
  compact = false,
}: {
  value: number;
  currency: string;
  compact?: boolean;
}) {
  return (
    <span className={value < 0 ? "text-[color:var(--color-freedom-time)]" : ""}>
      {value > 0 ? "+" : ""}
      <Money value={value} currency={currency} fractionDigits={0} compact={compact} />
    </span>
  );
}

function EmptyOverview() {
  return (
    <section className="daybreak-panel flex flex-col gap-4 border-dashed p-10">
      <h2 className="font-display text-2xl tracking-tight">No board report yet.</h2>
      <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
        Add accounts and save a month-end statement. The overview will then answer health, FI track,
        and attention items in one place.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/financial/accounts"
          className="daybreak-button inline-flex min-h-11 items-center bg-[color:var(--glass-primary)] px-4 text-sm text-[color:var(--glass-primary-ink)] hover:opacity-90"
        >
          Add accounts
        </Link>
        <Link
          href="/financial/statements"
          className="daybreak-button inline-flex min-h-11 items-center border border-[color:var(--color-border)] px-4 text-sm hover:bg-[color:var(--color-paper-soft)]"
        >
          Open statements
        </Link>
      </div>
    </section>
  );
}

function formatPct(value: number | null, digits: number): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return `${(value * 100).toFixed(digits)}%`;
}

function runwayLabel(
  basis: FinancialOverviewData["runway"]["basis"],
  windowMonths: number,
): string {
  if (basis === "insufficient_data") return "insufficient data";
  return `last ${windowMonths} closed mo`;
}

function monthLabel(month: string): string {
  const d = new Date(`${month}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return month;
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(d);
}

function healthLabel(value: FinancialHealthVerdict): string {
  switch (value) {
    case FinancialHealthVerdict.Healthier:
      return "Healthier";
    case FinancialHealthVerdict.Flat:
      return "Flat";
    case FinancialHealthVerdict.Weaker:
      return "Weaker";
    default:
      return "Unknown";
  }
}

function fiLabel(value: FinancialFiVerdict): string {
  switch (value) {
    case FinancialFiVerdict.OnTrack:
      return "On track";
    case FinancialFiVerdict.Underfunded:
      return "Underfunded";
    default:
      return "Needs setup";
  }
}

function attentionLabel(value: FinancialAttentionVerdict): string {
  switch (value) {
    case FinancialAttentionVerdict.Clear:
      return "Clear";
    case FinancialAttentionVerdict.MissingData:
      return "Missing data";
    default:
      return "Review";
  }
}

function toneHealth(value: FinancialHealthVerdict): string {
  if (value === FinancialHealthVerdict.Healthier)
    return "bg-[color:var(--color-freedom-financial)]";
  if (value === FinancialHealthVerdict.Weaker) return "bg-[color:var(--color-freedom-time)]";
  return "bg-[color:var(--color-border)]";
}

function toneFi(value: FinancialFiVerdict): string {
  if (value === FinancialFiVerdict.OnTrack) return "bg-[color:var(--color-freedom-financial)]";
  if (value === FinancialFiVerdict.Underfunded) return "bg-[color:var(--color-freedom-time)]";
  return "bg-[color:var(--color-border)]";
}

function toneAttention(value: FinancialAttentionVerdict): string {
  if (value === FinancialAttentionVerdict.Clear) return "bg-[color:var(--color-freedom-financial)]";
  if (value === FinancialAttentionVerdict.Review) return "bg-[color:var(--color-freedom-time)]";
  return "bg-[color:var(--color-border)]";
}

function barColor(klass: string): string {
  if (klass === "cash") return "var(--color-ink-soft)";
  if (klass === "investments") return "var(--color-freedom-financial)";
  if (klass === "equity") return "var(--color-ink)";
  return "var(--color-border)";
}
