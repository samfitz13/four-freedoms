"use client";

import { startTransition, useActionState, useState } from "react";
import { validTravelDates } from "./travel-view";
import { DateInput } from "@/components/ui/date-input";
import { upsertStay } from "./travel-actions";

type PlaceOption = { id: string; name: string; country: string | null };
type TripOption = { id: string; name: string };

export function StayForm({
  places,
  trips,
  tripId,
  defaultStartedOn,
  defaultEndedOn,
}: {
  places: PlaceOption[];
  trips: TripOption[];
  tripId?: string;
  defaultStartedOn?: string;
  defaultEndedOn?: string;
}) {
  const [selectedPlace, setSelectedPlace] = useState("");
  const [selectedTrip, setSelectedTrip] = useState(tripId ?? "");
  const [message, action, pending] = useActionState(
    async (_previous: string, formData: FormData) => {
      const start = String(formData.get("startedOn") ?? "");
      const end = String(formData.get("endedOn") ?? "");
      if (!validTravelDates(start, end || start))
        return "Choose valid dates. The end date must be on or after the start date.";
      try {
        await upsertStay(formData);
        return "Stay saved.";
      } catch {
        return "Couldn't save the stay. Please try again.";
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
      <input type="hidden" name="kind" value={tripId || selectedTrip ? "trip" : "other"} />
      {tripId ? <input type="hidden" name="tripId" value={tripId} /> : null}
      <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        {!tripId ? (
          <Field label="Trip">
            <select
              name="tripId"
              aria-label="Trip"
              value={selectedTrip}
              onChange={(event) => setSelectedTrip(event.target.value)}
              className={controlClass}
            >
              <option value="">No trip</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label={tripId ? "Destination" : "Place"}>
          <select
            name="placeId"
            aria-label={tripId ? "Destination" : "Place"}
            required
            value={selectedPlace}
            onChange={(event) => setSelectedPlace(event.target.value)}
            className={controlClass}
          >
            <option value="">Choose place</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
                {place.country ? ` · ${place.country}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Starts">
          <DateInput
            name="startedOn"
            required
            defaultValue={defaultStartedOn}
            className={controlClass}
          />
        </Field>
        <Field label="Ends">
          <DateInput name="endedOn" defaultValue={defaultEndedOn} className={controlClass} />
        </Field>
        <button
          type="submit"
          className="daybreak-button self-end justify-self-start disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add stay"}
        </button>
      </fieldset>
      {message ? (
        <p className="mt-3 text-sm" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-sm">
      <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {label}
      </span>
      {children}
    </label>
  );
}

const controlClass = "daybreak-field w-full min-w-0 text-sm";
