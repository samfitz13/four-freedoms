"use server";

import { revalidatePath } from "next/cache";
import { and, eq, lt, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { cashflowTransactions, financialAccounts, monthlyStatements } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { scopeForUser } from "@/lib/db/scope";
import {
  monthStart,
  monthEnd,
  upsertMonthlySummary,
  upsertStatement,
} from "@/lib/db/queries/statements";
import { isIsoOptionAccount, isoOptionAccountValues } from "@/lib/db/queries/iso-options";
import type { ActionResult } from "./types";

const monthSchema = z.string().regex(/^\d{4}-\d{2}-01$/, "Month must be YYYY-MM-01");
const numSchema = z.coerce.number().finite();

function fd(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Bulk upsert every statement row submitted from the edit modal. Form fields
 * are namespaced as `bal[<accountId>]`, `ctb[<accountId>]`, `match[<accountId>]`.
 */
export async function saveMonthStatements(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const monthRaw = fd(formData, "month");
  const monthParsed = monthSchema.safeParse(monthRaw);
  if (!monthParsed.success) return { ok: false, error: "Invalid month." };
  const month = monthParsed.data;

  const accounts = await db
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.householdId, scope.primaryHouseholdId),
        eq(financialAccounts.isArchived, false),
      ),
    );

  for (const a of accounts) {
    const balRaw = fd(formData, `bal[${a.id}]`);
    if (balRaw === "") continue; // skipped row
    const ctbRaw = fd(formData, `ctb[${a.id}]`) || "0";
    const matchRaw = fd(formData, `match[${a.id}]`) || "0";
    const parsed = z
      .object({ bal: numSchema, ctb: numSchema, match: numSchema })
      .safeParse({ bal: balRaw, ctb: ctbRaw, match: matchRaw });
    if (!parsed.success) continue;

    await upsertStatement({
      householdId: scope.primaryHouseholdId,
      accountId: a.id,
      month,
      endingBalance: parsed.data.bal,
      employeeContribution: parsed.data.ctb,
      employerMatch: parsed.data.match,
      notes: null,
    });
  }

  // Optional savings rate goal on the same submit.
  const goalRaw = fd(formData, "savingsRateGoal");
  if (goalRaw !== "") {
    const goalParsed = z.coerce.number().min(0).max(100).safeParse(goalRaw);
    if (goalParsed.success) {
      await upsertMonthlySummary({
        householdId: scope.primaryHouseholdId,
        month,
        savingsRateGoal: goalParsed.data / 100,
      });
    }
  }

  revalidatePath("/financial", "layout");
  revalidatePath("/dashboard");
  return { ok: true, message: "Saved." };
}

/**
 * Create draft statement rows for `month` by carrying every active account's
 * most recent prior `monthlyStatement.endingBalance` forward. If no prior
 * statement exists, ending balance defaults to 0. Contributions default to 0.
 */
export async function seedNewMonth(formData: FormData): Promise<void> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const monthRaw = fd(formData, "month") || monthStart(new Date());
  const month = monthSchema.parse(monthRaw);

  const accounts = await db
    .select()
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.householdId, scope.primaryHouseholdId),
        eq(financialAccounts.isArchived, false),
      ),
    );

  const isoValues = await isoOptionAccountValues(scope.primaryHouseholdId, monthEnd(month));

  for (const a of accounts) {
    // Skip if a row already exists for this month.
    const [existing] = await db
      .select({ id: monthlyStatements.id })
      .from(monthlyStatements)
      .where(and(eq(monthlyStatements.accountId, a.id), eq(monthlyStatements.month, month)))
      .limit(1);
    if (existing) continue;

    const [prior] = await db
      .select({ endingBalance: monthlyStatements.endingBalance })
      .from(monthlyStatements)
      .where(and(eq(monthlyStatements.accountId, a.id), lt(monthlyStatements.month, month)))
      .orderBy(desc(monthlyStatements.month))
      .limit(1);
    const isIsoAccount = isIsoOptionAccount(a.type, a.subtype);
    const ending = isIsoAccount
      ? (isoValues.get(a.id) ?? 0)
      : prior
        ? Number(prior.endingBalance)
        : 0;

    await upsertStatement({
      householdId: scope.primaryHouseholdId,
      accountId: a.id,
      month,
      endingBalance: ending,
      employeeContribution: 0,
      employerMatch: 0,
    });
  }

  revalidatePath("/financial", "layout");
}

/** Tag a cashflow transaction as a contribution to a specific account. */
export async function tagContribution(formData: FormData): Promise<void> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = fd(formData, "id");
  const accountId = fd(formData, "accountId");
  if (!id) return;
  await db
    .update(cashflowTransactions)
    .set({ contributionToAccountId: accountId || null })
    .where(
      and(
        eq(cashflowTransactions.id, id),
        eq(cashflowTransactions.householdId, scope.primaryHouseholdId),
      ),
    );
  revalidatePath("/financial", "layout");
}
