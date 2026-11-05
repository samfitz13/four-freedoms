import type { TimePursuit } from "@/lib/db/schema";
import { createEvent } from "./agenda-actions";

export function AgendaEventForm({ pursuits }: { pursuits: TimePursuit[] }) {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const end = new Date(now.getTime() + 60 * 60 * 1000);

  return (
    <form action={createEvent} className="daybreak-panel grid gap-3 p-6">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          Event
        </span>
        <input
          name="title"
          required
          className="daybreak-field border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] py-1 focus:border-[color:var(--color-foreground)]"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          name="startsAt"
          type="datetime-local"
          defaultValue={toLocalValue(now)}
          className="daybreak-field border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] py-1"
        />
        <input
          name="endsAt"
          type="datetime-local"
          defaultValue={toLocalValue(end)}
          className="daybreak-field border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] py-1"
        />
        <select
          name="pursuitId"
          defaultValue=""
          className="daybreak-field border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] py-1"
        >
          <option value="">No pursuit</option>
          {pursuits.map((pursuit) => (
            <option key={pursuit.id} value={pursuit.id}>
              {pursuit.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          name="location"
          placeholder="Location"
          className="daybreak-field border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] py-1"
        />
        <select
          name="recurrence"
          defaultValue="none"
          className="daybreak-field border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] py-1"
        >
          <option value="none">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allDay" />
          All day
        </label>
      </div>
      <textarea
        name="description"
        rows={2}
        placeholder="Notes"
        className="daybreak-field border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] py-1"
      />
      <button
        type="submit"
        className="daybreak-button justify-self-start border border-[color:var(--color-border)] px-3 py-1 font-sans text-xs tracking-normal hover:bg-[color:var(--color-paper-soft)]"
      >
        Add event
      </button>
    </form>
  );
}

function toLocalValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
