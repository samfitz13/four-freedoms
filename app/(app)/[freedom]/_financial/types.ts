/**
 * Shared types for the financial workspace's server actions + UI.
 */

import type { FINANCIAL_TABS } from "./constants";

export interface ActionResultOk {
  ok: true;
  message?: string;
}

export interface ActionResultErr {
  ok: false;
  error: string;
}

export type ActionResult = ActionResultOk | ActionResultErr;

export type FinancialTab = (typeof FINANCIAL_TABS)[number]["key"];
