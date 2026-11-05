import Link from "next/link";
import { ArrowUpRight, Check, Link2, Plus, Sprout } from "lucide-react";
import { listTimeHabits, listTimePursuits } from "@/lib/db/queries/time";
import type { TimePursuit } from "@/lib/db/schema";
import { HabitForm } from "./habit-form";
import { HabitArchive, HabitWeek } from "./habit-controls";
import { habitDays, habitSource } from "./habit-view";
import type { TrackedHabit } from "./types";

export async function TimeHabitsTab({ householdId }: { householdId: string }) {
  const [habits, pursuits] = await Promise.all([
    listTimeHabits(householdId),
    listTimePursuits(householdId),
  ]);
  return (
    <HabitTracker
      habits={habits}
      pursuits={pursuits}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}

export function HabitTracker({
  habits,
  pursuits,
  today,
}: {
  habits: TrackedHabit[];
  pursuits: TimePursuit[];
  today: string;
}) {
  const rows = habits.map((habit) => {
    const days = habitDays(habit, today);
    const week = days.slice(-7);
    return { habit, days, week, hits: week.filter((day) => day.hit).length };
  });
  const recordedToday = rows.filter((row) => row.week[6]?.hit).length;
  const targetsMet = rows.filter((row) => row.hits >= row.habit.targetPerWeek).length;
  return (
    <div className="habit-workspace">
      <header className="habit-heading">
        <div>
          <p className="eyebrow">Small things, often</p>
          <h2>Keep a little rhythm.</h2>
          <p className="habit-intro">Make space for what you want to come back to.</p>
        </div>
        {habits.length > 0 && (
          <div className="habit-today-note">
            <span className="habit-today-mark">
              <Check size={18} aria-hidden />
            </span>
            <span>
              <strong>
                {recordedToday} of {habits.length}
              </strong>
              <br />
              habits recorded today
            </span>
          </div>
        )}
      </header>

      {rows.length > 0 ? (
        <section className="daybreak-panel habit-tracker" aria-label="Habit check-ins">
          <header className="habit-tracker-heading">
            <div>
              <h3>Past seven days</h3>
              <p>Tap a day to check in or undo. Dates use UTC.</p>
            </div>
            <span className="habit-target-note">
              {targetsMet} of {habits.length} weekly targets met
            </span>
          </header>
          <ul className="habit-list">
            {rows.map(({ habit, days, week, hits }) => (
              <li key={habit.id} className="habit-row">
                <div className="habit-identity">
                  <p className="habit-context">
                    {habit.pursuit?.name ?? "Your own rhythm"}
                    {habit.timeOfDay ? ` · ${habit.timeOfDay}` : ""}
                  </p>
                  <h3>{habit.title}</h3>
                  <p className="habit-source">
                    {habit.linkKind !== "none" && <Link2 size={13} aria-hidden />}
                    {habitSource(habit)}
                  </p>
                </div>
                <HabitWeek
                  habitId={habit.id}
                  title={habit.title}
                  days={week}
                  linked={habit.linkKind !== "none"}
                />
                <div className="habit-progress">
                  <p>
                    <strong>{hits}</strong>
                    <span> / {habit.targetPerWeek} days</span>
                  </p>
                  <progress
                    max={habit.targetPerWeek}
                    value={Math.min(hits, habit.targetPerWeek)}
                    aria-label={`${habit.title}: ${hits} of ${habit.targetPerWeek} target days in the past seven days`}
                  />
                  <span>
                    {hits >= habit.targetPerWeek
                      ? "Target met"
                      : `${habit.cadence === "custom" ? "Custom" : habit.cadence === "daily" ? "Daily" : "Weekly"} rhythm`}
                  </span>
                </div>
                <details className="habit-details">
                  <summary>History & details</summary>
                  <div className="habit-detail-content">
                    <div className="habit-history-heading">
                      <h4>Last 28 days</h4>
                      <span>{days.filter((day) => day.hit).length} days recorded</span>
                    </div>
                    <ol className="habit-history" aria-label={`${habit.title}, last 28 days`}>
                      {days.map((day) => (
                        <li
                          key={day.date}
                          data-hit={day.hit}
                          data-available={day.available}
                          title={`${day.label}: ${!day.available ? "Before start date" : day.hit ? "Recorded" : "No check-in"}`}
                        >
                          <span aria-hidden>{day.available ? day.number : "·"}</span>
                          <span className="sr-only">
                            {day.label}:{" "}
                            {!day.available
                              ? "Before start date"
                              : day.hit
                                ? "Recorded"
                                : "No check-in"}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="habit-history-heading">
                      <span>
                        {days[0]?.date} to {today}
                      </span>
                      <span>Filled = recorded · outline = no check-in</span>
                    </div>
                    {habit.linkKind !== "none" && (
                      <p className="habit-linked-note">
                        {habit.linkKind === "body_weight" ? (
                          "Body-weight check-ins are not connected yet. Edit this habit to use manual check-ins or another source."
                        ) : (
                          <>
                            Check-ins come from your health logs, not manual taps.{" "}
                            <Link href="/health/log">
                              View health logs <ArrowUpRight size={14} aria-hidden />
                            </Link>
                          </>
                        )}
                      </p>
                    )}
                    <details className="habit-edit">
                      <summary>Edit habit</summary>
                      <HabitForm pursuits={pursuits} habit={habit} today={today} />
                    </details>
                    <HabitArchive habitId={habit.id} title={habit.title} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="daybreak-panel habit-empty">
          <Sprout size={32} strokeWidth={1.4} aria-hidden />
          <h3>A small place to begin.</h3>
          <p>
            Choose one thing you’d like to do more often. Set a pace that fits your life, then
            record it here.
          </p>
          <p className="habit-empty-hint">A walk. A few pages. Time without a screen.</p>
        </section>
      )}
      <details className="daybreak-panel habit-composer" open={habits.length === 0}>
        <summary>
          <span className="habit-composer-icon">
            <Plus size={20} aria-hidden />
          </span>
          <span>
            <strong>Make room for a habit</strong>
            <small>A name, a weekly target, a place in your day.</small>
          </span>
        </summary>
        <HabitForm pursuits={pursuits} today={today} />
      </details>
    </div>
  );
}
