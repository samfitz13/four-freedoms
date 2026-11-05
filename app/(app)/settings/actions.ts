"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import {
  budgetCategories,
  budgetPeriods,
  cashflowTransactions,
  csvImports,
  financialAccounts,
  financialGoals,
  monthlyStatements,
  monthlySummaries,
  paystubs,
  users,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { getPrimaryHouseholdId } from "@/lib/db/scope";
import { isSupportedCurrency, setBaseCurrency } from "@/lib/freedoms/financial-settings";
import { parseBirthDate } from "@/lib/profile/birth-date";
import type { ProfileActionResult } from "./types";

export async function updateBirthDate(
  _previous: ProfileActionResult,
  formData: FormData,
): Promise<ProfileActionResult> {
  const user = await requireUser();
  const parsed = parseBirthDate(formData.get("birthDate"));
  if (!parsed.ok) return { ok: false, message: parsed.error };
  try {
    await db
      .update(users)
      .set({ birthDate: parsed.birthDate, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  } catch {
    return { ok: false, message: "Could not save birth date." };
  }
  revalidatePath("/settings");
  revalidatePath("/financial", "layout");
  return { ok: true, message: "Saved." };
}

/**
 * Seed a small but realistic Financial dataset into the current household:
 * two accounts with six months of monthly statements, a handful of cashflow
 * transactions, and one FI goal. Idempotent via unique indexes.
 */
export async function seedDevData() {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);

  const today = new Date();
  const day = (offset: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  const month = (offset: number) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1));
    return d.toISOString().slice(0, 10);
  };

  // Accounts: upsert by name.
  const existing = await db
    .select({ id: financialAccounts.id, name: financialAccounts.name })
    .from(financialAccounts)
    .where(eq(financialAccounts.householdId, householdId));
  const byName = new Map(existing.map((a) => [a.name.toLowerCase(), a.id] as const));

  async function ensureAccount(
    name: string,
    type: (typeof financialAccounts.$inferInsert)["type"],
  ): Promise<string> {
    const hit = byName.get(name.toLowerCase());
    if (hit) return hit;
    const id = randomUUID();
    await db.insert(financialAccounts).values({
      id,
      householdId,
      name,
      type,
      currency: "USD",
      isManual: true,
      isArchived: false,
    });
    byName.set(name.toLowerCase(), id);
    return id;
  }

  const checkingId = await ensureAccount("Everyday Checking", "checking");
  const brokerageId = await ensureAccount("Index Brokerage", "brokerage");

  // Six months of monthly statements (oldest → newest).
  const stmtRows: Array<typeof monthlyStatements.$inferInsert> = [];
  for (let i = 5; i >= 0; i--) {
    const m = month(i);
    stmtRows.push({
      id: randomUUID(),
      householdId,
      accountId: checkingId,
      month: m,
      endingBalance: (8_000 + (5 - i) * 600).toFixed(2),
      employeeContribution: "0",
      employerMatch: "0",
    });
    stmtRows.push({
      id: randomUUID(),
      householdId,
      accountId: brokerageId,
      month: m,
      endingBalance: (110_000 + (5 - i) * 5_400).toFixed(2),
      employeeContribution: "1500.00",
      employerMatch: "0",
    });
  }
  if (stmtRows.length) {
    await db
      .insert(monthlyStatements)
      .values(stmtRows)
      .onConflictDoNothing({
        target: [monthlyStatements.accountId, monthlyStatements.month],
      });
  }

  // A few recurring cashflow transactions across the last ~45 days.
  const txRows: Array<typeof cashflowTransactions.$inferInsert> = [];
  for (let i = 1; i <= 3; i++) {
    txRows.push({
      id: randomUUID(),
      householdId,
      accountId: checkingId,
      occurredOn: day(i * 14),
      amount: "4800.00",
      currency: "USD",
      description: "Salary",
      source: "manual",
      externalId: `seed:salary:${i}`,
    });
    txRows.push({
      id: randomUUID(),
      householdId,
      accountId: checkingId,
      occurredOn: day(i * 14 - 3),
      amount: "-1800.00",
      currency: "USD",
      description: "Rent",
      source: "manual",
      externalId: `seed:rent:${i}`,
    });
    txRows.push({
      id: randomUUID(),
      householdId,
      accountId: checkingId,
      occurredOn: day(i * 14 - 7),
      amount: "-420.00",
      currency: "USD",
      description: "Groceries",
      source: "manual",
      externalId: `seed:groceries:${i}`,
    });
  }
  if (txRows.length) {
    await db
      .insert(cashflowTransactions)
      .values(txRows)
      .onConflictDoNothing({
        target: [cashflowTransactions.householdId, cashflowTransactions.externalId],
      });
  }

  // One FI goal.
  const goals = await db
    .select({ id: financialGoals.id })
    .from(financialGoals)
    .where(and(eq(financialGoals.householdId, householdId), eq(financialGoals.kind, "fi_number")));
  if (goals.length === 0) {
    await db.insert(financialGoals).values({
      id: randomUUID(),
      householdId,
      kind: "fi_number",
      title: "Financial independence",
      targetAmount: "1500000.00",
      params: { withdrawalRate: 0.04 },
      status: "active",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/financial", "layout");
  revalidatePath("/settings");

  return { ok: true, message: "Seeded Financial sample data." };
}

/**
 * Update the household's financial base currency. Called from the Settings
 * page Financial section; validates against the supported set.
 */
export async function updateBaseCurrency(formData: FormData) {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);
  const raw = formData.get("baseCurrency");
  const currency = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!isSupportedCurrency(currency)) {
    throw new Error("Unsupported currency.");
  }
  await setBaseCurrency(householdId, currency);
  revalidatePath("/settings");
  revalidatePath("/financial", "layout");
  revalidatePath("/dashboard");
}

/** Wipe every Financial table for this household (dev-only convenience). */
export async function wipeDevData() {
  const user = await requireUser();
  const householdId = await getPrimaryHouseholdId(user.id);

  await db.delete(cashflowTransactions).where(eq(cashflowTransactions.householdId, householdId));
  await db.delete(budgetPeriods).where(eq(budgetPeriods.householdId, householdId));
  await db.delete(budgetCategories).where(eq(budgetCategories.householdId, householdId));
  await db.delete(financialGoals).where(eq(financialGoals.householdId, householdId));
  await db.delete(csvImports).where(eq(csvImports.householdId, householdId));
  await db.delete(monthlyStatements).where(eq(monthlyStatements.householdId, householdId));
  await db.delete(monthlySummaries).where(eq(monthlySummaries.householdId, householdId));
  await db.delete(paystubs).where(eq(paystubs.householdId, householdId));
  await db.delete(financialAccounts).where(eq(financialAccounts.householdId, householdId));

  revalidatePath("/dashboard");
  revalidatePath("/financial", "layout");
  revalidatePath("/settings");

  return { ok: true, message: "Wiped Financial data." };
}
