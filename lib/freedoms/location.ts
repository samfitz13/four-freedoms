import { z } from "zod";
import { freedomMetas, type FreedomModule } from "./types";

export const locationPayloadSchema = z.object({
  /** Free-form "where am I" (city, country, or label). */
  place: z.string().min(1).max(120).optional(),
  /** 1..10 satisfaction with being here. */
  satisfaction: z.number().int().min(1).max(10).optional(),
  /** true if this place is on your preferred list. */
  preferred: z.boolean().optional(),
  note: z.string().max(500).optional(),
});
export type LocationPayload = z.infer<typeof locationPayloadSchema>;

export const locationModule: FreedomModule<LocationPayload> = {
  meta: freedomMetas.location,
  payloadSchema: locationPayloadSchema,
  formatEntry(p) {
    const parts: string[] = [];
    if (p.place) parts.push(p.place);
    if (p.satisfaction !== undefined) parts.push(`${p.satisfaction}/10`);
    if (p.preferred) parts.push("preferred");
    return parts.join(" · ") || (p.note ?? "—");
  },
  /**
   * Rubric: satisfaction is the driver (0..70pts via 1..10 → 0..70),
   * "preferred place" gates the top 30.
   */
  scoreEntry(p) {
    if (p.satisfaction === undefined && p.preferred === undefined) return null;
    const satPts = ((p.satisfaction ?? 5) / 10) * 70;
    const prefPts = p.preferred ? 30 : 0;
    return Math.round(satPts + prefPts);
  },
  fields: [
    {
      kind: "text",
      name: "place",
      label: "Where are you?",
      hint: "City, country, or label.",
      maxLength: 120,
    },
    {
      kind: "int",
      name: "satisfaction",
      label: "Satisfaction",
      hint: "1 (want to leave) → 10 (want to stay).",
      min: 1,
      max: 10,
    },
    {
      kind: "boolean",
      name: "preferred",
      label: "Preferred place",
      hint: "On your short list of places you want to live.",
    },
    { kind: "text", name: "note", label: "Note", maxLength: 500 },
  ],
};
