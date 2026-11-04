import { freedomMetas } from "./constants";
import { defineFreedomModule } from "./module";

export const healthModule = defineFreedomModule({
  meta: freedomMetas.health,
  status: "live",
});
