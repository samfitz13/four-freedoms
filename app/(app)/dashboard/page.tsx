import Link from "next/link";
import { requireUser } from "@/lib/auth-server";
import { listEntriesForDashboard, listRecentEntries, countEntries } from "@/lib/db/queries";
import { FREEDOMS, freedomMetas, type FreedomKey } from "@/lib/freedoms/types";
import { freedomModules } from "@/lib/freedoms";
import { computeSummary } from "@/lib/freedoms/summary";
import { FreedomCard } from "@/components/freedoms/freedom-card";

export const metadata = { title: "Dashboard" };
// Dashboard is highly dynamic (per-user); opt out of static generation.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const [rows, total, recent] = await Promise.all([
    listEntriesForDashboard(user.id),
    countEntries(user.id),
    listRecentEntries(user.id, { days: 7 }),
  ]);

  // Bucket rows by freedom.
  const byFreedom = new Map<
    FreedomKey,
    { occurredOn: string; payload: Record<string, unknown> }[]
  >();
  for (const f of FREEDOMS) byFreedom.set(f.key, []);
  for (const r of rows) {
    byFreedom.get(r.freedom)?.push({
      occurredOn: r.occurredOn,
      payload: r.payload ?? {},
    });
  }

  const summaries = FREEDOMS.map((meta) => {
    const entries = byFreedom.get(meta.key) ?? [];
    const { summary, series } = computeSummary(meta.key, entries);
    return { meta, summary, series };
  });

  return (
    <section className="flex flex-col gap-10">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
            This week
          </p>
          <h1 className="font-serif text-4xl tracking-tight">Your four freedoms.</h1>
        </div>
        <Link
          href="/check-in"
          className="inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-[color:var(--color-foreground)] px-4 text-sm text-[color:var(--color-background)] hover:opacity-90"
        >
          Today&rsquo;s check-in
        </Link>
      </div>

      {total === 0 ? (
        <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-paper-soft)] px-5 py-6 text-sm">
          <p className="font-serif text-lg">No entries yet.</p>
          <p className="mt-2 text-[color:var(--color-ink-soft)]">
            Start with today&rsquo;s check-in — or seed sample data from{" "}
            <Link
              href="/settings"
              className="underline underline-offset-2 hover:text-[color:var(--color-foreground)]"
            >
              settings
            </Link>
            .
          </p>
        </div>
      ) : null}

      <ul className="grid gap-0 sm:grid-cols-2">
        {summaries.map(({ meta, summary, series }, i) => (
          <li
            key={meta.key}
            className={[
              i % 2 === 0 ? "sm:pr-10" : "sm:pl-10",
              i > 0 ? "border-t border-[color:var(--color-border)]" : "",
              i === 1 ? "sm:border-t-0" : "",
              i === 2 ? "sm:border-t" : "",
            ].join(" ")}
          >
            <FreedomCard meta={meta} summary={summary} series={series} />
          </li>
        ))}
      </ul>

      {recent.length ? (
        <div className="flex flex-col gap-4 border-t border-[color:var(--color-border)] pt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-xl tracking-tight">Recent</h2>
            <Link
              href="/review"
              className="font-mono text-xs tracking-tight text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
            >
              Weekly review →
            </Link>
          </div>
          <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
            {recent.slice(0, 8).map((r) => {
              const meta = freedomMetas[r.freedom];
              const mod = freedomModules[r.freedom];
              return (
                <li key={r.id} className="flex items-baseline justify-between gap-4 py-3">
                  <span className="font-mono text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                    {r.occurredOn}
                  </span>
                  <Link
                    href={`/${meta.key}`}
                    className="flex flex-1 items-center gap-3 text-sm hover:opacity-80"
                  >
                    <span
                      aria-hidden
                      className="h-[2px] w-4 rounded-full"
                      style={{ background: meta.colorVar }}
                    />
                    <span className="w-20 font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
                      {meta.label}
                    </span>
                    <span className="flex-1">{mod.formatEntry(r.payload ?? {})}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
