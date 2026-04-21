/**
 * The freedom module registry. Import everything app-facing from here.
 * Types + metadata live in `./types.ts` to avoid circular imports.
 */
export * from "./types";

import type { FreedomKey, FreedomModule } from "./types";
import { financialModule } from "./financial";
import { locationModule } from "./location";
import { timeModule } from "./time";
import { healthModule } from "./health";

export const freedomModules: Record<FreedomKey, FreedomModule<Record<string, unknown>>> = {
  financial: financialModule,
  location: locationModule,
  time: timeModule,
  health: healthModule,
};

export function getFreedomModule<K extends FreedomKey>(key: K) {
  return freedomModules[key];
}
