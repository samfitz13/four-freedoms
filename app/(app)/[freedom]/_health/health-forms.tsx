"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { DateInput } from "@/components/ui/date-input";
import type { BodyMeasurement, HealthCheckin, SleepLog, Workout } from "@/lib/db/schema";
import { kgToLb } from "@/lib/freedoms/health-units";
import {
  createBodyMeasurement,
  createCheckin,
  createSleepLog,
  createWorkout,
  deleteBodyMeasurement,
  deleteCheckin,
  deleteSleepLog,
  deleteWorkout,
  updateBodyMeasurement,
  updateCheckin,
  updateSleepLog,
  updateWorkout,
} from "./actions";

export function AddHealthEntry() {
  const [kind, setKind] = useState<"sleep" | "checkin" | "workout" | "body">("sleep");
  return (
    <section className="flex flex-col gap-5 border-b border-[color:var(--color-border)] pb-8">
      <div className="flex flex-wrap gap-2">
        {(["sleep", "checkin", "workout", "body"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            aria-pressed={kind === option}
            className={[
              "daybreak-tab border px-3 py-1 text-xs",
              kind === option
                ? "border-[color:var(--color-foreground)] text-[color:var(--color-foreground)]"
                : "border-[color:var(--color-border)] text-[color:var(--color-ink-soft)]",
            ].join(" ")}
          >
            {option === "checkin" ? "Check-in" : option}
          </button>
        ))}
      </div>
      {kind === "sleep" ? (
        <SleepForm />
      ) : kind === "checkin" ? (
        <CheckinForm />
      ) : kind === "workout" ? (
        <WorkoutForm />
      ) : (
        <BodyMeasurementForm />
      )}
    </section>
  );
}

export function SleepForm({ sleep }: { sleep?: SleepLog }) {
  return (
    <form
      action={sleep ? updateSleepLog : createSleepLog}
      className="grid max-w-3xl gap-4 sm:grid-cols-3"
    >
      {sleep ? <input type="hidden" name="id" value={sleep.id} /> : null}
      <Field label="Date">
        <DateInput name="recordedOn" defaultValue={sleep?.recordedOn} required />
      </Field>
      <Field label="Hours">
        <Input
          name="sleepHours"
          type="number"
          min={0}
          max={24}
          step={0.25}
          required
          defaultValue={sleep?.sleepHours ?? ""}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bedtime">
          <Input name="bedAt" type="time" defaultValue={sleep?.bedAt ?? ""} />
        </Field>
        <Field label="Wake time">
          <Input name="wakeAt" type="time" defaultValue={sleep?.wakeAt ?? ""} />
        </Field>
      </div>
      <TextField defaultValue={sleep?.note} />
      <Actions deleteAction={sleep ? deleteSleepLog : undefined} id={sleep?.id} />
    </form>
  );
}

export function CheckinForm({ checkin }: { checkin?: HealthCheckin }) {
  return (
    <form
      action={checkin ? updateCheckin : createCheckin}
      className="grid max-w-3xl gap-4 sm:grid-cols-3"
    >
      {checkin ? <input type="hidden" name="id" value={checkin.id} /> : null}
      <DateTimeFields date={dateValue(checkin?.recordedAt)} time={timeValue(checkin?.recordedAt)} />
      <Field label="Energy">
        <Input
          name="energy"
          type="number"
          min={1}
          max={10}
          step={1}
          defaultValue={checkin?.energy ?? ""}
        />
      </Field>
      <Field label="Resting HR">
        <Input
          name="restingHr"
          type="number"
          min={20}
          max={200}
          step={1}
          defaultValue={checkin?.restingHr ?? ""}
        />
      </Field>
      <TextField defaultValue={checkin?.note} />
      <Actions deleteAction={checkin ? deleteCheckin : undefined} id={checkin?.id} />
    </form>
  );
}

export function WorkoutForm({ workout }: { workout?: Workout }) {
  return (
    <form
      action={workout ? updateWorkout : createWorkout}
      className="grid max-w-3xl gap-4 sm:grid-cols-3"
    >
      {workout ? <input type="hidden" name="id" value={workout.id} /> : null}
      <Field label="Date">
        <DateInput name="performedOn" defaultValue={dateValue(workout?.performedAt)} required />
      </Field>
      <Field label="Time">
        <Input name="performedTime" type="time" defaultValue={timeValue(workout?.performedAt)} />
      </Field>
      <Field label="Kind">
        <NativeSelect name="kind" defaultValue={workout?.kind ?? "strength"}>
          <option value="strength">Strength</option>
          <option value="cardio">Cardio</option>
          <option value="mobility">Mobility</option>
          <option value="sport">Sport</option>
          <option value="other">Other</option>
        </NativeSelect>
      </Field>
      <Field label="Minutes">
        <Input
          name="minutes"
          type="number"
          min={1}
          max={1440}
          step={1}
          required
          defaultValue={workout?.minutes ?? ""}
        />
      </Field>
      <Field label="Intensity">
        <Input
          name="intensity"
          type="number"
          min={1}
          max={5}
          step={1}
          defaultValue={workout?.intensity ?? ""}
        />
      </Field>
      <TextField defaultValue={workout?.note} />
      <Actions deleteAction={workout ? deleteWorkout : undefined} id={workout?.id} />
    </form>
  );
}

export function BodyMeasurementForm({ measurement }: { measurement?: BodyMeasurement }) {
  return (
    <form
      action={measurement ? updateBodyMeasurement : createBodyMeasurement}
      className="grid max-w-3xl gap-4 sm:grid-cols-3"
    >
      {measurement ? <input type="hidden" name="id" value={measurement.id} /> : null}
      <DateTimeFields
        date={dateValue(measurement?.recordedAt)}
        time={timeValue(measurement?.recordedAt)}
      />
      <Field label="Weight lbs">
        <Input
          name="weightLb"
          type="number"
          min={0}
          max={1100}
          step={0.1}
          defaultValue={
            measurement?.weightKg === undefined || measurement.weightKg === null
              ? ""
              : kgToLb(Number(measurement.weightKg)).toFixed(1)
          }
        />
      </Field>
      <Field label="Body fat %">
        <Input
          name="bodyFatPct"
          type="number"
          min={0}
          max={100}
          step={0.1}
          defaultValue={measurement?.bodyFatPct ?? ""}
        />
      </Field>
      <Field label="Waist cm">
        <Input
          name="waistCm"
          type="number"
          min={0}
          max={300}
          step={0.1}
          defaultValue={measurement?.waistCm ?? ""}
        />
      </Field>
      <Field label="Resting HR">
        <Input
          name="restingHr"
          type="number"
          min={20}
          max={200}
          step={1}
          defaultValue={measurement?.restingHr ?? ""}
        />
      </Field>
      <TextField defaultValue={measurement?.note} />
      <Actions
        deleteAction={measurement ? deleteBodyMeasurement : undefined}
        id={measurement?.id}
      />
    </form>
  );
}

function DateTimeFields({ date, time }: { date?: string; time?: string }) {
  return (
    <>
      <Field label="Date">
        <DateInput name="recordedOn" defaultValue={date} required />
      </Field>
      <Field label="Time">
        <Input name="recordedTime" type="time" defaultValue={time ?? ""} />
      </Field>
    </>
  );
}

function TextField({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <Field label="Note" className="sm:col-span-3">
      <Input name="note" maxLength={500} defaultValue={defaultValue ?? ""} />
    </Field>
  );
}

function Actions({
  deleteAction,
  id,
}: {
  deleteAction?: (formData: FormData) => void | Promise<void>;
  id?: string;
}) {
  return (
    <div className="flex gap-3 sm:col-span-3">
      <Button type="submit">Save</Button>
      {deleteAction && id ? (
        <Button type="submit" formAction={deleteAction}>
          Delete
        </Button>
      ) : null}
    </div>
  );
}

function dateValue(date?: Date) {
  return date?.toISOString().slice(0, 10);
}

function timeValue(date?: Date) {
  return date?.toTimeString().slice(0, 5);
}
