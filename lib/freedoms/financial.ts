import { z } from "zod";
import { freedomMetas } from "./constants";
import { defineFreedomModule } from "./module";
import type { FinancialPayload } from "./types";

/**
 * Financial check-in payload. v2 rubric is additive and capped at 100:
 *
 *   savingsRate: 0 → 30% → 50%+  →   0 → 45 → 60 pts
 *   runway:      0 → 12mo → 24mo+ →  0 → 25 → 35 pts
 *   fiProgress:  0 → 100%          →  0 → 20 pts
 *   debtToAssets > 0.5             →  -10 pts penalty
 *
 * Old payloads (netWorth/savingsRate/runwayMonths only) still score correctly;
 * new fields are optional. monthlyIncome/monthlyExpenses are derived inputs
 * that let the detail panel auto-compute savingsRate for users who prefer
 * entering raw dollars.
 */
export const financialPayloadSchema = z
  .object({
    /** Total net worth in your home currency. Optional on any given day. */
    netWorth: z.number().finite().optional(),
    /** 0..1 of post-tax income saved this period. */
    savingsRate: z.number().min(0).max(1).optional(),
    /** Months of expenses covered by liquid savings. */
    runwayMonths: z.number().min(0).optional(),
    /** Raw monthly income (used to derive savings rate if savingsRate is absent). */
    monthlyIncome: z.number().min(0).optional(),
    /** Raw monthly expenses. */
    monthlyExpenses: z.number().min(0).optional(),
    /** 0..1 debt-to-assets ratio. */
    debtToAssets: z.number().min(0).max(5).optional(),
    /** 0..1 share of net worth that is invested (vs. cash/idle). */
    investedPct: z.number().min(0).max(1).optional(),
    /** 0..1 progress toward the household's FI number. */
    fiProgress: z.number().min(0).max(2).optional(),
    note: z.string().max(500).optional(),
  })
  .transform((p) => {
    // If the user supplied income + expenses but not an explicit savingsRate,
    // derive it so the rubric can use the signal.
    if (
      p.savingsRate === undefined &&
      p.monthlyIncome !== undefined &&
      p.monthlyExpenses !== undefined &&
      p.monthlyIncome > 0
    ) {
      const derived = (p.monthlyIncome - p.monthlyExpenses) / p.monthlyIncome;
      return { ...p, savingsRate: clamp(derived, 0, 1) };
    }
    return p;
  });
export const financialModule = defineFreedomModule<FinancialPayload>({
  meta: freedomMetas.financial,
  payloadSchema: financialPayloadSchema,
  formatEntry(p) {
    const parts: string[] = [];
    if (p.netWorth !== undefined) parts.push(`net worth ${formatCurrency(p.netWorth)}`);
    if (p.savingsRate !== undefined) parts.push(`${Math.round(p.savingsRate * 100)}% saved`);
    if (p.runwayMonths !== undefined) parts.push(`${p.runwayMonths.toFixed(1)}mo runway`);
    if (p.fiProgress !== undefined) parts.push(`${Math.round(p.fiProgress * 100)}% FI`);
    return parts.join(" · ") || (p.note ?? "—");
  },
  scoreEntry(p) {
    let score = 0;
    let weightsPresent = false;

    if (p.savingsRate !== undefined) {
      weightsPresent = true;
      // piecewise: 0→0, 0.3→45, 0.5+→60
      if (p.savingsRate <= 0.3) {
        score += (p.savingsRate / 0.3) * 45;
      } else {
        score += 45 + clamp((p.savingsRate - 0.3) / 0.2, 0, 1) * 15;
      }
    }

    if (p.runwayMonths !== undefined) {
      weightsPresent = true;
      if (p.runwayMonths <= 12) {
        score += (p.runwayMonths / 12) * 25;
      } else {
        score += 25 + clamp((p.runwayMonths - 12) / 12, 0, 1) * 10;
      }
    }

    if (p.fiProgress !== undefined) {
      weightsPresent = true;
      score += clamp(p.fiProgress, 0, 1) * 20;
    }

    if (p.debtToAssets !== undefined && p.debtToAssets > 0.5) {
      weightsPresent = true;
      score -= 10;
    }

    return weightsPresent ? Math.round(clamp(score, 0, 100)) : null;
  },
  fields: [
    {
      kind: "currency",
      name: "netWorth",
      label: "Net worth",
      hint: "Total assets minus liabilities.",
      min: 0,
      step: 100,
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
    {
      kind: "currency",
      name: "monthlyIncome",
      label: "Monthly income",
      hint: "Post-tax. Optional — auto-derives savings rate with expenses.",
      min: 0,
      step: 50,
    },
    {
      kind: "currency",
      name: "monthlyExpenses",
      label: "Monthly expenses",
      hint: "Average spend this month.",
      min: 0,
      step: 50,
    },
    {
      kind: "percent",
      name: "investedPct",
      label: "Invested %",
      hint: "Share of net worth that is invested vs. idle cash.",
    },
    {
      kind: "percent",
      name: "debtToAssets",
      label: "Debt / assets",
      hint: "Total debt divided by total assets.",
    },
    {
      kind: "percent",
      name: "fiProgress",
      label: "FI progress",
      hint: "Invested assets divided by your FI number.",
    },
    { kind: "text", name: "note", label: "Note", maxLength: 500 },
  ],
});

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
