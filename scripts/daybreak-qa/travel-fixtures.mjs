// Synthetic trips for disconnected component checks. Never saved to the application.
export function travelFixtures() {
  const places = [
    { id: "qa-lisbon", name: "Lisbon", country: "Portugal" },
    { id: "qa-porto", name: "Porto", country: "Portugal" },
    { id: "qa-kyoto", name: "Kyoto", country: "Japan" },
  ];
  const trips = [
    {
      id: "qa-autumn",
      name: "A slower autumn",
      purpose: "vacation",
      startsOn: "2026-10-25",
      endsOn: "2026-11-04",
      budgetAmount: "2400",
      currency: "EUR",
      notes: "A few days in each city. Leave room for an unplanned afternoon.",
    },
    {
      id: "qa-spring",
      name: "Spring in Kyoto",
      purpose: "family",
      startsOn: "2027-04-04",
      endsOn: "2027-04-15",
      budgetAmount: null,
      currency: "USD",
      notes: null,
    },
    {
      id: "qa-past",
      name: "A summer by the river",
      purpose: "retreat",
      startsOn: "2026-06-10",
      endsOn: "2026-06-17",
      budgetAmount: "0",
      currency: "USD",
      notes: "Stayed with friends.",
    },
  ];
  const stays = [
    {
      id: "qa-first",
      tripId: "qa-autumn",
      placeId: "qa-lisbon",
      placeName: "Lisbon",
      country: "Portugal",
      startedOn: "2026-10-25",
      endedOn: "2026-10-30",
      note: null,
    },
    {
      id: "qa-second",
      tripId: "qa-autumn",
      placeId: "qa-porto",
      placeName: "Porto",
      country: "Portugal",
      startedOn: "2026-10-30",
      endedOn: "2026-11-04",
      note: null,
    },
    {
      id: "qa-spring-stay",
      tripId: "qa-spring",
      placeId: "qa-kyoto",
      placeName: "Kyoto",
      country: "Japan",
      startedOn: "2027-04-04",
      endedOn: "2027-04-15",
      note: null,
    },
    {
      id: "qa-old-stay",
      tripId: "qa-past",
      placeId: "qa-porto",
      placeName: "Porto",
      country: "Portugal",
      startedOn: "2026-06-10",
      endedOn: "2026-06-17",
      note: null,
    },
  ];
  return { places, trips, stays };
}
