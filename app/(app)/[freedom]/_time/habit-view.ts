import type { HabitDay, TrackedHabit } from "./types";

/** Keep the existing UTC check-in dates consistent across SSR and browsers. */
export function habitDays(
  habit: Pick<TrackedHabit, "checkins" | "startedOn">,
  today: string,
): HabitDay[] {
  const hits = new Set(habit.checkins.map((checkin) => checkin.occurredOn));
  return Array.from({ length: 28 }, (_, index) => {
    const day = new Date(`${today}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - 27 + index);
    const date = day.toISOString().slice(0, 10);
    const available = date >= habit.startedOn;
    return {
      date,
      label: day.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }),
      weekday: day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      number: String(day.getUTCDate()),
      hit: available && hits.has(date),
      available,
      today: date === today,
    };
  });
}

export function habitSource(habit: Pick<TrackedHabit, "linkKind" | "linkParams">): string {
  if (habit.linkKind === "workout")
    return `Workout · ${typeof habit.linkParams.minMinutes === "number" ? habit.linkParams.minMinutes : 1}+ minutes`;
  if (habit.linkKind === "sleep")
    return `Sleep · ${typeof habit.linkParams.minHours === "number" ? habit.linkParams.minHours : 7}+ hours`;
  if (habit.linkKind === "body_weight") return "Body-weight link · not connected yet";
  return "Manual check-in";
}
