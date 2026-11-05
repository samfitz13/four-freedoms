import { listRecentWorkouts } from "@/lib/db/queries/health";
import type { Workout } from "@/lib/db/schema";
import { WorkoutForm } from "./health-forms";

const kinds = ["strength", "cardio", "mobility", "sport", "other"] as const;

export async function HealthTrainingTab({ householdId }: { householdId: string }) {
  const workouts = await listRecentWorkouts(householdId, 90);
  const weeks = buildKindWeeks(workouts);
  const days = buildHeatmap(workouts);

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <h2 className="font-display text-2xl tracking-tight">Training</h2>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Minutes, intensity, and cadence. Enough structure to see the pattern.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-5">
        {kinds.map((kind) => (
          <div
            key={kind}
            className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-3"
          >
            <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              {kind}
            </h3>
            <div className="flex h-24 items-end gap-1">
              {weeks.map((week) => (
                <span
                  key={`${kind}-${week.label}`}
                  title={`${week.label}: ${week[kind]} min`}
                  className="flex-1 bg-[color:var(--color-foreground)]"
                  style={{ height: `${Math.max(2, (week[kind] / Math.max(60, week.max)) * 96)}px` }}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4">
        <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          90-day cadence
        </h3>
        <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-1">
          {days.map((day) => (
            <span
              key={day.date}
              title={`${day.date}: ${day.minutes || "—"} min`}
              className="aspect-square border border-[color:var(--color-border)]"
              style={{
                background: day.minutes
                  ? `color-mix(in oklch, var(--color-freedom-health) ${Math.min(85, 20 + day.minutes)}%, transparent)`
                  : "transparent",
              }}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          Add workout
        </h3>
        <WorkoutForm />
      </section>

      <section className="flex flex-col divide-y divide-[color:var(--color-border)]">
        {workouts.map((workout) => (
          <details key={workout.id} className="py-4">
            <summary className="grid cursor-pointer grid-cols-[8rem_1fr_auto] gap-4 text-sm">
              <span className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                {formatDate(workout.performedAt)}
              </span>
              <span className="capitalize">
                {workout.kind} · {workout.minutes} min
                {workout.intensity ? ` · ${workout.intensity}/5` : ""}
              </span>
              <span className="text-[color:var(--color-ink-soft)]">Edit</span>
            </summary>
            {workout.note ? (
              <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">{workout.note}</p>
            ) : null}
            <div className="mt-5">
              <WorkoutForm workout={workout} />
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}

function buildKindWeeks(rows: Workout[]) {
  const weeks = Array.from({ length: 12 }, (_, index) => ({
    label: `W${index + 1}`,
    max: 0,
    strength: 0,
    cardio: 0,
    mobility: 0,
    sport: 0,
    other: 0,
  }));
  for (const row of rows) {
    const idx =
      11 - Math.floor((Date.now() - row.performedAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (idx >= 0 && idx < weeks.length) {
      weeks[idx]![row.kind] += row.minutes;
    }
  }
  const max = Math.max(1, ...weeks.flatMap((week) => kinds.map((kind) => week[kind])));
  return weeks.map((week) => ({ ...week, max }));
}

function buildHeatmap(rows: Workout[]) {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const day = row.performedAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + row.minutes);
  }
  return Array.from({ length: 90 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (89 - index));
    const iso = date.toISOString().slice(0, 10);
    return { date: iso, minutes: byDay.get(iso) ?? 0 };
  });
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}
