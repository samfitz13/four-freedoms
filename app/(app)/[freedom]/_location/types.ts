import type { LOCATION_TABS } from "./constants";
import type { listPlaces, listTrips, listTripStays } from "@/lib/db/queries/location";

export type LocationTab = (typeof LOCATION_TABS)[number]["key"];
export type TravelTrip = Awaited<ReturnType<typeof listTrips>>[number];
export type TravelStay = Awaited<ReturnType<typeof listTripStays>>[number];
export type TravelPlace = Pick<
  Awaited<ReturnType<typeof listPlaces>>[number],
  "id" | "name" | "country"
>;
