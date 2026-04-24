"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  accountBalances,
  budgetCategories,
  cashflowTransactions,
  csvImports,
  financialAccounts,
  holdings,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { scopeForUser } from "@/lib/db/scope";
import { DEFAULT_BASE_CURRENCY, isSupportedCurrency } from "@/lib/freedoms/currency";

import { IMPORT_KINDS, MAX_BYTES, MAX_ROWS } from "./constants";
import type { ImportKind, ImportResult } from "./types";

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

const ASSET_CLASSES = [
  "cash",
  "equity",
  "fixed_income",
  "crypto",
  "real_estate",
  "alt",
  "other",
] as const;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const accountRowSchema = z.object({
  account_name: z.string().min(1).max(80),
  type: z.enum(ACCOUNT_TYPES),
  balance: z.coerce.number().finite(),
  as_of: isoDateSchema,
  currency: z.string().optional(),
  institution: z.string().optional(),
});

const transactionRowSchema = z.object({
  date: isoDateSchema,
  description: z.string().max(200).optional(),
  amount: z.coerce.number().finite(),
  category: z.string().optional(),
  account: z.string().optional(),
  currency: z.string().optional(),
  external_id: z.string().max(200).optional(),
});

const holdingRowSchema = z.object({
  account: z.string().min(1).max(80),
  symbol: z.string().min(1).max(20),
  name: z.string().optional(),
  asset_class: z.enum(ASSET_CLASSES).optional(),
  quantity: z.coerce.number().finite(),
  cost_basis: z.coerce.number().finite().optional(),
  as_of: isoDateSchema.optional(),
  currency: z.string().optional(),
});

type CsvRecord = Record<string, unknown>;

export async function importCsv(
  _prev: ImportResult | null,
  formData: FormData,
): Promise<ImportResult> {
  const user = await requireUser();
  const scope = await scopeForUser(user.id);

  const kindRaw = (formData.get("kind") as string | null)?.trim() ?? "";
  if (!IMPORT_KINDS.includes(kindRaw as ImportKind)) {
    return { ok: false, error: "Pick a format." };
  }
  const kind = kindRaw as ImportKind;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Select a CSV file." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `File too large (> ${MAX_BYTES / 1024 / 1024}MB).` };
  }

  const text = await file.text();
  let records: CsvRecord[];
  try {
    records = parse(text, {
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_")),
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      bom: true,
    }) as CsvRecord[];
  } catch (err) {
    return { ok: false, error: `Failed to parse CSV: ${(err as Error).message}` };
  }

  if (records.length === 0) {
    return { ok: false, error: "CSV has no data rows." };
  }
  if (records.length > MAX_ROWS) {
    return {
      ok: false,
      error: `Too many rows (${records.length}). Max ${MAX_ROWS} per upload.`,
    };
  }

  const batchId = randomUUID();
  const errors: Array<{ row: number; message: string }> = [];
  let inserted = 0;
  let skipped = 0;

  try {
    if (kind === "accounts") {
      const result = await importAccounts({
        householdId: scope.primaryHouseholdId,
        records,
        errors,
      });
      inserted = result.inserted;
      skipped = result.skipped;
    } else if (kind === "transactions") {
      const result = await importTransactions({
        householdId: scope.primaryHouseholdId,
        records,
        errors,
        batchId,
      });
      inserted = result.inserted;
      skipped = result.skipped;
    } else {
      const result = await importHoldings({
        householdId: scope.primaryHouseholdId,
        records,
        errors,
      });
      inserted = result.inserted;
      skipped = result.skipped;
    }
  } catch (err) {
    return { ok: false, error: `Import failed: ${(err as Error).message}` };
  }

  const status = errors.length === 0 ? "succeeded" : inserted > 0 ? "partial" : "failed";

  await db.insert(csvImports).values({
    id: batchId,
    householdId: scope.primaryHouseholdId,
    authorId: user.id,
    kind,
    filename: file.name || "upload.csv",
    rowCount: inserted,
    status,
    errorJson: errors.length ? { errors: errors.slice(0, 50) } : null,
  });

  revalidatePath("/financial");

  return { ok: true, kind, inserted, skipped, errors: errors.slice(0, 20) };
}

// ---------------------------------------------------------------------------
// Per-kind importers
// ---------------------------------------------------------------------------

async function importAccounts({
  householdId,
  records,
  errors,
}: {
  householdId: string;
  records: CsvRecord[];
  errors: Array<{ row: number; message: string }>;
}) {
  // Cache: name → accountId (create-or-reuse).
  const existing = await db
    .select({ id: financialAccounts.id, name: financialAccounts.name })
    .from(financialAccounts)
    .where(eq(financialAccounts.householdId, householdId));
  const byName = new Map(existing.map((a) => [a.name.toLowerCase(), a.id] as const));

  let inserted = 0;
  let skipped = 0;

  for (const [i, raw] of records.entries()) {
    const parsed = accountRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: i + 2, message: zodMessage(parsed.error) });
      skipped += 1;
      continue;
    }
    const row = parsed.data;
    const currency =
      row.currency && isSupportedCurrency(row.currency.toUpperCase())
        ? row.currency.toUpperCase()
        : DEFAULT_BASE_CURRENCY;

    await db.transaction(async (tx) => {
      let accountId = byName.get(row.account_name.toLowerCase());
      if (!accountId) {
        accountId = randomUUID();
        await tx.insert(financialAccounts).values({
          id: accountId,
          householdId,
          name: row.account_name,
          type: row.type,
          currency,
          institution: row.institution ?? null,
          isManual: false,
          isArchived: false,
        });
        byName.set(row.account_name.toLowerCase(), accountId);
      }
      await tx
        .insert(accountBalances)
        .values({
          id: randomUUID(),
          accountId,
          asOf: row.as_of,
          balance: row.balance.toFixed(2),
          source: "import",
        })
        .onConflictDoUpdate({
          target: [accountBalances.accountId, accountBalances.asOf],
          set: { balance: row.balance.toFixed(2), source: "import" },
        });
    });

    inserted += 1;
  }

  return { inserted, skipped };
}

async function importTransactions({
  householdId,
  records,
  errors,
  batchId,
}: {
  householdId: string;
  records: CsvRecord[];
  errors: Array<{ row: number; message: string }>;
  batchId: string;
}) {
  // Cache accounts + categories by name to avoid N queries inside the loop.
  const [accountRows, categoryRows] = await Promise.all([
    db
      .select({ id: financialAccounts.id, name: financialAccounts.name })
      .from(financialAccounts)
      .where(eq(financialAccounts.householdId, householdId)),
    db
      .select({ id: budgetCategories.id, name: budgetCategories.name })
      .from(budgetCategories)
      .where(eq(budgetCategories.householdId, householdId)),
  ]);
  const accountByName = new Map(accountRows.map((a) => [a.name.toLowerCase(), a.id] as const));
  const categoryByName = new Map(categoryRows.map((c) => [c.name.toLowerCase(), c.id] as const));

  // Track de-dup on (date, amount, description) within the batch to avoid
  // hammering the DB for obvious dupes.
  const seen = new Set<string>();
  let inserted = 0;
  let skipped = 0;

  for (const [i, raw] of records.entries()) {
    const parsed = transactionRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: i + 2, message: zodMessage(parsed.error) });
      skipped += 1;
      continue;
    }
    const row = parsed.data;
    const currency =
      row.currency && isSupportedCurrency(row.currency.toUpperCase())
        ? row.currency.toUpperCase()
        : DEFAULT_BASE_CURRENCY;

    let accountId: string | null = null;
    if (row.account) {
      accountId = accountByName.get(row.account.toLowerCase()) ?? null;
    }

    let categoryId: string | null = null;
    if (row.category) {
      const key = row.category.toLowerCase();
      let id = categoryByName.get(key);
      if (!id) {
        id = randomUUID();
        await db.insert(budgetCategories).values({
          id,
          householdId,
          name: row.category,
          kind: row.amount >= 0 ? "income" : "variable",
        });
        categoryByName.set(key, id);
      }
      categoryId = id;
    }

    // Prefer external_id for dedup; fall back to a synthetic key.
    const externalId = row.external_id
      ? `${row.external_id}`
      : `csv:${row.date}:${row.amount.toFixed(2)}:${(row.description ?? "").slice(0, 40)}`;

    if (seen.has(externalId)) {
      skipped += 1;
      continue;
    }
    seen.add(externalId);

    try {
      const result = await db
        .insert(cashflowTransactions)
        .values({
          id: randomUUID(),
          householdId,
          accountId,
          occurredOn: row.date,
          amount: row.amount.toFixed(2),
          currency,
          description: row.description ?? null,
          categoryId,
          source: "import",
          externalId,
          importBatchId: batchId,
        })
        .onConflictDoNothing({
          target: [cashflowTransactions.householdId, cashflowTransactions.externalId],
        })
        .returning({ id: cashflowTransactions.id });

      if (result.length > 0) inserted += 1;
      else skipped += 1;
    } catch (err) {
      errors.push({ row: i + 2, message: (err as Error).message });
      skipped += 1;
    }
  }

  return { inserted, skipped };
}

async function importHoldings({
  householdId,
  records,
  errors,
}: {
  householdId: string;
  records: CsvRecord[];
  errors: Array<{ row: number; message: string }>;
}) {
  const existing = await db
    .select({ id: financialAccounts.id, name: financialAccounts.name })
    .from(financialAccounts)
    .where(eq(financialAccounts.householdId, householdId));
  const accountByName = new Map(existing.map((a) => [a.name.toLowerCase(), a.id] as const));

  let inserted = 0;
  let skipped = 0;

  for (const [i, raw] of records.entries()) {
    const parsed = holdingRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: i + 2, message: zodMessage(parsed.error) });
      skipped += 1;
      continue;
    }
    const row = parsed.data;

    let accountId = accountByName.get(row.account.toLowerCase());
    if (!accountId) {
      // Create a stub brokerage account so the holding has somewhere to live.
      accountId = randomUUID();
      await db.insert(financialAccounts).values({
        id: accountId,
        householdId,
        name: row.account,
        type: "brokerage",
        currency: DEFAULT_BASE_CURRENCY,
        isManual: false,
        isArchived: false,
      });
      accountByName.set(row.account.toLowerCase(), accountId);
    }

    const currency =
      row.currency && isSupportedCurrency(row.currency.toUpperCase())
        ? row.currency.toUpperCase()
        : DEFAULT_BASE_CURRENCY;

    try {
      // Upsert on (account_id, symbol).
      const upsert = await db
        .insert(holdings)
        .values({
          id: randomUUID(),
          accountId,
          symbol: row.symbol.toUpperCase(),
          name: row.name ?? null,
          assetClass: row.asset_class ?? "equity",
          quantity: row.quantity.toFixed(8),
          costBasis: row.cost_basis !== undefined ? row.cost_basis.toFixed(2) : null,
          currency,
        })
        .onConflictDoUpdate({
          target: [holdings.accountId, holdings.symbol],
          set: {
            name: row.name ?? null,
            assetClass: row.asset_class ?? "equity",
            quantity: row.quantity.toFixed(8),
            costBasis: row.cost_basis !== undefined ? row.cost_basis.toFixed(2) : null,
            updatedAt: new Date(),
          },
        })
        .returning({ id: holdings.id });

      if (upsert.length > 0) inserted += 1;
      else skipped += 1;
    } catch (err) {
      errors.push({ row: i + 2, message: (err as Error).message });
      skipped += 1;
    }
  }

  return { inserted, skipped };
}

function zodMessage(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid row.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
