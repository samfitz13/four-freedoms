"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
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
import {
  listLedger,
  peerAccountsForTransfers,
  type LedgerCursor,
  type LedgerFilters,
  type LedgerRow,
} from "@/lib/db/queries/financial";

const CATEGORY_KINDS = ["income", "fixed", "variable", "savings", "debt"] as const;
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ymSchema = z.string().regex(/^\d{4}-\d{2}-01$/);

import type { ActionResult, PeerInfo } from "./types";

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

  const kindRaw = str(formData, "flow"); // "income" | "expense" | "transfer"

  // Transfer flow → delegate to addTransfer (which writes both legs).
  if (kindRaw === "transfer") {
    return addTransfer(null, formData);
  }

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
          eq(financialAccounts.isArchived, false),
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

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Transaction added." };
}

export async function updateTransaction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Missing id." };

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
      flow: str(formData, "flow"),
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

  if (parsed.data.accountId) {
    const [hit] = await db
      .select({ id: financialAccounts.id })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.id, parsed.data.accountId),
          eq(financialAccounts.householdId, scope.primaryHouseholdId),
          eq(financialAccounts.isArchived, false),
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

  const result = await db
    .update(cashflowTransactions)
    .set({
      occurredOn: parsed.data.occurredOn,
      amount: signedAmount.toFixed(2),
      currency: parsed.data.currency ?? DEFAULT_BASE_CURRENCY,
      description: parsed.data.description ?? null,
      categoryId: parsed.data.categoryId ?? null,
      accountId: parsed.data.accountId ?? null,
    })
    .where(
      and(
        eq(cashflowTransactions.id, id),
        eq(cashflowTransactions.householdId, scope.primaryHouseholdId),
      ),
    )
    .returning({ id: cashflowTransactions.id });

  if (result.length === 0) return { ok: false, error: "Transaction not found." };

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Transaction updated." };
}

export async function deleteTransaction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = str(formData, "id");
  if (!id) return;

  // Look up the row first — if it's a transfer leg, delete both legs atomically.
  const [row] = await db
    .select({
      id: cashflowTransactions.id,
      kind: cashflowTransactions.kind,
      transferGroupId: cashflowTransactions.transferGroupId,
    })
    .from(cashflowTransactions)
    .where(
      and(
        eq(cashflowTransactions.id, id),
        eq(cashflowTransactions.householdId, scope.primaryHouseholdId),
      ),
    )
    .limit(1);
  if (!row) return;

  if (row.kind === "transfer" && row.transferGroupId) {
    await db
      .delete(cashflowTransactions)
      .where(
        and(
          eq(cashflowTransactions.householdId, scope.primaryHouseholdId),
          eq(cashflowTransactions.transferGroupId, row.transferGroupId),
        ),
      );
  } else {
    await db
      .delete(cashflowTransactions)
      .where(
        and(
          eq(cashflowTransactions.id, id),
          eq(cashflowTransactions.householdId, scope.primaryHouseholdId),
        ),
      );
  }
  revalidatePath("/financial", "layout");
}

const transferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.coerce.number().finite().positive(),
  occurredOn: isoDateSchema,
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  description: z.string().max(200).optional(),
});

async function assertOwnsAccounts(householdId: string, ids: string[]): Promise<boolean> {
  const rows = await db
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.householdId, householdId),
        eq(financialAccounts.isArchived, false),
        // any-of:
        ids.length === 1
          ? eq(financialAccounts.id, ids[0]!)
          : sql`${financialAccounts.id} = any(${ids})`,
      ),
    );
  return rows.length === ids.length;
}

export async function addTransfer(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);

  const parsed = transferSchema.safeParse({
    fromAccountId: str(formData, "fromAccountId"),
    toAccountId: str(formData, "toAccountId"),
    amount: str(formData, "amount"),
    occurredOn: str(formData, "occurredOn"),
    currency: (str(formData, "currency") || undefined) as string | undefined,
    description: str(formData, "description") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { fromAccountId, toAccountId, amount, occurredOn, currency, description } = parsed.data;
  if (fromAccountId === toAccountId) {
    return { ok: false, error: "From and To must be different accounts." };
  }
  const owned = await assertOwnsAccounts(scope.primaryHouseholdId, [fromAccountId, toAccountId]);
  if (!owned) return { ok: false, error: "Account not found." };

  const groupId = randomUUID();
  const fromId = randomUUID();
  const toId = randomUUID();
  const cur = currency ?? DEFAULT_BASE_CURRENCY;

  await db.transaction(async (tx) => {
    await tx.insert(cashflowTransactions).values([
      {
        id: fromId,
        householdId: scope.primaryHouseholdId,
        accountId: fromAccountId,
        occurredOn,
        amount: (-amount).toFixed(2),
        currency: cur,
        description: description ?? null,
        categoryId: null,
        source: "manual",
        kind: "transfer",
        transferGroupId: groupId,
        transferPeerId: toId,
      },
      {
        id: toId,
        householdId: scope.primaryHouseholdId,
        accountId: toAccountId,
        occurredOn,
        amount: amount.toFixed(2),
        currency: cur,
        description: description ?? null,
        categoryId: null,
        source: "manual",
        kind: "transfer",
        transferGroupId: groupId,
        transferPeerId: fromId,
      },
    ]);
  });

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Transfer recorded." };
}

export async function updateTransfer(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const groupId = str(formData, "transferGroupId");
  if (!groupId) return { ok: false, error: "Missing transfer group." };

  const parsed = transferSchema.safeParse({
    fromAccountId: str(formData, "fromAccountId"),
    toAccountId: str(formData, "toAccountId"),
    amount: str(formData, "amount"),
    occurredOn: str(formData, "occurredOn"),
    currency: (str(formData, "currency") || undefined) as string | undefined,
    description: str(formData, "description") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { fromAccountId, toAccountId, amount, occurredOn, currency, description } = parsed.data;
  if (fromAccountId === toAccountId) {
    return { ok: false, error: "From and To must be different accounts." };
  }
  const owned = await assertOwnsAccounts(scope.primaryHouseholdId, [fromAccountId, toAccountId]);
  if (!owned) return { ok: false, error: "Account not found." };

  const existing = await db
    .select({
      id: cashflowTransactions.id,
      amount: cashflowTransactions.amount,
    })
    .from(cashflowTransactions)
    .where(
      and(
        eq(cashflowTransactions.householdId, scope.primaryHouseholdId),
        eq(cashflowTransactions.transferGroupId, groupId),
      ),
    );
  if (existing.length !== 2) return { ok: false, error: "Transfer not found." };

  const cur = currency ?? DEFAULT_BASE_CURRENCY;

  // Replace both legs atomically — keep the ids so peer pointers remain valid.
  const negLeg = existing.find((r) => Number(r.amount) < 0)!;
  const posLeg = existing.find((r) => Number(r.amount) > 0)!;

  await db.transaction(async (tx) => {
    await tx
      .update(cashflowTransactions)
      .set({
        accountId: fromAccountId,
        occurredOn,
        amount: (-amount).toFixed(2),
        currency: cur,
        description: description ?? null,
      })
      .where(eq(cashflowTransactions.id, negLeg.id));
    await tx
      .update(cashflowTransactions)
      .set({
        accountId: toAccountId,
        occurredOn,
        amount: amount.toFixed(2),
        currency: cur,
        description: description ?? null,
      })
      .where(eq(cashflowTransactions.id, posLeg.id));
  });

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Transfer updated." };
}

/**
 * Unwind a transfer back to a single cashflow row. The leg we keep is the
 * one identified by `id`; its peer is deleted and the surviving row's
 * amount is re-signed based on the requested `flow` (`income` | `expense`).
 */
export async function unconvertTransfer(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = str(formData, "id");
  const flow = str(formData, "flow");
  if (!id) return { ok: false, error: "Missing id." };
  if (flow !== "income" && flow !== "expense") {
    return { ok: false, error: "Choose income or expense." };
  }

  const [row] = await db
    .select()
    .from(cashflowTransactions)
    .where(
      and(
        eq(cashflowTransactions.id, id),
        eq(cashflowTransactions.householdId, scope.primaryHouseholdId),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, error: "Transaction not found." };
  if (row.kind !== "transfer" || !row.transferGroupId) {
    return { ok: false, error: "Not a transfer." };
  }

  const newAmount =
    flow === "income"
      ? Math.abs(Number(row.amount)).toFixed(2)
      : (-Math.abs(Number(row.amount))).toFixed(2);

  await db.transaction(async (tx) => {
    await tx.delete(cashflowTransactions).where(
      and(
        eq(cashflowTransactions.householdId, scope.primaryHouseholdId),
        eq(cashflowTransactions.transferGroupId, row.transferGroupId!),
        // keep the row we're editing
        sql`${cashflowTransactions.id} <> ${row.id}`,
      ),
    );
    await tx
      .update(cashflowTransactions)
      .set({
        kind: "cashflow",
        transferGroupId: null,
        transferPeerId: null,
        amount: newAmount,
      })
      .where(eq(cashflowTransactions.id, row.id));
  });

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Converted back." };
}

/**
 * Convert an existing single-leg cashflow row into a transfer by inserting
 * the matching peer leg on `peerAccountId`. The original row is flipped to
 * `kind=transfer` and joined to the new peer via a fresh group id.
 */
export async function convertToTransfer(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const id = str(formData, "id");
  const peerAccountId = str(formData, "peerAccountId");
  if (!id || !peerAccountId) return { ok: false, error: "Missing fields." };

  const [row] = await db
    .select()
    .from(cashflowTransactions)
    .where(
      and(
        eq(cashflowTransactions.id, id),
        eq(cashflowTransactions.householdId, scope.primaryHouseholdId),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, error: "Transaction not found." };
  if (row.kind === "transfer") return { ok: false, error: "Already a transfer." };
  if (!row.accountId) return { ok: false, error: "Source row has no account." };
  if (row.accountId === peerAccountId) {
    return { ok: false, error: "Peer account must be different." };
  }
  const owned = await assertOwnsAccounts(scope.primaryHouseholdId, [row.accountId, peerAccountId]);
  if (!owned) return { ok: false, error: "Peer account not found." };

  const groupId = randomUUID();
  const peerId = randomUUID();
  const peerAmount = (-Number(row.amount)).toFixed(2);

  await db.transaction(async (tx) => {
    await tx.insert(cashflowTransactions).values({
      id: peerId,
      householdId: scope.primaryHouseholdId,
      accountId: peerAccountId,
      occurredOn: row.occurredOn,
      amount: peerAmount,
      currency: row.currency,
      description: row.description,
      categoryId: null,
      source: "manual",
      kind: "transfer",
      transferGroupId: groupId,
      transferPeerId: row.id,
    });
    await tx
      .update(cashflowTransactions)
      .set({
        kind: "transfer",
        categoryId: null,
        transferGroupId: groupId,
        transferPeerId: peerId,
      })
      .where(eq(cashflowTransactions.id, row.id));
  });

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Converted to transfer." };
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

  revalidatePath("/financial", "layout");
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
  revalidatePath("/financial", "layout");
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

  revalidatePath("/financial", "layout");
  return { ok: true, message: "Plan saved." };
}

export async function loadMoreTransactions(input: {
  filters: LedgerFilters;
  cursor: LedgerCursor | null;
  limit?: number;
}): Promise<{
  rows: LedgerRow[];
  nextCursor: LedgerCursor | null;
  peers: Record<string, PeerInfo>;
}> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);
  const { rows, nextCursor } = await listLedger(
    scope.primaryHouseholdId,
    input.filters ?? {},
    input.cursor,
    input.limit ?? 50,
  );

  const groupIds = Array.from(
    new Set(
      rows
        .filter((r) => r.kind === "transfer" && r.transferGroupId)
        .map((r) => r.transferGroupId as string),
    ),
  );
  const peerMap = await peerAccountsForTransfers(scope.primaryHouseholdId, groupIds);

  const peers: Record<string, PeerInfo> = {};
  for (const r of rows) {
    if (r.kind !== "transfer" || !r.transferGroupId) continue;
    const group = peerMap.get(r.transferGroupId);
    if (!group) continue;
    const peer = group.find((g) => g.id !== r.id);
    if (peer) peers[r.id] = { accountId: peer.accountId, accountName: peer.accountName };
  }

  return { rows, nextCursor, peers };
}
