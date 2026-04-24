"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  budgetCategories,
  budgetPeriods,
  cashflowTransactions,
  financialAccounts,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { scopeForUser } from "@/lib/db/scope";
import { DEFAULT_BASE_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/freedoms/currency";

const CATEGORY_KINDS = ["income", "fixed", "variable", "savings", "debt"] as const;
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ymSchema = z.string().regex(/^\d{4}-\d{2}-01$/);

import type { ActionResult } from "./types";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function addTransaction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);

  const kindRaw = str(formData, "flow"); // "income" | "expense"
  const parsed = z
    .object({
      flow: z.enum(["income", "expense"]),
      occurredOn: isoDateSchema,
      amount: z.coerce.number().finite().positive(),
      currency: z.enum(SUPPORTED_CURRENCIES).optional(),
      description: z.string().max(200).optional(),
      categoryId: z.string().optional(),
      accountId: z.string().optional(),
    })
    .safeParse({
      flow: kindRaw,
      occurredOn: str(formData, "occurredOn"),
      amount: str(formData, "amount"),
      currency: (str(formData, "currency") || undefined) as string | undefined,
      description: str(formData, "description") || undefined,
      categoryId: str(formData, "categoryId") || undefined,
      accountId: str(formData, "accountId") || undefined,
    });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Validate account/category ownership if provided.
  if (parsed.data.accountId) {
    const [hit] = await db
      .select({ id: financialAccounts.id })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.id, parsed.data.accountId),
          eq(financialAccounts.householdId, scope.primaryHouseholdId),
        ),
      )
      .limit(1);
    if (!hit) return { ok: false, error: "Account not found." };
  }
  if (parsed.data.categoryId) {
    const [hit] = await db
      .select({ id: budgetCategories.id })
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.id, parsed.data.categoryId),
          eq(budgetCategories.householdId, scope.primaryHouseholdId),
        ),
      )
      .limit(1);
    if (!hit) return { ok: false, error: "Category not found." };
  }

  const signedAmount = parsed.data.flow === "income" ? parsed.data.amount : -parsed.data.amount;

  await db.insert(cashflowTransactions).values({
    id: randomUUID(),
    householdId: scope.primaryHouseholdId,
    accountId: parsed.data.accountId ?? null,
    occurredOn: parsed.data.occurredOn,
    amount: signedAmount.toFixed(2),
    currency: parsed.data.currency ?? DEFAULT_BASE_CURRENCY,
    description: parsed.data.description ?? null,
    categoryId: parsed.data.categoryId ?? null,
    source: "manual",
  });

  revalidatePath("/financial");
  return { ok: true, message: "Transaction added." };
}

export async function deleteTransaction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = str(formData, "id");
  if (!id) return;

  await db
    .delete(cashflowTransactions)
    .where(
      and(
        eq(cashflowTransactions.id, id),
        eq(cashflowTransactions.householdId, scope.primaryHouseholdId),
      ),
    );
  revalidatePath("/financial");
}

export async function createCategory(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const parsed = z
    .object({
      name: z.string().min(1).max(60),
      kind: z.enum(CATEGORY_KINDS),
    })
    .safeParse({ name: str(formData, "name"), kind: str(formData, "kind") });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await db.insert(budgetCategories).values({
      id: randomUUID(),
      householdId: scope.primaryHouseholdId,
      name: parsed.data.name,
      kind: parsed.data.kind,
    });
  } catch (err) {
    // Unique index on (household_id, name)
    if (err instanceof Error && err.message.includes("budget_categories_household_name_uq")) {
      return { ok: false, error: "A category with that name already exists." };
    }
    throw err;
  }

  revalidatePath("/financial");
  return { ok: true, message: "Category added." };
}

export async function archiveCategory(formData: FormData): Promise<void> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = str(formData, "id");
  if (!id) return;
  await db
    .update(budgetCategories)
    .set({ archivedAt: new Date() })
    .where(
      and(eq(budgetCategories.id, id), eq(budgetCategories.householdId, scope.primaryHouseholdId)),
    );
  revalidatePath("/financial");
}

/**
 * Upsert the plan for one (month, category). An empty/zero value clears the
 * plan so the row drops off the heatmap.
 */
export async function setBudgetPlan(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);

  const parsed = z
    .object({
      month: ymSchema,
      categoryId: z.string().min(1),
      planned: z.union([z.string().length(0), z.coerce.number().finite().min(0)]).optional(),
    })
    .safeParse({
      month: str(formData, "month"),
      categoryId: str(formData, "categoryId"),
      planned: str(formData, "planned"),
    });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Ownership check.
  const [cat] = await db
    .select({ id: budgetCategories.id })
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.id, parsed.data.categoryId),
        eq(budgetCategories.householdId, scope.primaryHouseholdId),
      ),
    )
    .limit(1);
  if (!cat) return { ok: false, error: "Category not found." };

  const planned = typeof parsed.data.planned === "number" ? parsed.data.planned : null;

  if (planned === null || planned === 0) {
    await db
      .delete(budgetPeriods)
      .where(
        and(
          eq(budgetPeriods.householdId, scope.primaryHouseholdId),
          eq(budgetPeriods.month, parsed.data.month),
          eq(budgetPeriods.categoryId, parsed.data.categoryId),
        ),
      );
  } else {
    await db
      .insert(budgetPeriods)
      .values({
        id: randomUUID(),
        householdId: scope.primaryHouseholdId,
        categoryId: parsed.data.categoryId,
        month: parsed.data.month,
        plannedAmount: planned.toFixed(2),
      })
      .onConflictDoUpdate({
        target: [budgetPeriods.householdId, budgetPeriods.month, budgetPeriods.categoryId],
        set: { plannedAmount: planned.toFixed(2), updatedAt: new Date() },
      });
  }

  revalidatePath("/financial");
  return { ok: true, message: "Plan saved." };
}
