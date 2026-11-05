import { listPlaces, listTrips, listTripStays } from "@/lib/db/queries/location";
import { TravelWorkspace } from "./travel-workspace";

export async function LocationTravelTab({ householdId }: { householdId: string }) {
  const [trips, stays, places] = await Promise.all([
    listTrips(householdId),
    listTripStays(householdId),
    listPlaces(householdId),
  ]);

  return (
    <TravelWorkspace
      trips={trips}
      stays={stays}
      places={places}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
