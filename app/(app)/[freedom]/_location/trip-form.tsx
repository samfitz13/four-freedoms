"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { startTransition, useActionState, useState } from "react";
import { Field } from "@/components/ui/field";
import { DateInput } from "@/components/ui/date-input";
import { createTrip, updateTrip } from "./travel-actions";
import type { TravelTrip } from "./types";
import { validTravelDates } from "./travel-view";

type PlaceOption = { id: string; name: string; country: string | null };

export function TripForm({ places, trip }: { places: PlaceOption[]; trip?: TravelTrip }) {
  const [fields, setFields] = useState({
    name: trip?.name ?? "",
    purpose: String(trip?.purpose ?? "vacation"),
    placeId: "",
    budgetAmount: trip?.budgetAmount ?? "",
    currency: trip?.currency ?? "USD",
    notes: trip?.notes ?? "",
  });
  const [message, action, pending] = useActionState(
    async (_previous: string, formData: FormData) => {
      const start = String(formData.get("startsOn") ?? "");
      const end = String(formData.get("endsOn") ?? "");
      if (!validTravelDates(start, end))
        return "Choose valid dates. The end must be on or after the start.";
      try {
        if (trip) await updateTrip(formData);
        else await createTrip(formData);
        return trip ? "Trip updated." : "Trip added. You can find it in Upcoming or Past.";
      } catch {
        return "Couldn't save the trip. Your changes haven't been saved. Please try again.";
      }
    },
    "",
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
    >
      {trip ? <input type="hidden" name="id" value={trip.id} /> : null}
      <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field label="Trip name">
          <Input
            name="name"
            required
            maxLength={120}
            value={fields.name}
            onChange={(event) => setFields({ ...fields, name: event.target.value })}
            placeholder="e.g. A week in Lisbon"
          />
        </Field>
        <Field label="Purpose">
          <NativeSelect
            name="purpose"
            aria-label="Purpose"
            value={fields.purpose}
            onChange={(event) => setFields({ ...fields, purpose: event.target.value })}
          >
            <option value="vacation">Vacation</option>
            <option value="family">Family</option>
            <option value="work">Work</option>
            <option value="medical">Medical</option>
            <option value="retreat">Retreat</option>
            <option value="other">Other</option>
          </NativeSelect>
        </Field>
        {!trip ? (
          <Field label="First destination" className="sm:col-span-2">
            <NativeSelect
              name="placeId"
              aria-label="First destination"
              required
              value={fields.placeId}
              onChange={(event) => setFields({ ...fields, placeId: event.target.value })}
            >
              <option value="">{places.length ? "Choose destination" : "Add a place first"}</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                  {place.country ? ` · ${place.country}` : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
        <Field label="Start date">
          <DateInput name="startsOn" defaultValue={trip?.startsOn} required />
        </Field>
        <Field label="End date">
          <DateInput name="endsOn" defaultValue={trip?.endsOn} required />
        </Field>
        <Field label="Planned budget (optional)">
          <Input
            name="budgetAmount"
            type="number"
            min="0"
            step="0.01"
            value={fields.budgetAmount}
            onChange={(event) => setFields({ ...fields, budgetAmount: event.target.value })}
            placeholder="Not set"
          />
        </Field>
        <Field label="Currency">
          <Input
            name="currency"
            required
            minLength={3}
            maxLength={3}
            pattern="[A-Za-z]{3}"
            title="Three-letter currency code, e.g. USD or EUR"
            value={fields.currency}
            onChange={(event) => setFields({ ...fields, currency: event.target.value })}
            className="uppercase"
          />
        </Field>
        <Field label="Notes (optional)" className="sm:col-span-2">
          <Textarea
            name="notes"
            rows={3}
            maxLength={500}
            value={fields.notes}
            onChange={(event) => setFields({ ...fields, notes: event.target.value })}
            placeholder="What would be useful to remember?"
          />
        </Field>
        {trip ? (
          <p className="text-xs text-[color:var(--color-ink-soft)] sm:col-span-2">
            Trip dates don&apos;t change individual stay dates. Add a stop in the itinerary for
            another destination.
          </p>
        ) : null}
        <Button type="submit" variant="primary" className="justify-self-start">
          {pending ? "Saving…" : trip ? "Save changes" : "Add trip"}
        </Button>
      </fieldset>
      {message ? (
        <p role="status" className="mt-4 text-sm">
          {message}
        </p>
      ) : null}
    </form>
  );
}
