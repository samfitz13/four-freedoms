import { z } from "zod";
import { freedomMetas } from "./constants";
import { defineFreedomModule } from "./module";

export const timePayloadSchema = z.object({
  /** Deep-work hours logged today. */
  deepWorkHours: z.number().min(0).max(24).optional(),
  /** 0..1 proportion of the day spent on priorities. */
  prioritySplit: z.number().min(0).max(1).optional(),
  note: z.string().max(500).optional(),
});
type TimePayload = z.infer<typeof timePayloadSchema>;

export const timeModule = defineFreedomModule<TimePayload>({
  meta: freedomMetas.time,
  payloadSchema: timePayloadSchema,
  formatEntry(p) {
    const parts: string[] = [];
    if (p.deepWorkHours !== undefined) parts.push(`${p.deepWorkHours.toFixed(1)}h deep work`);
    if (p.prioritySplit !== undefined)
      parts.push(`${Math.round(p.prioritySplit * 100)}% on priorities`);
    return parts.join(" · ") || (p.note ?? "—");
  },
  /**
   * Rubric: 4h deep work = 60pts (saturating), prioritySplit is 0..40pts.
   */
  scoreEntry(p) {
    if (p.deepWorkHours === undefined && p.prioritySplit === undefined) return null;
    const deepPts = clamp(((p.deepWorkHours ?? 0) / 4) * 60, 0, 60);
    const priorityPts = (p.prioritySplit ?? 0) * 40;
    return Math.round(deepPts + priorityPts);
  },
  fields: [
    {
      kind: "number",
      name: "deepWorkHours",
      label: "Deep work",
      hint: "Focused hours today — no meetings, no context-switching.",
      min: 0,
      max: 24,
      step: 0.25,
      suffix: "h",
    },
    {
      kind: "percent",
      name: "prioritySplit",
      label: "Priorities",
      hint: "Share of the day spent on what you said mattered.",
    },
    { kind: "text", name: "note", label: "Note", maxLength: 500 },
  ],
});

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
