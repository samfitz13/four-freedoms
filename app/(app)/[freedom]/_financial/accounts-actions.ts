"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { accountBalances, financialAccounts } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { scopeForUser } from "@/lib/db/scope";
import { DEFAULT_BASE_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/freedoms/currency";

const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "brokerage",
  "retirement",
  "crypto",
  "real_estate",
  "loan",
  "credit_card",
  "other",
] as const;
const accountTypeSchema = z.enum(ACCOUNT_TYPES);

const currencySchema = z.enum(SUPPORTED_CURRENCIES);

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

import type { ActionResult } from "./types";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function createAccount(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);

  const parsed = z
    .object({
      name: z.string().min(1).max(80),
      type: accountTypeSchema,
      currency: currencySchema,
      institution: z.string().max(80).optional(),
      initialBalance: z.union([z.string().length(0), z.coerce.number().finite()]).optional(),
      initialAsOf: isoDateSchema.optional(),
    })
    .safeParse({
      name: str(formData, "name"),
      type: str(formData, "type"),
      currency: str(formData, "currency") || DEFAULT_BASE_CURRENCY,
      institution: str(formData, "institution") || undefined,
      initialBalance: str(formData, "initialBalance") || undefined,
      initialAsOf: str(formData, "initialAsOf") || undefined,
    });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(financialAccounts).values({
      id,
      householdId: scope.primaryHouseholdId,
      name: parsed.data.name,
      type: parsed.data.type,
      currency: parsed.data.currency,
      institution: parsed.data.institution ?? null,
      isManual: true,
      isArchived: false,
    });

    const balance = parsed.data.initialBalance;
    if (typeof balance === "number" && Number.isFinite(balance)) {
      const asOf = parsed.data.initialAsOf ?? new Date().toISOString().slice(0, 10);
      await tx.insert(accountBalances).values({
        id: randomUUID(),
        accountId: id,
        asOf,
        balance: balance.toFixed(2),
        source: "manual",
      });
    }
  });

  revalidatePath("/financial");
  return { ok: true, message: "Account added." };
}

export async function updateAccount(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);

  const parsed = z
    .object({
      id: z.string().min(1),
      name: z.string().min(1).max(80),
      type: accountTypeSchema,
      currency: currencySchema,
      institution: z.string().max(80).optional(),
    })
    .safeParse({
      id: str(formData, "id"),
      name: str(formData, "name"),
      type: str(formData, "type"),
      currency: str(formData, "currency"),
      institution: str(formData, "institution") || undefined,
    });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await db
    .update(financialAccounts)
    .set({
      name: parsed.data.name,
      type: parsed.data.type,
      currency: parsed.data.currency,
      institution: parsed.data.institution ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(financialAccounts.id, parsed.data.id),
        eq(financialAccounts.householdId, scope.primaryHouseholdId),
      ),
    )
    .returning({ id: financialAccounts.id });

  if (result.length === 0) {
    return { ok: false, error: "Account not found." };
  }

  revalidatePath("/financial");
  return { ok: true, message: "Saved." };
}

export async function archiveAccount(formData: FormData): Promise<void> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = str(formData, "id");
  if (!id) return;

  await db
    .update(financialAccounts)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(
      and(
        eq(financialAccounts.id, id),
        eq(financialAccounts.householdId, scope.primaryHouseholdId),
      ),
    );

  revalidatePath("/financial");
}

export async function recordBalance(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);

  const parsed = z
    .object({
      accountId: z.string().min(1),
      asOf: isoDateSchema,
      balance: z.coerce.number().finite(),
      note: z.string().max(200).optional(),
    })
    .safeParse({
      accountId: str(formData, "accountId"),
      asOf: str(formData, "asOf"),
      balance: str(formData, "balance"),
      note: str(formData, "note") || undefined,
    });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Ownership check: the account must belong to this household.
  const [account] = await db
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.id, parsed.data.accountId),
        eq(financialAccounts.householdId, scope.primaryHouseholdId),
      ),
    )
    .limit(1);

  if (!account) {
    return { ok: false, error: "Account not found." };
  }

  await db
    .insert(accountBalances)
    .values({
      id: randomUUID(),
      accountId: parsed.data.accountId,
      asOf: parsed.data.asOf,
      balance: parsed.data.balance.toFixed(2),
      source: "manual",
      note: parsed.data.note ?? null,
    })
    .onConflictDoUpdate({
      target: [accountBalances.accountId, accountBalances.asOf],
      set: {
        balance: parsed.data.balance.toFixed(2),
        note: parsed.data.note ?? null,
        source: "manual",
      },
    });

  revalidatePath("/financial");
  return { ok: true, message: "Balance recorded." };
}
