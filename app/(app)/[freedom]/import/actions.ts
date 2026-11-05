"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  budgetCategories,
  cashflowTransactions,
  csvImports,
  financialAccounts,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth-server";
import { scopeForUser } from "@/lib/db/scope";
import { DEFAULT_BASE_CURRENCY, isSupportedCurrency } from "@/lib/freedoms/currency";
import {
  isBalancePseudoRow,
  normalizeDate,
  normalizeHeader,
  parseLooseNumber,
  preprocessTransactionCsv,
} from "@/lib/financial/csv-clean";

import { IMPORT_KINDS, MAX_BYTES, MAX_ROWS } from "./constants";
import type { ImportKind, ImportResult } from "./types";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Transaction rows after our `csv-clean` normalization. `date` and
 * `amount` are already coerced before reaching this schema.
 */
const transactionRowSchema = z.object({
  date: isoDateSchema,
  description: z.string().max(200).optional(),
  amount: z.number().finite(),
  category: z.string().optional(),
  account: z.string().optional(),
  currency: z.string().optional(),
  external_id: z.string().max(200).optional(),
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

  const accountIdRaw = (formData.get("accountId") as string | null)?.trim() ?? "";
  const accountIdOverride = accountIdRaw.length > 0 ? accountIdRaw : null;

  const rawText = await file.text();

  // Strip a bank-style summary preamble before parsing.
  const pre = preprocessTransactionCsv(rawText);
  const parseText = pre.body;

  let records: CsvRecord[];
  try {
    records = parse(parseText, {
      columns: (header: string[]) =>
        header.map((h) => normalizeHeader(h.trim().toLowerCase().replace(/\s+/g, "_"))),
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
      bom: true,
      skip_records_with_error: true,
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
    const result = await importTransactions({
      householdId: scope.primaryHouseholdId,
      records,
      errors,
      batchId,
      accountIdOverride,
    });
    inserted = result.inserted;
    skipped = result.skipped;
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

  revalidatePath("/financial", "layout");

  return {
    ok: true,
    kind,
    inserted,
    skipped,
    errors: errors.slice(0, 20),
  };
}

async function importTransactions({
  householdId,
  records,
  errors,
  batchId,
  accountIdOverride,
}: {
  householdId: string;
  records: CsvRecord[];
  errors: Array<{ row: number; message: string }>;
  batchId: string;
  accountIdOverride: string | null;
}) {
  const [accountRows, categoryRows] = await Promise.all([
    db
      .select({
        id: financialAccounts.id,
        name: financialAccounts.name,
        isArchived: financialAccounts.isArchived,
      })
      .from(financialAccounts)
      .where(eq(financialAccounts.householdId, householdId)),
    db
      .select({ id: budgetCategories.id, name: budgetCategories.name })
      .from(budgetCategories)
      .where(eq(budgetCategories.householdId, householdId)),
  ]);
  const accountByName = new Map(accountRows.map((a) => [a.name.toLowerCase(), a.id] as const));
  const categoryByName = new Map(categoryRows.map((c) => [c.name.toLowerCase(), c.id] as const));

  if (accountIdOverride) {
    const owns = accountRows.some((a) => a.id === accountIdOverride && !a.isArchived);
    if (!owns) {
      errors.push({ row: 0, message: "Selected account not found." });
      return { inserted: 0, skipped: 0 };
    }
  }

  const seen = new Set<string>();
  let inserted = 0;
  let skipped = 0;

  for (const [i, raw] of records.entries()) {
    const dateRaw =
      typeof raw.date === "string" ? raw.date : raw.date != null ? String(raw.date) : "";
    const isoDate = normalizeDate(dateRaw);
    const description =
      typeof raw.description === "string"
        ? raw.description.trim()
        : raw.description != null
          ? String(raw.description)
          : "";

    if (isBalancePseudoRow(description)) {
      skipped += 1;
      continue;
    }

    let amount = parseLooseNumber(typeof raw.amount === "string" ? raw.amount : null);
    if (!Number.isFinite(amount)) {
      const credit = parseLooseNumber(typeof raw.credit === "string" ? raw.credit : null);
      const debit = parseLooseNumber(typeof raw.debit === "string" ? raw.debit : null);
      if (Number.isFinite(credit) || Number.isFinite(debit)) {
        amount = (Number.isFinite(credit) ? credit : 0) - (Number.isFinite(debit) ? debit : 0);
      }
    }

    if (!isoDate || !Number.isFinite(amount)) {
      skipped += 1;
      continue;
    }

    const candidate = {
      date: isoDate,
      description: description || undefined,
      amount,
      category: typeof raw.category === "string" ? raw.category : undefined,
      account: typeof raw.account === "string" ? raw.account : undefined,
      currency: typeof raw.currency === "string" ? raw.currency : undefined,
      external_id: typeof raw.external_id === "string" ? raw.external_id : undefined,
    };
    const parsed = transactionRowSchema.safeParse(candidate);
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

    let accountId: string | null = accountIdOverride;
    if (!accountId && row.account) {
      accountId = accountByName.get(row.account.toLowerCase()) ?? null;
    }
    if (accountRows.some((a) => a.id === accountId && a.isArchived)) {
      errors.push({ row: i + 2, message: "This account is archived and cannot accept new input." });
      skipped += 1;
      continue;
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

    const dedupAccount = accountId ?? "no-account";
    const externalId = row.external_id
      ? `${row.external_id}`
      : `csv:${dedupAccount}:${row.date}:${row.amount.toFixed(2)}:${(row.description ?? "").slice(0, 40)}`;

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

function zodMessage(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid row.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
