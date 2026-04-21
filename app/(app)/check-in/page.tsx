import { requireUser } from "@/lib/auth-server";
import { listRecentEntries } from "@/lib/db/queries";
import { FREEDOMS, type FreedomKey } from "@/lib/freedoms/types";
import { CheckInForm } from "./check-in-form";

export const metadata = { title: "Check-in" };
export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const user = await requireUser();
  // Today in the server's timezone — good enough for v1.
  const today = new Date().toISOString().slice(0, 10);

  // Pre-fill with today's existing entries, if any.
  const todays = await listRecentEntries(user.id, { days: 1 });
  const prefill: Partial<Record<FreedomKey, Record<string, unknown>>> = {};
  for (const row of todays) {
    if (row.occurredOn === today) {
      prefill[row.freedom] = row.payload ?? {};
    }
  }

  return (
    <section className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
          Daily
        </p>
        <h1 className="font-serif text-4xl tracking-tight">Today&rsquo;s check-in.</h1>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Four prompts, one minute. Skip anything you don&rsquo;t have data for — fields left blank
          are ignored. {FREEDOMS.length === 4 ? "" : null}
        </p>
      </div>

      <CheckInForm defaultDate={today} prefill={prefill} />
    </section>
  );
}
