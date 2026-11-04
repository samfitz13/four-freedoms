import { requireUser } from "@/lib/auth-server";
import { scopeForUser } from "@/lib/db/scope";
import { getBaseCurrency, SUPPORTED_CURRENCIES } from "@/lib/freedoms/financial-settings";
import { SeedButton } from "./seed-button";
import { seedDevData, updateBaseCurrency, wipeDevData } from "./actions";
import { getUserBirthDate } from "@/lib/db/queries/profile";
import { ProfileForm } from "./profile-form";
import { SettingsAppearance } from "@/components/ui/settings-appearance";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const [baseCurrency, birthDate] = await Promise.all([
    getBaseCurrency(scope.primaryHouseholdId),
    getUserBirthDate(user.id),
  ]);

  return (
    <section className="flex flex-col gap-12">
      <div className="flex flex-col gap-2">
        <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          Settings
        </p>
        <h1 className="font-display text-4xl tracking-tight">Your account.</h1>
      </div>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-8 gap-y-3 text-sm">
        <dt className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          Email
        </dt>
        <dd>{user.email}</dd>

        <dt className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          Household
        </dt>
        <dd className="font-sans text-xs text-[color:var(--color-ink-soft)]">
          {scope.primaryHouseholdId}
        </dd>
      </dl>

      <section
        className="flex flex-col gap-4 border-t border-[color:var(--color-border)] pt-8"
        aria-label="Profile"
      >
        <h2 className="font-display text-xl">Profile</h2>
        <ProfileForm birthDate={birthDate} today={new Date().toISOString().slice(0, 10)} />
      </section>

      <SettingsAppearance />

      <div className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-8">
        <h2 className="font-display text-xl">Financial</h2>
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          Your household&apos;s base currency. Used to format wealth, cashflow, and goals.
          Multi-currency accounts still store their native value; FX conversion lands later.
        </p>
        <form action={updateBaseCurrency} className="flex items-center gap-3">
          <label
            htmlFor="baseCurrency"
            className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]"
          >
            Base currency
          </label>
          <select
            id="baseCurrency"
            name="baseCurrency"
            defaultValue={baseCurrency}
            className="daybreak-field border border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-2 py-1 font-sans text-sm"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="daybreak-button border border-[color:var(--color-border)] px-3 py-1 font-sans text-xs tracking-normal hover:bg-[color:var(--color-surface-muted,transparent)]"
          >
            Save
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-8">
        <h2 className="font-display text-xl">Dev tools</h2>
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          Populate this household with sample Financial data (accounts, 90 days of balances,
          transactions, and one goal). Local only.
        </p>
        <div className="flex flex-wrap items-start gap-x-3 gap-y-4">
          <SeedButton action={seedDevData} label="Seed Financial sample" />
          <SeedButton
            action={wipeDevData}
            label="Wipe this household's Financial data"
            variant="ghost"
            confirm="WIPE"
          />
        </div>
      </div>
    </section>
  );
}
