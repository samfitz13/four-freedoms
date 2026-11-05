import "server-only";
import type { Correspondence, TodayStrip } from "./types";
import { financialLocationCorrespondences } from "./financial-location";
import { financialTimeCorrespondences, todayVestNotes } from "./financial-time";
import { locationTimeCorrespondences, todayLocationTimeStrip } from "./location-time";
import { locationHealthCorrespondences, todaySleepStrip } from "./location-health";
import { timeHealthCorrespondences } from "./time-health";
import { computeFinancialSummary } from "@/lib/freedoms/financial-summary";

export type { Correspondence, TodayStrip } from "./types";

export async function computeCorrespondences(
  householdId: string,
  today: Date = new Date(),
): Promise<Correspondence[]> {
  const groups = await Promise.all([
    financialLocationCorrespondences(householdId, today),
    financialTimeCorrespondences(householdId, today),
    locationTimeCorrespondences(householdId, today),
    locationHealthCorrespondences(householdId, today),
    timeHealthCorrespondences(householdId, today),
  ]);
  return groups.flat();
}

export async function computeTodayStrip(
  householdId: string,
  masthead: string,
  today: Date = new Date(),
): Promise<TodayStrip & { notes: string[] }> {
  const [locationTime, sleep, financial, notes] = await Promise.all([
    todayLocationTimeStrip(householdId, today),
    todaySleepStrip(householdId, today),
    computeFinancialSummary(householdId, today),
    todayVestNotes(householdId, today),
  ]);
  return {
    masthead,
    place: locationTime.place,
    sleepHours: sleep.sleepHours,
    deepWorkHours: locationTime.deepWorkHours,
    netWorth: financial.netWorth,
    notes,
  };
}
