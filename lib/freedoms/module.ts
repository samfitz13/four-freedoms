import type { FreedomModule } from "./types";

/**
 * Identity helper. Exists purely so that per-freedom module exports are
 * initialized by a call expression (the one concession our
 * `constants-file-organization` lint rule offers for module objects that
 * legitimately belong next to their logic rather than in `constants.ts`).
 */
export function defineFreedomModule<Payload extends Record<string, unknown>>(
  module: FreedomModule<Payload>,
): FreedomModule<Payload> {
  return module;
}
