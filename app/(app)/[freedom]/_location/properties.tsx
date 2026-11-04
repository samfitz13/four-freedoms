import Link from "next/link";
import { listPlaces, listProperties, listRealEstateAccounts } from "@/lib/db/queries/location";
import { disposeProperty } from "./properties-actions";
import { PropertyForm } from "./property-form";

export async function LocationPropertiesTab({ householdId }: { householdId: string }) {
  const [rows, places, accounts] = await Promise.all([
    listProperties(householdId),
    listPlaces(householdId),
    listRealEstateAccounts(householdId),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <h2 className="font-display text-2xl tracking-tight">Properties</h2>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Owned real estate lives here, but valuation stays in Financial. Each row must be linked to
          a real-estate account.
        </p>
      </header>

      <section className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-border)] text-left font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              <th className="py-2 pr-4 font-normal">Place</th>
              <th className="py-2 pr-4 font-normal">Use</th>
              <th className="py-2 pr-4 font-normal">Ownership</th>
              <th className="py-2 pr-4 font-normal">Account</th>
              <th className="py-2 pr-4 text-right font-normal">Last valuation</th>
              <th className="py-2 pr-4 text-right font-normal">Equity</th>
              <th className="py-2 text-right font-normal">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)]">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="font-display py-3 pr-4 text-base">{row.placeName}</td>
                <td className="py-3 pr-4">{label(row.use)}</td>
                <td className="py-3 pr-4 font-sans text-xs tabular-nums">
                  {Number(row.ownershipPct).toFixed(0)}%
                </td>
                <td className="py-3 pr-4">
                  <Link
                    href={`/financial/statements?account=${row.accountId}`}
                    className="underline decoration-[color:var(--color-border)] underline-offset-4"
                  >
                    {row.accountName}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-right font-sans text-xs tabular-nums">
                  {money(row.lastValuation, row.currency)}
                </td>
                <td className="py-3 pr-4 text-right font-sans text-xs tabular-nums">
                  {money(row.equity, row.currency)}
                </td>
                <td className="py-3 text-right">
                  <form action={disposeProperty}>
                    <input type="hidden" name="id" value={row.id} />
                    <button className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]">
                      Dispose
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <aside className="mt-4 max-w-xl border-l border-[color:var(--color-border)] pl-4 text-sm text-[color:var(--color-ink-soft)]">
            You don&apos;t own property yet. When you do, every row here will link to a real-estate
            account in Financial. Until then, track a down-payment goal in{" "}
            <Link
              href="/financial/goals"
              className="underline decoration-[color:var(--color-border)] underline-offset-4 hover:text-[color:var(--color-foreground)]"
            >
              Financial → Goals
            </Link>
            .
          </aside>
        ) : null}
      </section>

      <section className="daybreak-panel flex flex-col gap-4 p-6">
        <h3 className="font-display text-xl">Add property</h3>
        <PropertyForm places={places} accounts={accounts} />
      </section>
    </div>
  );
}

function money(value: number | null, currency: string) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function label(value: string) {
  return value.replaceAll("_", " ");
}
