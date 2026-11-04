import type { TravelStay, TravelTrip } from "./types";

export function validTravelDates(start: string, end: string): boolean {
  return (
    [start, end].every((value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(value + "T00:00:00Z");
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }) && end >= start
  );
}

export function tripPhase(trip: Pick<TravelTrip, "startsOn" | "endsOn">, today: string) {
  if (trip.endsOn < today) return "past";
  if (trip.startsOn > today) return "upcoming";
  return "current";
}

export function daysBetween(start: string, end: string): number {
  return Math.max(
    0,
    Math.round((Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86_400_000),
  );
}

export function travelDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T00:00:00Z"));
}

export function travelBudget(amount: string | null, currency: string): string | null {
  if (amount === null) return null;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

/** Count elapsed calendar days once, even when stays overlap. Future plans are not history. */
export function travelHistory(trips: TravelTrip[], stays: TravelStay[], today: string) {
  const activeIds = new Set(trips.map((trip) => trip.id));
  const ranges: [string, string][] = [];
  const countries = new Set<string>();
  const destinations = new Set<string>();
  for (const stay of stays) {
    if (!stay.tripId || !activeIds.has(stay.tripId) || stay.startedOn > today) continue;
    const end = stay.endedOn && stay.endedOn < today ? stay.endedOn : today;
    if (end < stay.startedOn) continue;
    ranges.push([stay.startedOn, end]);
    if (stay.country) countries.add(stay.country);
    destinations.add(stay.placeId);
  }
  ranges.sort(([a], [b]) => a.localeCompare(b));
  let days = 0;
  let previousEnd: string | null = null;
  for (const [start, end] of ranges) {
    if (previousEnd !== null && end <= previousEnd) continue;
    days +=
      previousEnd !== null && start <= previousEnd
        ? daysBetween(previousEnd, end)
        : daysBetween(start, end) + 1;
    previousEnd = end;
  }
  return { days, countries: countries.size, destinations: destinations.size };
}
