"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { financialGoals } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { scopeForUser } from "@/lib/db/scope";

const GOAL_KINDS = [
  "fi_number",
  "net_worth_target",
  "savings_milestone",
  "debt_payoff",
  "emergency_fund",
] as const;

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

  const parsed = z
    .object({
      annualSpend: z.coerce.number().finite().positive(),
      withdrawalRate: z.coerce.number().positive().max(0.25),
      realReturn: z.coerce.number().min(-0.2).max(0.3),
      monthlyContribution: z.coerce.number().min(0),
    })
    .safeParse({
      annualSpend: str(formData, "annualSpend"),
      withdrawalRate: str(formData, "withdrawalRate") || "0.04",
      realReturn: str(formData, "realReturn") || "0.05",
      monthlyContribution: str(formData, "monthlyContribution") || "0",
    });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const targetAmount = parsed.data.annualSpend / parsed.data.withdrawalRate;

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
      params: {
        annualSpend: parsed.data.annualSpend,
        withdrawalRate: parsed.data.withdrawalRate,
        realReturn: parsed.data.realReturn,
        monthlyContribution: parsed.data.monthlyContribution,
      },
      status: "active",
    });
  });

  revalidatePath("/financial");
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
    })
    .safeParse({
      kind: str(formData, "kind"),
      title: str(formData, "title"),
      targetAmount: num(formData, "targetAmount"),
      targetDate: str(formData, "targetDate") || undefined,
      currentProgress: num(formData, "currentProgress"),
    });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  if (parsed.data.kind === "fi_number") {
    return {
      ok: false,
      error: "Use the FI card to set your FI goal.",
    };
  }
  if (parsed.data.targetAmount === undefined) {
    return { ok: false, error: "Target amount is required for this goal kind." };
  }

  await db.insert(financialGoals).values({
    id: randomUUID(),
    householdId: scope.primaryHouseholdId,
    kind: parsed.data.kind,
    title: parsed.data.title,
    targetAmount: parsed.data.targetAmount.toFixed(2),
    targetDate: parsed.data.targetDate ?? null,
    params: {
      currentProgress: parsed.data.currentProgress ?? 0,
    },
    status: "active",
  });

  revalidatePath("/financial");
  return { ok: true, message: "Goal added." };
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

  revalidatePath("/financial");
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
  revalidatePath("/financial");
}
