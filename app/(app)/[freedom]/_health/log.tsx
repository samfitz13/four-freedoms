import {
  listHealthFeed,
  listRecentBody,
  listRecentCheckins,
  listRecentSleep,
  listRecentWorkouts,
} from "@/lib/db/queries/health";
import { formatWeightLb } from "@/lib/freedoms/health-units";
import {
  AddHealthEntry,
  BodyMeasurementForm,
  CheckinForm,
  SleepForm,
  WorkoutForm,
} from "./health-forms";

export async function HealthLogTab({ householdId }: { householdId: string }) {
  const [feed, sleepRows, checkins, workouts, bodyRows] = await Promise.all([
    listHealthFeed(householdId, 30),
    listRecentSleep(householdId, 30),
    listRecentCheckins(householdId, 30),
    listRecentWorkouts(householdId, 30),
    listRecentBody(householdId, 30),
  ]);
  const sleepById = new Map(sleepRows.map((row) => [row.id, row]));
  const checkinById = new Map(checkins.map((row) => [row.id, row]));
  const workoutById = new Map(workouts.map((row) => [row.id, row]));
  const bodyById = new Map(bodyRows.map((row) => [row.id, row]));
  const byDay = groupBy(feed, (item) => item.occurredAt.toISOString().slice(0, 10));

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <h2 className="font-display text-2xl tracking-tight">Log</h2>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Last 30 days of sleep, check-ins, workouts, and body measurements.
        </p>
      </header>

      <AddHealthEntry />

      {feed.length === 0 ? (
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          No entries yet. Start with the entry type that feels true today.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {Array.from(byDay.entries()).map(([day, items]) => (
            <section key={day} className="flex flex-col gap-2">
              <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
                {day}
              </h3>
              <div className="flex flex-col divide-y divide-[color:var(--color-border)]">
                {items.map((item) => (
                  <details key={`${item.kind}-${item.id}`} className="py-3">
                    <summary className="grid cursor-pointer grid-cols-[5rem_1fr_auto] gap-4 text-sm">
                      <span className="font-sans text-xs text-[color:var(--color-ink-soft)]">
                        {item.kind}
                      </span>
                      <span className="tabular-nums">{describeItem(item)}</span>
                      <span className="text-[color:var(--color-ink-soft)]">Edit</span>
                    </summary>
                    <div className="mt-5">
                      {item.kind === "sleep" ? (
                        <SleepForm sleep={sleepById.get(item.id)} />
                      ) : item.kind === "checkin" ? (
                        <CheckinForm checkin={checkinById.get(item.id)} />
                      ) : item.kind === "workout" ? (
                        <WorkoutForm workout={workoutById.get(item.id)} />
                      ) : (
                        <BodyMeasurementForm measurement={bodyById.get(item.id)} />
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

type FeedItem = Awaited<ReturnType<typeof listHealthFeed>>[number];

function describeItem(item: FeedItem) {
  if (item.kind === "sleep") {
    return `${item.sleepHours.toFixed(1)}h sleep${item.note ? ` · ${item.note}` : ""}`;
  }
  if (item.kind === "checkin") {
    return [
      item.energy === null ? null : `${item.energy}/10 energy`,
      item.restingHr === null ? null : `${item.restingHr} bpm`,
      item.note,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (item.kind === "workout") {
    return `${item.workoutKind} · ${item.minutes} min${item.intensity ? ` · ${item.intensity}/5` : ""}${item.note ? ` · ${item.note}` : ""}`;
  }
  return [
    item.weightKg === null ? null : formatWeightLb(item.weightKg),
    item.bodyFatPct === null ? null : `${item.bodyFatPct.toFixed(1)}%`,
    item.waistCm === null ? null : `${item.waistCm.toFixed(1)} cm`,
    item.restingHr === null ? null : `${item.restingHr} bpm`,
    item.note,
  ]
    .filter(Boolean)
    .join(" · ");
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = map.get(k);
    if (group) group.push(item);
    else map.set(k, [item]);
  }
  return map;
}
