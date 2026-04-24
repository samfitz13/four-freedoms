import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-server";
import { listRecentEntries } from "@/lib/db/queries";
import { getPrimaryHouseholdId } from "@/lib/db/scope";
import { FREEDOMS, freedomMetas } from "@/lib/freedoms/constants";
import type { FreedomKey } from "@/lib/freedoms/types";
import { freedomModules } from "@/lib/freedoms";
import { computeSummary } from "@/lib/freedoms/summary";
import { getBaseCurrency } from "@/lib/freedoms/financial-settings";
import type { FinancialPayload } from "@/lib/freedoms/types";
import { Sparkline } from "@/components/freedoms/sparkline";
import { ScoreRing } from "@/components/freedoms/score-ring";
import { FinancialOverview } from "./_financial/overview";
import { FinancialAccountsTab } from "./_financial/accounts";
import { FinancialWealthTab } from "./_financial/wealth";
import { FinancialCashflowTab } from "./_financial/cashflow";
import { FinancialGoalsTab } from "./_financial/goals";
import { FINANCIAL_TABS } from "./_financial/constants";
import { FinancialTabNav, isFinancialTab } from "./_financial/nav";
import type { FinancialTab } from "./_financial/types";

export const dynamic = "force-dynamic";

const KEYS = FREEDOMS.map((f) => f.key);
function isFreedomKey(v: string): v is FreedomKey {
  return (KEYS as string[]).includes(v);
}

export function generateStaticParams() {
  return FREEDOMS.map((f) => ({ freedom: f.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ freedom: string }> }) {
  const { freedom } = await params;
  if (!isFreedomKey(freedom)) return {};
  return { title: freedomMetas[freedom].label };
}

export default async function FreedomDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ freedom: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { freedom } = await params;
  if (!isFreedomKey(freedom)) notFound();

  const user = await requireUser();
  const meta = freedomMetas[freedom];
  const mod = freedomModules[freedom];

  const rows = await listRecentEntries(user.id, { days: 30, freedom });
  const { summary, series } = computeSummary(
    freedom,
    rows.map((r) => ({ occurredOn: r.occurredOn, payload: r.payload ?? {} })),
  );

  if (freedom === "financial") {
    const { tab } = await searchParams;
    const active: FinancialTab = tab && isFinancialTab(tab) ? tab : "overview";
    const householdId = await getPrimaryHouseholdId(user.id);
    const baseCurrency = await getBaseCurrency(householdId);

    return (
      <section className="flex flex-col gap-8">
        <BackLink />
        <FinancialTabNav active={active} />

        {active === "overview" ? (
          <FinancialOverview
            meta={meta}
            summary={summary}
            series={series}
            entries={rows.map((r) => ({
              id: r.id,
              occurredOn: r.occurredOn,
              source: r.source,
              payload: (r.payload ?? {}) as FinancialPayload,
            }))}
            baseCurrency={baseCurrency}
          />
        ) : active === "wealth" ? (
          <FinancialWealthTab householdId={householdId} baseCurrency={baseCurrency} />
        ) : active === "cashflow" ? (
          <FinancialCashflowTab householdId={householdId} baseCurrency={baseCurrency} />
        ) : active === "goals" ? (
          <FinancialGoalsTab householdId={householdId} baseCurrency={baseCurrency} />
        ) : (
          <FinancialAccountsTab householdId={householdId} baseCurrency={baseCurrency} />
        )}

        {/* For discoverability during rollout. */}
        <nav
          aria-label="Financial sections"
          className="flex flex-wrap gap-3 border-t border-[color:var(--color-border)] pt-6 font-mono text-[11px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase"
        >
          {FINANCIAL_TABS.map((t) => (
            <Link
              key={t.key}
              href={`/financial?tab=${t.key}`}
              className="hover:text-[color:var(--color-foreground)]"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </section>
    );
  }

  // Non-financial freedoms keep the original single-view layout.
  return (
    <section className="flex flex-col gap-10">
      <BackLink />

      <header className="flex items-start justify-between gap-6 border-b border-[color:var(--color-border)] pb-10">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="h-[2px] w-8 rounded-full"
              style={{ background: meta.colorVar }}
            />
            <span className="font-mono text-xs tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
              {meta.label}
            </span>
          </div>
          <h1 className="max-w-xl font-serif text-4xl leading-[1.1] tracking-tight">
            {meta.question}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ScoreRing score={summary.score} color={meta.colorVar} size={64} stroke={4} />
          <span className="font-serif text-3xl tabular-nums">
            {summary.entriesThisWeek ? summary.score : "—"}
          </span>
        </div>
      </header>

      <div className="flex items-end justify-between">
        <dl className="grid grid-cols-3 gap-10 text-sm">
          <div>
            <dt className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
              Entries · 7d
            </dt>
            <dd className="font-serif text-2xl tabular-nums">{summary.entriesThisWeek}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
              Trend
            </dt>
            <dd className="font-serif text-2xl tabular-nums">
              {summary.entriesThisWeek ? (summary.trend > 0 ? "+" : "") + summary.trend : "—"}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
              Streak
            </dt>
            <dd className="font-serif text-2xl tabular-nums">{summary.streak}d</dd>
          </div>
        </dl>

        <Sparkline series={series} color={meta.colorVar} width={260} height={48} />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-xl">Timeline</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-soft)]">No entries yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
            {rows.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-6 py-3">
                <span className="font-mono text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                  {r.occurredOn}
                </span>
                <span className="flex-1 text-sm">{mod.formatEntry(r.payload ?? {})}</span>
                <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
                  {r.source}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard"
      className="font-mono text-xs tracking-tight text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
    >
      ← dashboard
    </Link>
  );
}
