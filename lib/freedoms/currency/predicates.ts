import { SUPPORTED_CURRENCIES } from "./constants";
import type { SupportedCurrency } from "./types";

export function isSupportedCurrency(v: string): v is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(v);
}
