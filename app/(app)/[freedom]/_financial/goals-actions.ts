"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { financialAccounts, financialGoals } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { scopeForUser } from "@/lib/db/scope";
import { FI_RETURN_DEFAULTS } from "@/lib/freedoms/constants";
import {
  fiPlanSettingsSchema,
  FI_PLANNING_DEFAULTS,
  resolveFiTiming,
  FI_ASSETS,
} from "@/lib/freedoms/fi-plan-settings";
import { listAccounts } from "@/lib/db/queries/financial";
import { getUserBirthDate } from "@/lib/db/queries/profile";
import { getHouseholdFiPlan } from "@/lib/freedoms/fi-plan-server";
import { isFiAccountEligible } from "@/lib/freedoms/fi-allocation";
import { getFiGoalAssumptions } from "@/lib/freedoms/financial-settings";

const GOAL_KINDS = [
  "fi_number",
  "net_worth_target",
  "savings_milestone",
  "debt_payoff",
  "emergency_fund",
  "savings_rate_target",
] as const;

const LINKED_CLASSES = ["cash", "investments", "debt", "equity", "other"] as const;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

import type { ActionResult } from "./types";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function num(fd: FormData, key: string): number | undefined {
  const s = str(fd, key);
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Upsert the household's FI-number goal. Only one fi_number goal is expected
 * per household; we replace the active one so users can tune assumptions.
 */
export async function setFiGoal(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);

  try {
    // Inputs come in as percentages (e.g. 4 for 4%) and are stored as decimals.
    const parsed = z
      .object({
        annualSpend: z.coerce.number().finite().positive(),
        withdrawalRatePct: z.coerce.number().positive().max(25),
        realReturnPct: z.coerce.number().finite().min(-20).max(30),
        inflationRatePct: z.coerce.number().finite().min(0).max(20),
        downsideReductionPct: z.coerce.number().finite().min(0.1).max(20),
        monthlyContribution: z.number().finite().min(0).optional(),
        useManualContribution: z.boolean(),
      })
      .refine(
        (values) => !values.useManualContribution || values.monthlyContribution !== undefined,
        {
          message: "Enter a monthly contribution for the manual override.",
          path: ["monthlyContribution"],
        },
      )
      .safeParse({
        annualSpend: str(formData, "annualSpend"),
        withdrawalRatePct: str(formData, "withdrawalRate") || "4",
        realReturnPct: str(formData, "realReturn") || "5",
        inflationRatePct:
          str(formData, "inflationRate") || String(FI_RETURN_DEFAULTS.inflationRate * 100),
        downsideReductionPct:
          str(formData, "downsideReduction") || String(FI_RETURN_DEFAULTS.downsideReduction * 100),
        monthlyContribution: num(formData, "monthlyContribution"),
        useManualContribution: str(formData, "useManualContribution") === "true",
      });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const withdrawalRate = parsed.data.withdrawalRatePct / 100;
    const realReturn = parsed.data.realReturnPct / 100;
    const targetAmount = parsed.data.annualSpend / withdrawalRate;
    const accounts = await listAccounts(scope.primaryHouseholdId, { includeArchived: true });
    const previous = (await getFiGoalAssumptions(scope.primaryHouseholdId)).settings;
    const saved = previous?.version === 2 ? previous : null;
    const retainedIds = accounts
      .filter(
        (a) =>
          a.isArchived &&
          (saved
            ? saved.includedAccountIds.includes(a.id)
            : previous && (a.type === "brokerage" || a.type === "retirement")),
      )
      .map((a) => a.id);
    const requestedIds = formData
      .getAll("includedAccountIds")
      .filter((id): id is string => typeof id === "string");
    if (str(formData, "confirmIncludedAccounts") !== "true")
      return { ok: false, error: "Confirm the included accounts before saving." };
    if (
      requestedIds.some(
        (id) =>
          !accounts.some(
            (a) =>
              a.id === id &&
              isFiAccountEligible(a.type) &&
              (!a.isArchived || retainedIds.includes(id)),
          ),
      )
    )
      return {
        ok: false,
        error: "An included account is unavailable or excluded from this projection.",
      };
    const includedAccountIds = [...new Set([...requestedIds, ...retainedIds])];
    const manualAllocations: Record<string, unknown> = {};
    const confirmedSnapshots: Record<string, string> = {};
    for (const id of includedAccountIds) {
      if (retainedIds.includes(id)) {
        if (saved?.manualAllocations[id]) manualAllocations[id] = saved.manualAllocations[id];
        if (saved?.confirmedSnapshots[id]) confirmedSnapshots[id] = saved.confirmedSnapshots[id];
        continue;
      }
      if (accounts.find((a) => a.id === id)?.type === "savings") continue;
      if (str(formData, `allocationMode:${id}`) === "manual") {
        manualAllocations[id] = {
          weights: Object.fromEntries(
            FI_ASSETS.map((asset) => [
              asset,
              Number(str(formData, `allocation:${id}:${asset}`)) / 100,
            ]),
          ),
          expenseRate: Number(str(formData, `expense:${id}`)) / 100,
        };
      } else if (str(formData, `confirmSnapshot:${id}`)) {
        confirmedSnapshots[id] = str(formData, `confirmSnapshot:${id}`);
      }
    }
    const birthDate = await getUserBirthDate(user.id);
    let timing;
    try {
      timing = {
        retirementMonth: resolveFiTiming(
          str(formData, "retirementMonth"),
          str(formData, "retirementAge"),
          birthDate,
        ),
        endMonth: resolveFiTiming(str(formData, "endMonth"), str(formData, "endAge"), birthDate),
        incomeStartMonth: resolveFiTiming(
          str(formData, "incomeStartMonth"),
          str(formData, "incomeAge"),
          birthDate,
        ),
      };
    } catch {
      return { ok: false, error: "Enter valid retirement, plan-end, and income timing." };
    }
    const planSettings = fiPlanSettingsSchema.safeParse({
      version: 2,
      returnMode: str(formData, "returnMode"),
      annualSpend: parsed.data.annualSpend,
      withdrawalRate,
      realReturn,
      downsideReduction: parsed.data.downsideReductionPct / 100,
      monthlyContribution: parsed.data.monthlyContribution ?? 0,
      useManualContribution: parsed.data.useManualContribution,
      includedAccountIds,
      manualAllocations,
      confirmedSnapshots,
      ...timing,
      monthlyRetirementIncome: Number(str(formData, "monthlyRetirementIncome") || "0"),
      assumptions: {
        version: FI_PLANNING_DEFAULTS.version,
        equities: Number(str(formData, "equitiesReturn") || "6") / 100,
        bonds: Number(str(formData, "bondsReturn") || "4") / 100,
        cash: Number(str(formData, "cashReturn") || "3") / 100,
        inflation: parsed.data.inflationRatePct / 100,
        additionalFee: Number(str(formData, "additionalFee") || "0") / 100,
      },
    });
    if (!planSettings.success)
      return { ok: false, error: planSettings.error.issues[0]?.message ?? "Invalid plan." };
    const preview = await getHouseholdFiPlan(
      scope.primaryHouseholdId,
      new Date(),
      planSettings.data,
    );
    if (preview.errors.length) return { ok: false, error: preview.errors[0]! };

    // Archive any existing active fi_number goal, then insert a fresh one.
    await db.transaction(async (tx) => {
      await tx
        .update(financialGoals)
        .set({ status: "archived", updatedAt: new Date() })
        .where(
          and(
            eq(financialGoals.householdId, scope.primaryHouseholdId),
            eq(financialGoals.kind, "fi_number"),
            eq(financialGoals.status, "active"),
          ),
        );

      await tx.insert(financialGoals).values({
        id: randomUUID(),
        householdId: scope.primaryHouseholdId,
        kind: "fi_number",
        title: "Financial independence",
        targetAmount: targetAmount.toFixed(2),
        targetDate: null,
        params: planSettings.data,
        status: "active",
      });
    });
  } catch {
    return { ok: false, error: "The FI plan could not be saved. Your changes are still here." };
  }

  revalidatePath("/financial", "layout");
  return { ok: true, message: "FI target saved." };
}

export async function createGoal(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);

  const parsed = z
    .object({
      kind: z.enum(GOAL_KINDS),
      title: z.string().min(1).max(80),
      targetAmount: z.coerce.number().finite().positive().optional(),
      targetDate: isoDateSchema.optional(),
      currentProgress: z.coerce.number().finite().min(0).optional(),
      linkMode: z.enum(["manual", "accounts", "class"]).optional(),
      linkedClass: z.enum(LINKED_CLASSES).optional(),
      invert: z.boolean().optional(),
      // Savings-rate kind only:
      targetRatePct: z.coerce.number().finite().positive().max(80).optional(),
      rateWindow: z.coerce.number().int().positive().max(60).optional(),
    })
    .safeParse({
      kind: str(formData, "kind"),
      title: str(formData, "title"),
      targetAmount: num(formData, "targetAmount"),
      targetDate: str(formData, "targetDate") || undefined,
      currentProgress: num(formData, "currentProgress"),
      linkMode: str(formData, "linkMode") || undefined,
      linkedClass: str(formData, "linkedClass") || undefined,
      invert: str(formData, "invert") === "true",
      targetRatePct: num(formData, "targetRate"),
      rateWindow: num(formData, "rateWindow"),
    });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  if (parsed.data.kind === "fi_number") {
    return { ok: false, error: "Use the FI card to set your FI goal." };
  }

  // Savings-rate goal: target stored as a decimal in params; targetAmount unused.
  if (parsed.data.kind === "savings_rate_target") {
    if (parsed.data.targetRatePct === undefined) {
      return { ok: false, error: "Target rate is required." };
    }
    await db.insert(financialGoals).values({
      id: randomUUID(),
      householdId: scope.primaryHouseholdId,
      kind: parsed.data.kind,
      title: parsed.data.title,
      targetAmount: null,
      targetDate: parsed.data.targetDate ?? null,
      params: {
        targetRate: parsed.data.targetRatePct / 100,
        window: parsed.data.rateWindow ?? 12,
      },
      status: "active",
    });
    revalidatePath("/financial", "layout");
    return { ok: true, message: "Savings-rate goal added." };
  }

  if (parsed.data.targetAmount === undefined) {
    return { ok: false, error: "Target amount is required for this goal kind." };
  }

  // Linked accounts come in as multiple form entries on the same key.
  const linkedAccountIdsRaw = formData
    .getAll("linkedAccountIds")
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  let linkedAccountIds: string[] = [];
  if (parsed.data.linkMode === "accounts" && linkedAccountIdsRaw.length > 0) {
    // Validate ownership.
    const owned = await db
      .select({ id: financialAccounts.id })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.householdId, scope.primaryHouseholdId),
          eq(financialAccounts.isArchived, false),
          inArray(financialAccounts.id, linkedAccountIdsRaw),
        ),
      );
    linkedAccountIds = owned.map((r) => r.id);
  }

  const params: Record<string, unknown> = {};
  if (parsed.data.linkMode === "manual" || !parsed.data.linkMode) {
    params.currentProgress = parsed.data.currentProgress ?? 0;
  } else if (parsed.data.linkMode === "accounts" && linkedAccountIds.length > 0) {
    params.linkedAccountIds = linkedAccountIds;
    if (parsed.data.invert) params.invert = true;
  } else if (parsed.data.linkMode === "class" && parsed.data.linkedClass) {
    params.linkedClass = parsed.data.linkedClass;
    if (parsed.data.invert) params.invert = true;
  } else {
    // Falling back to manual when link is requested but incomplete.
    params.currentProgress = parsed.data.currentProgress ?? 0;
  }

  await db.insert(financialGoals).values({
    id: randomUUID(),
    householdId: scope.primaryHouseholdId,
    kind: parsed.data.kind,
    title: parsed.data.title,
    targetAmount: parsed.data.targetAmount.toFixed(2),
    targetDate: parsed.data.targetDate ?? null,
    params,
    status: "active",
  });

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Goal added." };
}

export async function setGoalLinks(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);

  const parsed = z
    .object({
      id: z.string().min(1),
      linkMode: z.enum(["manual", "accounts", "class"]),
      linkedClass: z.enum(LINKED_CLASSES).optional(),
      invert: z.boolean().optional(),
    })
    .safeParse({
      id: str(formData, "id"),
      linkMode: str(formData, "linkMode") || "manual",
      linkedClass: str(formData, "linkedClass") || undefined,
      invert: str(formData, "invert") === "true",
    });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const [existing] = await db
    .select({
      id: financialGoals.id,
      params: financialGoals.params,
    })
    .from(financialGoals)
    .where(
      and(
        eq(financialGoals.id, parsed.data.id),
        eq(financialGoals.householdId, scope.primaryHouseholdId),
      ),
    )
    .limit(1);
  if (!existing) return { ok: false, error: "Goal not found." };

  const linkedAccountIdsRaw = formData
    .getAll("linkedAccountIds")
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  const prior = (existing.params ?? {}) as Record<string, unknown>;
  let linkedAccountIds: string[] = [];
  if (parsed.data.linkMode === "accounts") {
    const accounts = await listAccounts(scope.primaryHouseholdId, { includeArchived: true });
    const previousIds = Array.isArray(prior.linkedAccountIds) ? prior.linkedAccountIds : [];
    linkedAccountIds = accounts
      .filter((a) =>
        a.isArchived ? previousIds.includes(a.id) : linkedAccountIdsRaw.includes(a.id),
      )
      .map((a) => a.id);
  }
  // Wipe link-related keys; preserve unrelated params (e.g. currentProgress
  // when reverting to manual).
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(prior)) {
    if (k === "linkedAccountIds" || k === "linkedClass" || k === "invert") continue;
    next[k] = v;
  }
  if (parsed.data.linkMode === "accounts" && linkedAccountIds.length > 0) {
    next.linkedAccountIds = linkedAccountIds;
    if (parsed.data.invert) next.invert = true;
  } else if (parsed.data.linkMode === "class" && parsed.data.linkedClass) {
    next.linkedClass = parsed.data.linkedClass;
    if (parsed.data.invert) next.invert = true;
  } else {
    // Manual: ensure a currentProgress key exists so the inline form has something.
    if (typeof next.currentProgress !== "number") next.currentProgress = 0;
  }

  await db
    .update(financialGoals)
    .set({ params: next, updatedAt: new Date() })
    .where(eq(financialGoals.id, existing.id));

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Links updated." };
}

export async function updateGoalProgress(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);

  const parsed = z
    .object({
      id: z.string().min(1),
      currentProgress: z.coerce.number().finite().min(0),
    })
    .safeParse({
      id: str(formData, "id"),
      currentProgress: str(formData, "currentProgress"),
    });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const [existing] = await db
    .select({
      id: financialGoals.id,
      params: financialGoals.params,
      targetAmount: financialGoals.targetAmount,
      status: financialGoals.status,
    })
    .from(financialGoals)
    .where(
      and(
        eq(financialGoals.id, parsed.data.id),
        eq(financialGoals.householdId, scope.primaryHouseholdId),
      ),
    )
    .limit(1);
  if (!existing) return { ok: false, error: "Goal not found." };

  const params = { ...(existing.params ?? {}), currentProgress: parsed.data.currentProgress };
  const target = existing.targetAmount ? Number(existing.targetAmount) : null;
  const status =
    target !== null && parsed.data.currentProgress >= target ? "achieved" : existing.status;

  await db
    .update(financialGoals)
    .set({ params, status, updatedAt: new Date() })
    .where(eq(financialGoals.id, existing.id));

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Progress updated." };
}

export async function archiveGoal(formData: FormData): Promise<void> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = str(formData, "id");
  if (!id) return;
  await db
    .update(financialGoals)
    .set({ status: "archived", updatedAt: new Date() })
    .where(
      and(eq(financialGoals.id, id), eq(financialGoals.householdId, scope.primaryHouseholdId)),
    );
  revalidatePath("/financial", "layout");
}
