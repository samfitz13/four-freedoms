import Link from "next/link";
import { listCalendarAccounts, listTimePursuits } from "@/lib/db/queries/time";
import { listAgendaEvents } from "@/lib/freedoms/time-agenda";
import { CalendarConnect } from "./calendar-connect";
import { AgendaEventForm } from "./agenda-event-form";

export async function TimeAgendaTab({
  householdId,
  view = "today",
}: {
  householdId: string;
  view?: string;
}) {
  const activeView = view === "week" || view === "month" ? view : "today";
  const range = rangeForView(activeView);
  const [events, pursuits, accounts] = await Promise.all([
    listAgendaEvents(householdId, range.from, range.to),
    listTimePursuits(householdId),
    listCalendarAccounts(householdId),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="daybreak-section-head flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl tracking-tight">Agenda</h2>
            <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
              Native events and read-only Google Calendar imports, folded into one view.
            </p>
          </div>
          <nav className="flex gap-2 font-sans text-xs tracking-normal">
            {["today", "week", "month"].map((next) => (
              <Link
                key={next}
                href={`/time/agenda?view=${next}`}
                className={
                  next === activeView
                    ? "text-[color:var(--color-foreground)]"
                    : "text-[color:var(--color-ink-soft)]"
                }
              >
                {next}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <CalendarConnect accounts={accounts} />
      <AgendaEventForm pursuits={pursuits} />
      {activeView === "month" ? (
        <MonthGrid events={events} from={range.from} />
      ) : activeView === "week" ? (
        <WeekGrid events={events} from={range.from} />
      ) : (
        <EventList events={events} />
      )}
    </div>
  );
}

function EventList({ events }: { events: Awaited<ReturnType<typeof listAgendaEvents>> }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-[color:var(--color-ink-soft)]">Nothing scheduled in this range.</p>
    );
  }
  return (
    <ul className="divide-y divide-[color:var(--color-border)]">
      {events.map((event) => (
        <li
          key={`${event.id}-${event.occurrenceStartsAt.toISOString()}`}
          className="grid gap-2 py-3 sm:grid-cols-[8rem_1fr_auto]"
        >
          <time className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
            {formatTime(event.occurrenceStartsAt)}
          </time>
          <span
            className="border-l-2 pl-3"
            style={{ borderColor: event.pursuitColorVar ?? "var(--color-border)" }}
          >
            <span className="font-display text-lg tracking-tight">{event.title}</span>
            {event.location ? (
              <span className="ml-2 text-sm text-[color:var(--color-ink-soft)]">
                {event.location}
              </span>
            ) : null}
          </span>
          {event.source === "google" ? (
            <span className="font-sans text-xs text-[color:var(--color-ink-soft)]">G</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function WeekGrid({
  events,
  from,
}: {
  events: Awaited<ReturnType<typeof listAgendaEvents>>;
  from: Date;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <div className="grid gap-px border border-[color:var(--color-border)] bg-[color:var(--color-border)] md:grid-cols-7">
      {days.map((day) => {
        const iso = day.toISOString().slice(0, 10);
        const dayEvents = events.filter(
          (event) => event.occurrenceStartsAt.toISOString().slice(0, 10) === iso,
        );
        return (
          <section key={iso} className="min-h-40 bg-[color:var(--color-paper)] p-3">
            <h3 className="font-display mb-3 text-lg tabular-nums">{day.getDate()}</h3>
            <EventList events={dayEvents} />
          </section>
        );
      })}
    </div>
  );
}

function MonthGrid({
  events,
  from,
}: {
  events: Awaited<ReturnType<typeof listAgendaEvents>>;
  from: Date;
}) {
  const start = startOfWeek(new Date(from.getFullYear(), from.getMonth(), 1));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <div className="grid grid-cols-7 gap-px border border-[color:var(--color-border)] bg-[color:var(--color-border)]">
      {days.map((day) => {
        const iso = day.toISOString().slice(0, 10);
        const dayEvents = events.filter(
          (event) => event.occurrenceStartsAt.toISOString().slice(0, 10) === iso,
        );
        return (
          <section key={iso} className="min-h-28 bg-[color:var(--color-paper)] p-2">
            <h3 className="font-display text-base tabular-nums">{day.getDate()}</h3>
            {dayEvents.slice(0, 3).map((event) => (
              <p key={event.id} className="truncate text-xs">
                {event.title}
              </p>
            ))}
            {dayEvents.length > 3 ? (
              <p className="font-sans text-xs text-[color:var(--color-ink-soft)]">
                +{dayEvents.length - 3} more
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function rangeForView(view: "today" | "week" | "month") {
  const now = new Date();
  if (view === "today") return { from: startOfDay(now), to: endOfDay(now) };
  if (view === "week") {
    const from = startOfWeek(now);
    return { from, to: endOfDay(addDays(from, 6)) };
  }
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
}
