import { z } from "zod";
import { freedomMetas, type FreedomModule } from "./types";

export const financialPayloadSchema = z.object({
  /** Total net worth in your home currency. Optional on any given day. */
  netWorth: z.number().finite().optional(),
  /** 0..1 of post-tax income saved this period. */
  savingsRate: z.number().min(0).max(1).optional(),
  /** Months of expenses covered by liquid savings. */
  runwayMonths: z.number().min(0).optional(),
  note: z.string().max(500).optional(),
});
export type FinancialPayload = z.infer<typeof financialPayloadSchema>;

export const financialModule: FreedomModule<FinancialPayload> = {
  meta: freedomMetas.financial,
  payloadSchema: financialPayloadSchema,
  formatEntry(p) {
    const parts: string[] = [];
    if (p.netWorth !== undefined) parts.push(`net worth ${formatCurrency(p.netWorth)}`);
    if (p.savingsRate !== undefined) parts.push(`${Math.round(p.savingsRate * 100)}% saved`);
    if (p.runwayMonths !== undefined) parts.push(`${p.runwayMonths.toFixed(1)}mo runway`);
    return parts.join(" · ") || (p.note ?? "—");
  },
  /**
   * Rubric (editorial, intentionally simple for v1):
   *   savings rate 30% = 60pts, 50% = 100pts (capped)
   *   runway 12mo    = 40pts, 24mo+ = 40pts
   * Either signal alone can score; presence of both is additive up to 100.
   */
  scoreEntry(p) {
    let score = 0;
    let weightsPresent = false;
    if (p.savingsRate !== undefined) {
      weightsPresent = true;
      score += clamp((p.savingsRate / 0.5) * 60, 0, 60);
    }
    if (p.runwayMonths !== undefined) {
      weightsPresent = true;
      score += clamp((p.runwayMonths / 24) * 40, 0, 40);
    }
    return weightsPresent ? Math.round(score) : null;
  },
  fields: [
    {
      kind: "number",
      name: "netWorth",
      label: "Net worth",
      hint: "Total assets minus liabilities.",
      min: 0,
      step: 100,
      suffix: "USD",
    },
    {
      kind: "percent",
      name: "savingsRate",
      label: "Savings rate",
      hint: "Post-tax income saved this period.",
    },
    {
      kind: "number",
      name: "runwayMonths",
      label: "Runway",
      hint: "Months of expenses in liquid savings.",
      min: 0,
      step: 0.5,
      suffix: "mo",
    },
    { kind: "text", name: "note", label: "Note", maxLength: 500 },
  ],
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
