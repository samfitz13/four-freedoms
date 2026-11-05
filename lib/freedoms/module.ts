import type { FreedomModule } from "./types";

/**
 * Identity helper so per-freedom module exports are initialized by a call
 * expression (kept to satisfy the `constants-file-organization` lint rule).
 */
export function defineFreedomModule(module: FreedomModule): FreedomModule {
  return module;
}
