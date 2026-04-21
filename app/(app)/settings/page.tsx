import { requireUser } from "@/lib/auth-server";
import { scopeForUser } from "@/lib/db/scope";
import { SeedButton } from "./seed-button";
import { seedDevData, wipeDevData } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);

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
