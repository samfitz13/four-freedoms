import type { DailyPoint, FreedomKey } from "@/lib/freedoms/types";

export type Correspondence = {
  key: string;
  pair: [FreedomKey, FreedomKey];
  sentence: string;
  series?: DailyPoint[];
  href?: string;
};

export type TodayStrip = {
  masthead: string;
  place: string | null;
  sleepHours: number | null;
  deepWorkHours: number | null;
  netWorth: number | null;
};
