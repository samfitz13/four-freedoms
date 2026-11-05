import { z } from "zod";

import { FI_ASSUMPTION_VERSION } from "./constants";
export {
  FI_ASSUMPTION_VERSION,
  FI_ASSETS,
  EMPTY_ALLOCATION,
  FI_PLANNING_DEFAULTS,
} from "./constants";
export type {
  FiAsset,
  FiAllocation,
  FiPlanSettings,
  FiManualAllocation,
  FiParsedSettings,
} from "./types";

export const fiMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/);
const rate = z.number().finite().min(-0.2).max(0.3);
const allocationSchema = z
  .object({
    usEquity: z.number().min(0).max(1),
    developedEquity: z.number().min(0).max(1),
    emergingEquity: z.number().min(0).max(1),
    bonds: z.number().min(0).max(1),
    cash: z.number().min(0).max(1),
  })
  .refine(
    (mix) => Math.abs(Object.values(mix).reduce((sum, n) => sum + n, 0) - 1) < 1e-8,
    "Each account allocation must total 100%.",
  );

export const fiPlanSettingsSchema = z
  .object({
    version: z.literal(2),
    returnMode: z.enum(["portfolio", "manual"]),
    annualSpend: z.number().finite().positive(),
    withdrawalRate: z.number().finite().positive().max(0.25),
    realReturn: rate,
    downsideReduction: z.number().min(0.001).max(0.2),
    monthlyContribution: z.number().finite().nonnegative(),
    useManualContribution: z.boolean(),
    includedAccountIds: z
      .array(z.string().min(1))
      .min(1)
      .max(200)
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate included account."),
    manualAllocations: z.record(
      z.string(),
      z.object({
        weights: allocationSchema,
        expenseRate: z.number().finite().min(0).max(0.1),
      }),
    ),
    confirmedSnapshots: z.record(z.string(), z.string()),
    assumptions: z.object({
      version: z.literal(FI_ASSUMPTION_VERSION),
      equities: rate,
      bonds: rate,
      cash: rate,
      inflation: z.number().finite().min(0).max(0.2),
      additionalFee: z.number().finite().min(0).max(0.1),
    }),
    retirementMonth: fiMonthSchema.nullable(),
    endMonth: fiMonthSchema.nullable(),
    monthlyRetirementIncome: z.number().finite().nonnegative(),
    incomeStartMonth: fiMonthSchema.nullable(),
  })
  .superRefine((p, ctx) => {
    if (Boolean(p.retirementMonth) !== Boolean(p.endMonth))
      ctx.addIssue({ code: "custom", message: "Enter both retirement and plan-end timing." });
    if (p.retirementMonth && p.endMonth && p.endMonth <= p.retirementMonth)
      ctx.addIssue({ code: "custom", message: "Plan end must follow retirement." });
    if (p.monthlyRetirementIncome > 0 && !p.incomeStartMonth)
      ctx.addIssue({ code: "custom", message: "Enter the retirement income start month." });
  });

/** Legacy JSON is read without writing or converting its manual real-return assumption. */
export function parseFiSettings(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if ("version" in p && p.version !== 1) {
    const parsed = fiPlanSettingsSchema.safeParse(p);
    return parsed.success ? parsed.data : null;
  }
  const number = (key: string, fallback: number) => {
    const raw = p[key];
    if (typeof raw !== "number" && (typeof raw !== "string" || raw.trim() === "")) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };
  const annualSpend = number("annualSpend", 0);
  if (annualSpend <= 0) return null;
  const legacy = {
    version: 1 as const,
    returnMode: "manual" as const,
    annualSpend,
    withdrawalRate: number("withdrawalRate", 0.04),
    realReturn: number("realReturn", 0.05),
    downsideReduction: number("downsideReduction", 0.02),
    monthlyContribution: number("monthlyContribution", 0),
    useManualContribution: p.useManualContribution === true,
    retirementMonth: null,
    endMonth: null,
    monthlyRetirementIncome: 0,
    incomeStartMonth: null,
  };
  if (
    legacy.withdrawalRate <= 0 ||
    legacy.withdrawalRate > 0.25 ||
    legacy.realReturn < -0.2 ||
    legacy.realReturn > 0.3 ||
    legacy.downsideReduction < 0.001 ||
    legacy.downsideReduction > 0.2 ||
    legacy.monthlyContribution < 0
  )
    return null;
  return legacy;
}

export function shiftFiMonth(month: string, offset: number) {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year!, m! - 1 + offset, 1)).toISOString().slice(0, 10);
}
export function fiMonthDistance(from: string, to: string) {
  return (
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    Number(to.slice(5, 7)) -
    Number(from.slice(5, 7))
  );
}

/** Ages are resolved once, by the saving user's birth date, never by a later viewer. */
export function resolveFiTiming(
  month: string,
  age: string,
  birthDate: string | null,
): string | null {
  if (age.trim()) {
    const years = Number(age);
    if (!birthDate || !Number.isInteger(years) || years < 0 || years > 120)
      throw new Error("Enter a whole age from 0 to 120 with a saved birth date.");
    return shiftFiMonth(
      birthDate.slice(0, 7) + "-01",
      years * 12 + (birthDate.slice(8, 10) === "01" ? 0 : 1),
    );
  }
  if (!month) return null;
  return fiMonthSchema.parse(month.length === 7 ? month + "-01" : month);
}
