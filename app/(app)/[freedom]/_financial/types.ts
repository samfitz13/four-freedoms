/**
 * Shared types for the financial workspace's server actions + UI.
 */

import type { FINANCIAL_TABS } from "./constants";
import type { PaystubKind } from "@/lib/freedoms/enums";
import type { DerivedFiInputs } from "@/lib/freedoms/types";

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

export type PeerInfo = { accountId: string | null; accountName: string | null };

export type EditableRow = {
  accountId: string;
  accountName: string;
  type: string;
  subtype: string | null;
  klass: string;
  endingBalance: number;
  employeeContribution: number;
  employerMatch: number;
  isDerived?: boolean;
};

export type DerivedFiDefaults = Omit<DerivedFiInputs, "latestMonth">;

export interface AccountOption {
  id: string;
  name: string;
  type: string;
  klass: "cash" | "investments" | "debt" | "equity" | "other";
}

export type StateTaxEntry = {
  state: string;
  income: number;
  disability?: number;
  fli?: number;
  local?: Array<{ jurisdiction: string; amount: number }>;
};

export type PaystubRow = {
  id: string;
  payDate: string;
  kind: PaystubKind;
  employer: string | null;
  gross: number;
  federalIncomeTax: number;
  socialSecurity: number;
  medicare: number;
  additionalMedicare: number;
  benefits: number;
  otherIncome: number;
  net: number;
  employee401k: number;
  employeeRoth401k: number;
  employerMatch: number;
  hsa: number;
  otherPretax: number;
  otherPosttax: number;
  stateTaxes: StateTaxEntry[];
  netOverridden: boolean;
  notes: string | null;
};

export type MonthlyIncomeSummary = {
  month: string;
  count: number;
  gross: number;
  net: number;
  taxes: number;
  effectiveTax: number;
};
