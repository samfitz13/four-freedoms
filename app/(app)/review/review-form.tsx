"use client";

import { useActionState } from "react";
import { submitReview, type ReviewResult } from "./actions";

export interface Reflections {
  wins?: string;
  struggles?: string;
  nextWeek?: string;
}

export function ReviewForm({
  weekStart,
  weekLabel,
  suggestedScore,
  reflections,
  overallScore,
}: {
  weekStart: string;
  weekLabel: string;
  suggestedScore: number | null;
  reflections: Reflections;
  overallScore: number | null;
}) {
  const [state, formAction, pending] = useActionState<ReviewResult | null, FormData>(
    submitReview,
    null,
  );

  const initial = overallScore ?? suggestedScore ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="weekStart" value={weekStart} />

      <Prompt
        name="wins"
        label="Wins"
        hint="What went well this week? One line is fine."
        defaultValue={reflections.wins}
      />
      <Prompt
        name="struggles"
        label="Struggles"
        hint="What got in the way?"
        defaultValue={reflections.struggles}
      />
      <Prompt
        name="nextWeek"
        label="Next week"
        hint="One concrete commitment for the week ahead."
        defaultValue={reflections.nextWeek}
      />

      <div className="flex flex-col gap-2 border-t border-[color:var(--color-border)] pt-6">
        <label
          htmlFor="overallScore"
          className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase"
        >
          Overall score · {weekLabel}
        </label>
        <div className="flex items-center gap-3">
          <input
            id="overallScore"
            name="overallScore"
            type="number"
            min={0}
            max={100}
            defaultValue={initial}
            className="h-10 w-28 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-3 text-sm focus:border-[color:var(--color-foreground)] focus:outline-none"
          />
          <span className="text-xs text-[color:var(--color-ink-soft)]">
            Your own 0–100 read. Defaults to the computed mean of the four freedoms.
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-[color:var(--color-border)] pt-6">
        {state?.ok === false ? (
          <p className="text-sm text-[color:var(--color-accent-warning,#9a3412)]">{state.error}</p>
        ) : state?.ok ? (
          <p className="text-sm text-[color:var(--color-ink-soft)]">Review saved.</p>
        ) : (
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            Save any time — resubmitting updates in place.
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-[color:var(--color-foreground)] px-5 text-sm text-[color:var(--color-background)] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save review"}
        </button>
      </div>
    </form>
  );
}

function Prompt({
  name,
  label,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  hint: string;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={name}
        className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase"
      >
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={3}
        maxLength={1000}
        defaultValue={defaultValue ?? ""}
        className="w-full resize-y rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-3 py-2 text-sm focus:border-[color:var(--color-foreground)] focus:outline-none"
      />
      <span className="text-xs text-[color:var(--color-ink-soft)]">{hint}</span>
    </div>
  );
}
