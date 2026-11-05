import type { TIME_TABS } from "./constants";
import type { Habit, HabitCheckin, TimePursuit } from "@/lib/db/schema";

export type TimeTab = (typeof TIME_TABS)[number]["key"];

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export type TrackedHabit = Habit & { pursuit: TimePursuit | null; checkins: HabitCheckin[] };

export type HabitDay = {
  date: string;
  label: string;
  weekday: string;
  number: string;
  hit: boolean;
  available: boolean;
  today: boolean;
};
