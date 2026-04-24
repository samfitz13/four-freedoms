import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth-server";
import { scopeForUser } from "@/lib/db/scope";
import { db } from "@/lib/db/client";
import { csvImports } from "@/lib/db/schema";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import CSV" };

export default async function ImportPage({ params }: { params: Promise<{ freedom: string }> }) {
  const { freedom } = await params;
  // Scoped to financial for v1. Other freedoms don't have import flows yet.
  if (freedom !== "financial") notFound();

  const user = await requireUser();
  const scope = await scopeForUser(user.id);

  const recent = await db
    .select({
      id: csvImports.id,
      kind: csvImports.kind,
      filename: csvImports.filename,
      rowCount: csvImports.rowCount,
      status: csvImports.status,
      errorJson: csvImports.errorJson,
      createdAt: csvImports.createdAt,
    })
    .from(csvImports)
    .where(eq(csvImports.householdId, scope.primaryHouseholdId))
    .orderBy(desc(csvImports.createdAt))
    .limit(10);

  return (
    <section className="flex flex-col gap-10">
      <Link
        href="/financial?tab=accounts"
        className="font-mono text-xs tracking-tight text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
      >
        ← financial · accounts
      </Link>

      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
          Financial · Import
        </p>
        <h1 className="font-serif text-4xl tracking-tight">Bring your data in.</h1>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Upload CSV exports from your bank, broker, or other tools. Unknown accounts and categories
          are auto-created so you can keep iterating.
        </p>
      </header>

      <ImportForm />

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-xl">Supported formats</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <FormatCard
            title="Transactions"
            description="Generic bank/CSV export. Positive amounts = income, negative = expense."
            columns={["date", "description", "amount", "category?", "account?", "external_id?"]}
          />
          <FormatCard
            title="Accounts snapshot"
            description="Point-in-time balances. One row per account per day."
            columns={["account_name", "type", "balance", "as_of", "currency?", "institution?"]}
          />
          <FormatCard
            title="Holdings"
            description="Positions from a broker export. Upsert per (account, symbol)."
            columns={["account", "symbol", "quantity", "cost_basis?", "asset_class?", "as_of?"]}
          />
        </div>
      </section>

      {recent.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-serif text-xl">Recent imports</h2>
          <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
            {recent.map((r) => {
              const errorCount = countErrors(r.errorJson);
              return (
                <li key={r.id} className="flex items-baseline justify-between gap-6 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm">{r.filename}</span>
                    <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
                      {r.kind} · {r.createdAt.toISOString().slice(0, 10)}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-6 font-mono text-[11px] tracking-[0.14em] uppercase tabular-nums">
                    <span className="text-[color:var(--color-ink-soft)]">{r.rowCount} rows</span>
                    {errorCount > 0 ? (
                      <span className="text-[color:var(--color-accent-warning,#9a3412)]">
                        {errorCount} errors
                      </span>
                    ) : null}
                    <StatusBadge status={r.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function FormatCard({
  title,
  description,
  columns,
}: {
  title: string;
  description: string;
  columns: string[];
}) {
  return (
    <div className="flex flex-col gap-3 border border-[color:var(--color-border)] p-5">
      <h3 className="font-serif text-lg">{title}</h3>
      <p className="text-sm text-[color:var(--color-ink-soft)]">{description}</p>
      <ul className="flex flex-wrap gap-x-2 gap-y-1 font-mono text-[10px] tracking-[0.14em] uppercase">
        {columns.map((c) => (
          <li
            key={c}
            className="border border-[color:var(--color-border)] px-2 py-0.5 text-[color:var(--color-ink-soft)]"
          >
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "succeeded"
      ? "text-[color:var(--color-freedom-financial,#065f46)]"
      : status === "failed"
        ? "text-[color:var(--color-accent-warning,#9a3412)]"
        : "text-[color:var(--color-ink-soft)]";
  return <span className={color}>{status}</span>;
}

function countErrors(json: unknown): number {
  if (!json || typeof json !== "object") return 0;
  const errors = (json as { errors?: unknown }).errors;
  return Array.isArray(errors) ? errors.length : 0;
}
