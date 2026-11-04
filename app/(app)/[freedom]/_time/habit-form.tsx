"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { useActionState, useState } from "react";
import type { Habit, TimePursuit } from "@/lib/db/schema";
import { createHabit, updateHabit } from "./habits-actions";
import type { ActionResult } from "./types";

export function HabitForm({
  pursuits,
  habit,
  today,
}: {
  pursuits: TimePursuit[];
  habit?: Habit;
  today: string;
}) {
  const [linkKind, setLinkKind] = useState<Habit["linkKind"]>(habit?.linkKind ?? "none");
  const [title, setTitle] = useState(habit?.title ?? "");
  const [cadence, setCadence] = useState(habit?.cadence ?? "daily");
  const [target, setTarget] = useState(String(habit?.targetPerWeek ?? 7));
  const [pursuitId, setPursuitId] = useState(habit?.pursuitId ?? "");
  const [timeOfDay, setTimeOfDay] = useState(habit?.timeOfDay ?? "");
  const [threshold, setThreshold] = useState(
    String(
      habit?.linkKind === "workout"
        ? (habit.linkParams.minMinutes ?? 30)
        : (habit?.linkParams.minHours ?? 7),
    ),
  );
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_previous, data) => {
      try {
        const result = await (habit ? updateHabit(data) : createHabit(data));
        if (result.ok && !habit) {
          setTitle("");
          setCadence("daily");
          setTarget("7");
          setPursuitId("");
          setTimeOfDay("");
          setLinkKind("none");
          setThreshold("7");
        }
        return result;
      } catch {
        return {
          ok: false,
          error: "Couldn’t save this habit. Your entries are still here. Please try again.",
        };
      }
    },
    null,
  );
  return (
    <form
      action={action}
      className="habit-form"
      aria-label={habit ? `Edit ${habit.title}` : "New habit"}
    >
      {habit && <input type="hidden" name="id" value={habit.id} />}
      <input type="hidden" name="startedOn" value={habit?.startedOn ?? today} />
      <fieldset disabled={pending}>
        <legend className="sr-only">{habit ? "Habit details" : "Create a habit"}</legend>
        <Label className="habit-form-title">
          What would you like to make time for?
          <Input
            name="title"
            required
            maxLength={100}
            placeholder="e.g. Read a few pages"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Label>
        <div className="habit-form-grid">
          <Label>
            Rhythm
            <NativeSelect
              name="cadence"
              value={cadence}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "daily" || value === "weekly" || value === "custom")
                  setCadence(value);
              }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="custom">Custom</option>
            </NativeSelect>
          </Label>
          <Label>
            Days per week
            <Input
              name="targetPerWeek"
              type="number"
              min={1}
              max={7}
              required
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          </Label>
          <Label>
            Pursuit
            <NativeSelect
              name="pursuitId"
              value={pursuitId}
              onChange={(event) => setPursuitId(event.target.value)}
            >
              <option value="">No pursuit</option>
              {habit?.pursuitId && !pursuits.some((pursuit) => pursuit.id === habit.pursuitId) && (
                <option value={habit.pursuitId}>Current pursuit (unavailable)</option>
              )}
              {pursuits.map((pursuit) => (
                <option key={pursuit.id} value={pursuit.id}>
                  {pursuit.name}
                </option>
              ))}
            </NativeSelect>
          </Label>
          <Label>
            Time of day (optional)
            <Input
              name="timeOfDay"
              maxLength={40}
              placeholder="e.g. After breakfast"
              value={timeOfDay}
              onChange={(event) => setTimeOfDay(event.target.value)}
            />
          </Label>
        </div>
        <div className="habit-link-fields">
          <Label>
            How it’s recorded
            <NativeSelect
              name="linkKind"
              value={linkKind}
              onChange={(event) => {
                const value = event.target.value;
                if (
                  value === "none" ||
                  value === "sleep" ||
                  value === "workout" ||
                  value === "body_weight"
                ) {
                  setLinkKind(value);
                  setThreshold(value === "workout" ? "30" : "7");
                }
              }}
            >
              <option value="none">Manual check-in</option>
              <option value="workout">From workout logs</option>
              <option value="sleep">From sleep logs</option>
              <option value="body_weight" disabled={habit?.linkKind !== "body_weight"}>
                Body weight (not connected yet)
              </option>
            </NativeSelect>
          </Label>
          {linkKind === "workout" && (
            <Label>
              Minimum workout minutes
              <Input
                name="minMinutes"
                type="number"
                min={1}
                required
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
              />
            </Label>
          )}
          {linkKind === "sleep" && (
            <Label>
              Minimum sleep hours
              <Input
                name="minHours"
                type="number"
                min={1}
                step="0.25"
                required
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
              />
            </Label>
          )}
          <p>
            {linkKind === "none"
              ? "Check in with a tap. You can also fill in a day from the past week."
              : linkKind === "body_weight"
                ? "This source is not connected yet. Choose another source to record check-ins."
                : "Qualifying health logs record the day automatically. No extra check-in needed."}
          </p>
        </div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : habit ? "Save changes" : "Add habit"}
        </Button>
      </fieldset>
      <div aria-live="polite">
        {state && (
          <p className="habit-form-result" data-error={!state.ok}>
            {state.ok
              ? (state.message ?? (habit ? "Habit updated." : "Habit added."))
              : state.error}
          </p>
        )}
      </div>
    </form>
  );
}
