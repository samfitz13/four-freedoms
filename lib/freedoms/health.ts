import { z } from "zod";
import { freedomMetas, type FreedomModule } from "./types";

export const healthPayloadSchema = z.object({
  /** Hours of sleep last night. */
  sleepHours: z.number().min(0).max(24).optional(),
  /** 1 if you trained today, 0 if rest, null if unknown. */
  trained: z.boolean().optional(),
  /** 1..10 subjective energy score. */
  energy: z.number().int().min(1).max(10).optional(),
  note: z.string().max(500).optional(),
});
export type HealthPayload = z.infer<typeof healthPayloadSchema>;

export const healthModule: FreedomModule<HealthPayload> = {
  meta: freedomMetas.health,
  payloadSchema: healthPayloadSchema,
  formatEntry(p) {
    const parts: string[] = [];
    if (p.sleepHours !== undefined) parts.push(`${p.sleepHours.toFixed(1)}h sleep`);
    if (p.trained !== undefined) parts.push(p.trained ? "trained" : "rest");
    if (p.energy !== undefined) parts.push(`energy ${p.energy}/10`);
    return parts.join(" · ") || (p.note ?? "—");
  },
  /**
   * Rubric: sleep window 7–8h = 40pts, training = 30pts, energy 0..30pts.
   */
  scoreEntry(p) {
    if (p.sleepHours === undefined && p.trained === undefined && p.energy === undefined)
      return null;
    const sleep = p.sleepHours ?? 0;
    // Triangular: 0 at 5h and 10h, peak 40 at 7.5h.
    const sleepPts = clamp(40 - Math.abs(sleep - 7.5) * 16, 0, 40);
    const trainPts = p.trained ? 30 : 0;
    const energyPts = ((p.energy ?? 0) / 10) * 30;
    return Math.round(sleepPts + trainPts + energyPts);
  },
  fields: [
    {
      kind: "number",
      name: "sleepHours",
      label: "Sleep",
      hint: "Last night, in hours.",
      min: 0,
      max: 24,
      step: 0.25,
      suffix: "h",
    },
    { kind: "boolean", name: "trained", label: "Trained today" },
    {
      kind: "int",
      name: "energy",
      label: "Energy",
      hint: "1 (wrecked) → 10 (peak).",
      min: 1,
      max: 10,
    },
    { kind: "text", name: "note", label: "Note", maxLength: 500 },
  ],
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
