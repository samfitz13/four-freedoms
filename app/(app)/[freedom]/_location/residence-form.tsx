"use client";

import { useState } from "react";
import { DateInput } from "@/components/ui/date-input";
import { createResidence, moveResidence, updateResidence } from "./residence-actions";

type PlaceOption = { id: string; name: string; country: string | null };
type ResidenceTenure = "rent" | "own" | "other";
type ResidenceRole = "primary" | "secondary" | "former";

type ResidenceOption = {
  id: string;
  placeId: string;
  role: ResidenceRole;
  tenure: ResidenceTenure;
  startedOn: string;
  endedOn: string | null;
  householdSharePct: string;
  costPerMonth: string | null;
  currency: string;
  landlord: string | null;
  notes: string | null;
};

export function ResidenceForm({ places }: { places: PlaceOption[] }) {
  const [tenure, setTenure] = useState<ResidenceTenure>("rent");
  const costLabel = tenure === "rent" ? "Rent / mo" : "Housing cost / mo";

  return (
    <form action={createResidence} className="daybreak-panel grid gap-4 p-6 sm:grid-cols-6">
      <Field label="Place" className="sm:col-span-2">
        <PlaceSelect places={places} />
      </Field>
      <Field label="Role">
        <select name="role" className={controlClass} defaultValue="primary">
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="former">Former</option>
        </select>
      </Field>
      <Field label="Tenure">
        <select
          name="tenure"
          className={controlClass}
          value={tenure}
          onChange={(event) => setTenure(event.target.value as ResidenceTenure)}
        >
          <option value="rent">Rent</option>
          <option value="own">Own</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Started">
        <DateInput name="startedOn" required className={controlClass} />
      </Field>
      <Field label="Share %">
        <input
          name="householdSharePct"
          type="number"
          min="0"
          max="100"
          step="0.01"
          defaultValue="100"
          className={controlClass}
        />
      </Field>
      <Field label={costLabel}>
        <input name="costPerMonth" type="number" min="0" step="0.01" className={controlClass} />
      </Field>
      {tenure === "rent" ? (
        <Field label="Landlord" className="sm:col-span-2">
          <input name="landlord" maxLength={200} className={controlClass} />
        </Field>
      ) : null}
      <Field label="Notes" className={tenure === "rent" ? "sm:col-span-3" : "sm:col-span-5"}>
        <input name="notes" maxLength={500} className={controlClass} />
      </Field>
      <button
        type="submit"
        className="daybreak-button self-end border border-[color:var(--color-border)] px-3 py-2 font-sans text-xs tracking-normal"
      >
        Add
      </button>
    </form>
  );
}

export function ResidenceEditForm({
  places,
  residence,
}: {
  places: PlaceOption[];
  residence: ResidenceOption;
}) {
  const [tenure, setTenure] = useState<ResidenceTenure>(residence.tenure);
  const costLabel = tenure === "rent" ? "Rent / mo" : "Housing cost / mo";

  return (
    <form
      action={updateResidence}
      className="mt-4 grid gap-4 border-t border-[color:var(--color-border)] pt-4 sm:grid-cols-6"
    >
      <input type="hidden" name="id" value={residence.id} />
      <Field label="Place" className="sm:col-span-2">
        <PlaceSelect places={places} defaultValue={residence.placeId} />
      </Field>
      <Field label="Role">
        <select name="role" className={controlClass} defaultValue={residence.role}>
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="former">Former</option>
        </select>
      </Field>
      <Field label="Tenure">
        <select
          name="tenure"
          className={controlClass}
          value={tenure}
          onChange={(event) => setTenure(event.target.value as ResidenceTenure)}
        >
          <option value="rent">Rent</option>
          <option value="own">Own</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Started">
        <DateInput
          name="startedOn"
          required
          defaultValue={residence.startedOn}
          className={controlClass}
        />
      </Field>
      <Field label="Ended">
        <DateInput name="endedOn" defaultValue={residence.endedOn} className={controlClass} />
      </Field>
      <Field label="Share %">
        <input
          name="householdSharePct"
          type="number"
          min="0"
          max="100"
          step="0.01"
          defaultValue={residence.householdSharePct}
          className={controlClass}
        />
      </Field>
      <Field label={costLabel}>
        <input
          name="costPerMonth"
          type="number"
          min="0"
          step="0.01"
          defaultValue={residence.costPerMonth ?? ""}
          className={controlClass}
        />
      </Field>
      <Field label="Currency">
        <input
          name="currency"
          maxLength={3}
          defaultValue={residence.currency}
          className={controlClass}
        />
      </Field>
      {tenure === "rent" ? (
        <Field label="Landlord" className="sm:col-span-2">
          <input
            name="landlord"
            maxLength={200}
            defaultValue={residence.landlord ?? ""}
            className={controlClass}
          />
        </Field>
      ) : null}
      <Field label="Notes" className={tenure === "rent" ? "sm:col-span-4" : "sm:col-span-6"}>
        <input
          name="notes"
          maxLength={500}
          defaultValue={residence.notes ?? ""}
          className={controlClass}
        />
      </Field>
      <button
        type="submit"
        className="daybreak-button self-end border border-[color:var(--color-border)] px-3 py-2 font-sans text-xs tracking-normal"
      >
        Save
      </button>
    </form>
  );
}

export function ResidenceEditDisclosure({
  places,
  residence,
}: {
  places: PlaceOption[];
  residence: ResidenceOption;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="sm:col-span-3">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
      >
        {isOpen ? "Cancel edit" : "Edit"}
      </button>
      {isOpen ? <ResidenceEditForm places={places} residence={residence} /> : null}
    </div>
  );
}

export function MoveResidenceForm({ places }: { places: PlaceOption[] }) {
  return (
    <form action={moveResidence} className="flex flex-wrap items-end gap-4">
      <Field label="New primary">
        <PlaceSelect places={places} />
      </Field>
      <Field label="Move date">
        <DateInput name="startedOn" required className={controlClass} />
      </Field>
      <button
        type="submit"
        className="daybreak-button border border-[color:var(--color-border)] px-3 py-2 font-sans text-xs tracking-normal"
      >
        I moved
      </button>
    </form>
  );
}

function PlaceSelect({ places, defaultValue }: { places: PlaceOption[]; defaultValue?: string }) {
  return (
    <select name="placeId" required className={controlClass} defaultValue={defaultValue ?? ""}>
      <option value="">Choose place</option>
      {places.map((place) => (
        <option key={place.id} value={place.id}>
          {place.name}
          {place.country ? ` · ${place.country}` : ""}
        </option>
      ))}
    </select>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={["flex flex-col gap-1 text-sm", className].filter(Boolean).join(" ")}>
      <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {label}
      </span>
      {children}
    </label>
  );
}

const controlClass =
  "daybreak-field w-full border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-1 py-1 text-sm focus:border-[color:var(--color-foreground)]";
