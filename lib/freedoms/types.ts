/**
 * Types + static metadata for all four freedoms. Kept separate from the
 * module registry (./index.ts) to avoid circular imports — the per-freedom
 * modules import from here, and index.ts re-exports.
 */
import type { z } from "zod";

export type FreedomKey = "financial" | "location" | "time" | "health";

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

export const freedomMetas: Record<FreedomKey, FreedomMeta> = {
  financial: {
    key: "financial",
    label: "Financial",
    question: "Am I building wealth?",
    colorVar: "var(--color-freedom-financial)",
  },
  location: {
    key: "location",
    label: "Location",
    question: "Do I live where I want?",
    colorVar: "var(--color-freedom-location)",
  },
  time: {
    key: "time",
    label: "Time",
    question: "Am I spending time on what matters?",
    colorVar: "var(--color-freedom-time)",
  },
  health: {
    key: "health",
    label: "Health",
    question: "Is my body trending up?",
    colorVar: "var(--color-freedom-health)",
  },
};

export const FREEDOMS: readonly FreedomMeta[] = [
  freedomMetas.financial,
  freedomMetas.location,
  freedomMetas.time,
  freedomMetas.health,
] as const;
