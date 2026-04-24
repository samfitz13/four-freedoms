/**
 * The freedom module registry. Import everything app-facing from here.
 * Types live in `./types.ts` and runtime metadata in `./constants.ts` to
 * satisfy our file-organization lint rules.
 */
export * from "./types";
export * from "./constants";

import type { FreedomKey, FreedomModule } from "./types";
import { financialModule } from "./financial";
import { healthModule } from "./health";
import { locationModule } from "./location";
import { timeModule } from "./time";

export const freedomModules: Record<
  FreedomKey,
  FreedomModule<Record<string, unknown>>
> = Object.freeze({
  financial: financialModule,
  location: locationModule,
  time: timeModule,
  health: healthModule,
});

export function getFreedomModule<K extends FreedomKey>(key: K) {
  return freedomModules[key];
}
