import { requireUser } from "@/lib/auth-server";
import { scopeForUser } from "@/lib/db/scope";
import { getBaseCurrency, SUPPORTED_CURRENCIES } from "@/lib/freedoms/financial-settings";
import { SeedButton } from "./seed-button";
import { seedDevData, updateBaseCurrency, wipeDevData } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const baseCurrency = await getBaseCurrency(scope.primaryHouseholdId);

  return (
    <section className="flex flex-col gap-12">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
          Settings
        </p>
        <h1 className="font-serif text-4xl tracking-tight">Your account.</h1>
      </div>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-8 gap-y-3 text-sm">
        <dt className="font-mono text-xs tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
          Email
        </dt>
        <dd>{user.email}</dd>

        <dt className="font-mono text-xs tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
          Household
        </dt>
        <dd className="font-mono text-xs text-[color:var(--color-ink-soft)]">
          {scope.primaryHouseholdId}
        </dd>
      </dl>

      <div className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-8">
        <h2 className="font-serif text-xl">Financial</h2>
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          Your household&apos;s base currency. Used to format wealth, cashflow, and goals.
          Multi-currency accounts still store their native value; FX conversion lands later.
        </p>
        <form action={updateBaseCurrency} className="flex items-center gap-3">
          <label
            htmlFor="baseCurrency"
            className="font-mono text-xs tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase"
          >
            Base currency
          </label>
          <select
            id="baseCurrency"
            name="baseCurrency"
            defaultValue={baseCurrency}
            className="border border-[color:var(--color-border)] bg-transparent px-2 py-1 font-mono text-sm"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="border border-[color:var(--color-border)] px-3 py-1 font-mono text-xs tracking-[0.14em] uppercase hover:bg-[color:var(--color-surface-muted,transparent)]"
          >
            Save
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-8">
        <h2 className="font-serif text-xl">Dev tools</h2>
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          Populate this household with a week of sample entries across all four freedoms (local
          only).
        </p>
        <div className="flex items-center gap-3">
          <SeedButton action={seedDevData} label="Seed a week of entries" />
          <SeedButton action={wipeDevData} label="Wipe this household's entries" variant="ghost" />
        </div>
      </div>
    </section>
  );
}
