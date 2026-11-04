import { googleCalendarConfigured } from "@/lib/calendar/google";
import type { CalendarAccount } from "@/lib/db/schema";
import { connectGoogle, disconnectGoogle, syncNow } from "./calendar-sync-actions";

export function CalendarConnect({ accounts }: { accounts: CalendarAccount[] }) {
  const configured = googleCalendarConfigured();
  const active = accounts.find((account) => account.disabledAt === null);

  return (
    <section className="daybreak-panel flex flex-wrap items-end justify-between gap-4 p-6">
      <div className="flex flex-col gap-1">
        <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          Google Calendar
        </p>
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          {configured
            ? active
              ? `${active.displayEmail ?? "Connected"} · ${
                  active.lastSyncedAt
                    ? `synced ${relativeTime(active.lastSyncedAt)}`
                    : "not synced yet"
                }`
              : "Connect a primary calendar for read-only agenda sync."
            : "Calendar sync is disabled until Google OAuth env vars are set."}
        </p>
      </div>
      {active ? (
        <div className="flex flex-wrap gap-2">
          <form action={syncNow}>
            <input type="hidden" name="id" value={active.id} />
            <button className="daybreak-button border border-[color:var(--color-border)] px-3 py-1 font-sans text-xs tracking-normal">
              Sync now
            </button>
          </form>
          <form action={disconnectGoogle} className="flex items-center gap-2">
            <input type="hidden" name="id" value={active.id} />
            <label className="font-sans text-xs text-[color:var(--color-ink-soft)]">
              <input type="checkbox" name="purge" className="daybreak-field mr-1" />
              purge
            </label>
            <button className="daybreak-button border border-[color:var(--color-border)] px-3 py-1 font-sans text-xs tracking-normal">
              Disconnect
            </button>
          </form>
        </div>
      ) : (
        <form action={connectGoogle}>
          <input type="hidden" name="redirectUrl" value="/time/agenda" />
          <button
            disabled={!configured}
            className="daybreak-button border border-[color:var(--color-border)] px-3 py-1 font-sans text-xs tracking-normal disabled:opacity-50"
          >
            Connect calendar
          </button>
        </form>
      )}
    </section>
  );
}

function relativeTime(date: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}
