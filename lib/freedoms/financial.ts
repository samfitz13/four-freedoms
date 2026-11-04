import { freedomMetas } from "./constants";
import { defineFreedomModule } from "./module";

/**
 * Financial freedom module. All scoring + headline metrics are computed by
 * `lib/freedoms/financial-summary.ts` from the typed domain tables; this
 * file just registers the metadata.
 */
export const financialModule = defineFreedomModule({
  meta: freedomMetas.financial,
  status: "live",
});
