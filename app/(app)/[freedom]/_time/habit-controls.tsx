"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { archiveHabit, toggleCheckin } from "./habits-actions";
import type { ActionResult, HabitDay } from "./types";

export function HabitWeek({
  habitId,
  title,
  days,
  linked,
}: {
  habitId: string;
  title: string;
  days: HabitDay[];
  linked: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_previous, data) => {
      try {
        await toggleCheckin(data);
        return { ok: true };
      } catch {
        return { ok: false, error: "Couldn’t save the check-in. Please try again." };
      }
    },
    null,
  );
  return (
    <form action={action} className="habit-week" aria-label={`${title} check-ins`}>
      <input type="hidden" name="habitId" value={habitId} />
      <div className="habit-week-days">
        {days.map((day) => {
          const content = (
            <>
              <span className="habit-weekday">{day.today ? "Today" : day.weekday}</span>
              <span className="habit-day-mark">
                {day.hit ? (
                  <Check size={19} strokeWidth={2} aria-hidden />
                ) : (
                  <span className="habit-day-number">{day.number}</span>
                )}
              </span>
            </>
          );
          const label = `${title}, ${day.label}: ${!day.available ? "before start date" : day.hit ? "recorded" : "no check-in"}`;
          return linked ? (
            <span
              key={day.date}
              className="habit-day"
              data-hit={day.hit}
              data-today={day.today}
              data-available={day.available}
              role="img"
              aria-label={label}
            >
              {content}
            </span>
          ) : (
            <button
              key={day.date}
              type="submit"
              name="occurredOn"
              value={day.date}
              className="habit-day"
              data-hit={day.hit}
              data-today={day.today}
              data-available={day.available}
              aria-label={label}
              aria-pressed={day.hit}
              disabled={pending || !day.available}
            >
              {content}
            </button>
          );
        })}
      </div>
      <span className="habit-save-status" role="status">
        {pending ? "Saving check-in…" : state && !state.ok ? state.error : ""}
      </span>
    </form>
  );
}

export function HabitArchive({ habitId, title }: { habitId: string; title: string }) {
  const [armed, setArmed] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasArmed = useRef(false);
  useEffect(() => {
    if (armed) confirmRef.current?.focus();
    else if (wasArmed.current) openerRef.current?.focus();
    wasArmed.current = armed;
  }, [armed]);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_previous, data) => {
      try {
        await archiveHabit(data);
        setArmed(false);
        return { ok: true };
      } catch {
        return { ok: false, error: "Couldn’t archive this habit. Please try again." };
      }
    },
    null,
  );
  return (
    <form
      action={action}
      className="habit-archive"
      onKeyDown={(event) => {
        if (event.key === "Escape" && armed && !pending) {
          event.preventDefault();
          event.stopPropagation();
          setArmed(false);
        }
      }}
    >
      <input type="hidden" name="id" value={habitId} />
      {armed ? (
        <>
          <p>Archive “{title}”? Its check-in history stays saved.</p>
          <button ref={confirmRef} type="submit" disabled={pending} className="daybreak-button">
            {pending ? (
              <>
                <LoaderCircle size={14} aria-hidden />
                Archiving…
              </>
            ) : (
              "Confirm archive"
            )}
          </button>
          <button
            type="button"
            disabled={pending}
            className="daybreak-button"
            onClick={() => setArmed(false)}
          >
            Keep habit
          </button>
        </>
      ) : (
        <button
          ref={openerRef}
          type="button"
          className="daybreak-button"
          onClick={() => setArmed(true)}
        >
          Archive habit
        </button>
      )}
      {state && !state.ok && <p role="alert">{state.error}</p>}
    </form>
  );
}
