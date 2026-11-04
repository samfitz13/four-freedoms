"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronDown, MapPin, Plus, Search } from "lucide-react";
import { InlineConfirmDelete } from "@/components/ui/inline-confirm-delete";
import { archiveTrip } from "./travel-actions";
import { StayForm } from "./stay-form";
import { TripForm } from "./trip-form";
import { daysBetween, travelBudget, travelDate, travelHistory, tripPhase } from "./travel-view";
import type { TravelPlace, TravelStay, TravelTrip } from "./types";

export function TravelWorkspace({
  trips,
  stays,
  places,
  today,
}: {
  trips: TravelTrip[];
  stays: TravelStay[];
  places: TravelPlace[];
  today: string;
}) {
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const formId = useId();
  const history = travelHistory(trips, stays, today);
  const upcoming = trips.filter((trip) => tripPhase(trip, today) !== "past");
  const past = trips.filter((trip) => tripPhase(trip, today) === "past");
  const nextTrip = [...upcoming].sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0];
  const staysByTrip = new Map<string, TravelStay[]>();
  for (const stay of stays) {
    if (!stay.tripId) continue;
    const rows = staysByTrip.get(stay.tripId) ?? [];
    rows.push(stay);
    staysByTrip.set(stay.tripId, rows);
  }
  const years = Array.from(
    new Set(
      trips.flatMap((trip) => {
        const start = Number(trip.startsOn.slice(0, 4));
        const end = Number(trip.endsOn.slice(0, 4));
        return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) =>
          String(start + index),
        );
      }),
    ),
  )
    .sort()
    .reverse();
  const query = search.trim().toLocaleLowerCase();
  const visible = trips
    .filter((trip) => {
      const phase = tripPhase(trip, today);
      if (view === "upcoming" && phase === "past") return false;
      if (view === "past" && phase !== "past") return false;
      if (year && (trip.startsOn > `${year}-12-31` || trip.endsOn < `${year}-01-01`)) return false;
      const destinations = (staysByTrip.get(trip.id) ?? [])
        .map((stay) => `${stay.placeName} ${stay.country ?? ""}`)
        .join(" ");
      return `${trip.name} ${trip.purpose} ${destinations} ${trip.notes ?? ""}`
        .toLocaleLowerCase()
        .includes(query);
    })
    .sort((a, b) =>
      view === "past" ? b.startsOn.localeCompare(a.startsOn) : a.startsOn.localeCompare(b.startsOn),
    );

  return (
    <div className="flex min-w-0 flex-col gap-7">
      <header className="daybreak-section-head flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl tracking-tight">Travel</h2>
          <p className="mt-2 max-w-xl text-sm text-[color:var(--color-ink-soft)]">
            See what&apos;s ahead. Keep the places you&apos;ve been.
          </p>
        </div>
        <button
          type="button"
          className="daybreak-button daybreak-button-primary"
          aria-expanded={creating}
          aria-controls={formId}
          onClick={() => setCreating(!creating)}
        >
          <Plus size={16} aria-hidden />
          {creating ? "Close new trip" : "Plan a trip"}
        </button>
      </header>

      {creating ? (
        <section id={formId} className="daybreak-panel p-5 sm:p-6" aria-label="Plan a trip">
          <h3 className="font-display text-xl">A new journey</h3>
          <p className="mt-2 mb-5 text-sm text-[color:var(--color-ink-soft)]">
            Start with a destination and dates. You can add more stops later.
          </p>
          {places.length ? (
            <TripForm places={places} />
          ) : (
            <p className="text-sm">
              Save your destination in Places first.{" "}
              <Link
                className="inline-flex min-h-11 items-center gap-2 underline underline-offset-4"
                href="/location/places"
              >
                Add a place <ArrowRight size={14} aria-hidden />
              </Link>
            </p>
          )}
        </section>
      ) : null}

      <dl className="grid grid-cols-1 gap-4 border-b border-[color:var(--color-border)] pb-6 min-[440px]:grid-cols-3">
        <TravelMetric
          label="Trips ahead"
          value={upcoming.length}
          detail="Including trips underway"
        />
        <TravelMetric
          label="Travel days logged"
          value={history.days}
          detail="Elapsed days, counted once"
        />
        <TravelMetric
          label="Countries visited"
          value={history.countries}
          detail={`${history.destinations} ${history.destinations === 1 ? "destination" : "destinations"} in saved stays`}
        />
      </dl>

      <section aria-label="Your trips" className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="daybreak-tabs" role="group" aria-label="Filter trips">
            {[
              { key: "upcoming", label: "Upcoming", count: upcoming.length },
              { key: "past", label: "Past", count: past.length },
              { key: "all", label: "All trips", count: trips.length },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                className={`daybreak-tab ${view === option.key ? "daybreak-tab-active" : ""}`}
                aria-pressed={view === option.key}
                onClick={() => setView(option.key)}
              >
                {option.label} <span className="ml-2 tabular-nums">{option.count}</span>
              </button>
            ))}
          </div>
          <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto">
            <label className="relative min-w-0 flex-1 sm:w-56">
              <span className="sr-only">Search trips and destinations</span>
              <Search
                size={16}
                className="pointer-events-none absolute top-3.5 left-3"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search destinations or trips"
                className="daybreak-field w-full min-w-0 pl-9 text-sm"
              />
            </label>
            <label>
              <span className="sr-only">Trip year</span>
              <select
                className="daybreak-field text-sm"
                value={year}
                onChange={(event) => setYear(event.target.value)}
              >
                <option value="">All years</option>
                {years.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <p className="sr-only" role="status">
          {visible.length} trips shown
        </p>
        {visible.length ? (
          <div className="divide-y divide-[color:var(--color-border)] border-y border-[color:var(--color-border)]">
            {visible.map((trip) => (
              <TripRow
                key={trip.id}
                trip={trip}
                stays={staysByTrip.get(trip.id) ?? []}
                places={places}
                today={today}
                next={trip.id === nextTrip?.id}
              />
            ))}
          </div>
        ) : (
          <div className="daybreak-panel px-5 py-10 sm:px-8">
            <MapPin size={22} className="mb-4 text-[color:var(--color-ink-soft)]" aria-hidden />
            <h3 className="font-display text-xl">
              {!trips.length
                ? "Where would you like to go?"
                : search || year
                  ? "No matching trips"
                  : view === "past"
                    ? "Your travel history starts here"
                    : "Room for another journey"}
            </h3>
            <p className="mt-2 max-w-lg text-sm text-[color:var(--color-ink-soft)]">
              {!trips.length
                ? "Plan a getaway or record a past trip. Your destinations, dates, and budget will stay together here."
                : search || year
                  ? "Try another destination, trip name, or year."
                  : view === "past"
                    ? "Completed trips will appear here after their end date."
                    : "Nothing upcoming yet. Plan your next trip, or revisit the places you’ve been."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {search || year ? (
                <button
                  className="daybreak-button"
                  onClick={() => {
                    setSearch("");
                    setYear("");
                  }}
                >
                  Clear filters
                </button>
              ) : (
                <button className="daybreak-button" onClick={() => setCreating(true)}>
                  Plan a trip
                </button>
              )}
              {view === "upcoming" && past.length ? (
                <button className="daybreak-button" onClick={() => setView("past")}>
                  View past trips
                </button>
              ) : null}
            </div>
          </div>
        )}
      </section>
      <p className="text-xs text-[color:var(--color-ink-soft)]">
        Travel history uses elapsed stays on unarchived trips. Future dates don&apos;t count as
        visits. Budgets are plans, not recorded spending.
      </p>
    </div>
  );
}

function TravelMetric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-[color:var(--color-ink-soft)]">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
      <dd className="mt-1 text-xs text-[color:var(--color-ink-soft)]">{detail}</dd>
    </div>
  );
}

function TripRow({
  trip,
  stays,
  places,
  today,
  next,
}: {
  trip: TravelTrip;
  stays: TravelStay[];
  places: TravelPlace[];
  today: string;
  next: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [archiveError, setArchiveError] = useState(false);
  const editId = useId();
  const phase = tripPhase(trip, today);
  const nights = daysBetween(trip.startsOn, trip.endsOn);
  const destinations = Array.from(
    new Set(stays.map((stay) => `${stay.placeName}${stay.country ? `, ${stay.country}` : ""}`)),
  );
  const budget = travelBudget(trip.budgetAmount, trip.currency);
  const until = daysBetween(today, trip.startsOn);
  const orderedStays = [...stays].sort((a, b) => a.startedOn.localeCompare(b.startedOn));

  return (
    <article className="min-w-0 py-6">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[color:var(--color-ink-soft)]">
        <span
          className={
            phase === "current"
              ? "daybreak-inset px-3 py-1 font-semibold text-[color:var(--color-ink)]"
              : ""
          }
        >
          {phase === "current"
            ? "Underway"
            : phase === "past"
              ? "Past trip"
              : next
                ? "Next departure"
                : "Upcoming"}
        </span>
        <span className="capitalize">{trip.purpose}</span>
        {phase === "upcoming" ? (
          <span>
            In {until} {until === 1 ? "day" : "days"}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-60">
          <h3 className="font-display text-xl tracking-tight break-words sm:text-2xl">
            {trip.name}
          </h3>
          <p className="mt-2 flex items-start gap-2 text-sm text-[color:var(--color-ink-soft)]">
            <MapPin size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span className="break-words">
              {destinations.length ? destinations.join(" → ") : "No destination stays yet"}
            </span>
          </p>
        </div>
        <div className="text-sm sm:text-right">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
            <CalendarDays size={15} aria-hidden />
            <span>{travelDate(trip.startsOn)}</span>
            <span aria-hidden>–</span>
            <span>{travelDate(trip.endsOn)}</span>
          </p>
          <p className="mt-2 text-[color:var(--color-ink-soft)]">
            {nights === 0 ? "Day trip" : `${nights} ${nights === 1 ? "night" : "nights"}`}
            {" · "}
            {budget ? `Budget ${budget}` : "No budget set"}
          </p>
        </div>
      </div>
      <details className="group mt-4" open={next || undefined}>
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 text-sm font-medium">
          <ChevronDown size={16} className="shrink-0 -rotate-90 group-open:rotate-0" aria-hidden />
          Itinerary & details{" "}
          <span className="font-normal text-[color:var(--color-ink-soft)]">
            ({stays.length} {stays.length === 1 ? "stay" : "stays"})
          </span>
        </summary>
        <div className="mt-3 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,0.65fr)]">
          <div className="min-w-0">
            {orderedStays.length ? (
              <ol className="flex flex-col gap-4 border-l border-[color:var(--color-border)] pl-5">
                {orderedStays.map((stay, index) => (
                  <li key={stay.id} className="min-w-0">
                    <p className="text-sm font-medium break-words">
                      <span className="mr-2 text-[color:var(--color-ink-soft)]">{index + 1}.</span>
                      {stay.placeName}
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                      {stay.country ? `${stay.country} · ` : ""}
                      {travelDate(stay.startedOn)} –{" "}
                      {stay.endedOn ? travelDate(stay.endedOn) : "Open-ended"}
                    </p>
                    {stay.note ? (
                      <p className="mt-2 text-sm break-words whitespace-pre-wrap">{stay.note}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-[color:var(--color-ink-soft)]">
                Add your first stop to give this trip a destination.
              </p>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-medium">Trip notes</h4>
            <p className="mt-2 text-sm break-words whitespace-pre-wrap text-[color:var(--color-ink-soft)]">
              {trip.notes || "No notes yet. Edit the trip to keep useful details here."}
            </p>
          </div>
        </div>
        <details className="mt-5 border-t border-[color:var(--color-border)] pt-2">
          <summary className="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm">
            Add a stop
          </summary>
          <div className="py-3">
            <StayForm
              places={places}
              trips={[trip]}
              tripId={trip.id}
              defaultStartedOn={trip.startsOn}
              defaultEndedOn={trip.endsOn}
            />
          </div>
        </details>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="daybreak-button"
            aria-expanded={editing}
            aria-controls={editId}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Close edit" : "Edit trip"}
          </button>
          <InlineConfirmDelete
            id={trip.id}
            armLabel="Archive trip"
            confirmLabel="Confirm archive"
            ariaLabel={`Archive ${trip.name}`}
            action={async (formData) => {
              setArchiveError(false);
              try {
                await archiveTrip(formData);
              } catch {
                setArchiveError(true);
              }
            }}
          />
        </div>
        {archiveError ? (
          <p role="alert" className="mt-3 text-sm">
            Couldn&apos;t archive the trip. Please try again.
          </p>
        ) : null}
        {editing ? (
          <section
            id={editId}
            className="mt-5 border-t border-[color:var(--color-border)] pt-5"
            aria-label={`Edit ${trip.name}`}
          >
            <TripForm places={places} trip={trip} />
          </section>
        ) : null}
      </details>
    </article>
  );
}
