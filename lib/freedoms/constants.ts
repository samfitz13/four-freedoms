import type { FreedomKey, FreedomMeta } from "./types";

export const FREEDOM_KEYS = ["financial", "location", "time", "health"] as const;

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
];
