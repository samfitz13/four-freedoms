/**
 * Types for the freedom registry. Kept separate from the module registry
 * (./index.ts) and the metadata table (./constants.ts) to avoid circular
 * imports — per-freedom modules import from here, constants.ts references
 * these types, and index.ts re-exports.
 */
import type { z } from "zod";

import type { FREEDOM_KEYS } from "./constants";

export type FreedomKey = (typeof FREEDOM_KEYS)[number];

export interface FreedomMeta {
  key: FreedomKey;
  label: string;
  question: string;
  colorVar: string;
}

export interface FreedomSummary {
  key: FreedomKey;
  /** 0..100, freedom-defined rubric. 0 when no entries yet. */
  score: number;
  /** Delta vs previous period, -100..100. 0 when not enough data. */
  trend: number;
  /** Consecutive days with an entry ending today. */
  streak: number;
  /** Number of entries in the current period. */
  entriesThisWeek: number;
}

/**
 * Declarative description of one input on the daily check-in form. Each
 * module lists its fields so the form renderer can stay generic.
 */
export type FreedomField =
  | {
      kind: "number";
      name: string;
      label: string;
      hint?: string;
      min?: number;
      max?: number;
      step?: number;
      suffix?: string;
    }
  | {
      kind: "percent"; // rendered 0-100, stored as 0..1
      name: string;
      label: string;
      hint?: string;
    }
  | {
      kind: "int"; // integer slider-ish, e.g. 1..10
      name: string;
      label: string;
      hint?: string;
      min: number;
      max: number;
    }
  | {
      kind: "text";
      name: string;
      label: string;
      hint?: string;
      maxLength?: number;
    }
  | {
      kind: "boolean";
      name: string;
      label: string;
      hint?: string;
    }
  | {
      kind: "currency"; // rendered as number with currency suffix (household base)
      name: string;
      label: string;
      hint?: string;
      min?: number;
      max?: number;
      step?: number;
    };

/**
 * A scored, week-indexed view of a payload. Each freedom turns one entry
 * into a 0..100 number using its own rubric; we average across the period
 * to produce the freedom's score.
 */
export interface FreedomModule<Payload extends Record<string, unknown>> {
  meta: FreedomMeta;
  payloadSchema: z.ZodType<Payload>;
  formatEntry: (payload: Payload) => string;
  /** 0..100, higher is better. Returns null if the payload has no signal. */
  scoreEntry: (payload: Payload) => number | null;
  /** Fields rendered on the daily check-in form, in display order. */
  fields: readonly FreedomField[];
}

/**
 * Financial check-in payload. Kept here (rather than colocated with
 * `lib/freedoms/financial.ts`) because our `types-file-organization` lint
 * rule requires exported types to live in a `types.ts`.
 */
export type FinancialPayload = {
  /** Total net worth in the household's base currency. */
  netWorth?: number;
  /** 0..1 of post-tax income saved this period. */
  savingsRate?: number;
  /** Months of expenses covered by liquid savings. */
  runwayMonths?: number;
  /** Raw monthly income (used to derive savings rate if absent). */
  monthlyIncome?: number;
  /** Raw monthly expenses. */
  monthlyExpenses?: number;
  /** 0..1 debt-to-assets ratio (capped at 5). */
  debtToAssets?: number;
  /** 0..1 share of net worth that is invested (vs. cash/idle). */
  investedPct?: number;
  /** 0..1 progress toward the household's FI number. */
  fiProgress?: number;
  note?: string;
};

/** FI (financial-independence) projection input. */
export interface FiProjectionInput {
  currentInvested: number;
  monthlyContribution: number;
  /** 0..1 annual real return (net of inflation). Default 5%. */
  realReturn?: number;
  /** Safe-withdrawal rate used to derive the FI number. Default 4%. */
  withdrawalRate?: number;
  targetAnnualSpend: number;
  /** Project horizon in years. Stops early once balance ≥ FI number. */
  horizonYears?: number;
}

/** One year on an FI projection curve. */
export interface FiYear {
  year: number;
  balance: number;
  fiNumber: number;
  /** 0..1, capped for display. Raw ratio still available as `rawProgress`. */
  progress: number;
  rawProgress: number;
}

/** One day in a sparkline score series. */
export interface DailyPoint {
  /** ISO date `YYYY-MM-DD` */
  date: string;
  /** 0..100 score, or null when no entry that day. */
  score: number | null;
}

/** Full FI projection result. */
export interface FiProjection {
  fiNumber: number;
  realReturn: number;
  withdrawalRate: number;
  /** Years 0..N (inclusive of year 0 = today). */
  years: FiYear[];
  /** null if the horizon runs out before we hit FI. */
  yearsToFi: number | null;
}
