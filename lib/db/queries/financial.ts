/**
 * Tenant-scoped read helpers for the financial workspace.
 *
 * All functions take `householdId` directly — callers are expected to resolve
 * it via `scopeForUser` first. This module is server-only.
 *
 * Money columns are `numeric(18, 2)` which `postgres.js` returns as strings to
 * preserve precision. Use `toNumber()` (defined here) when you need a JS
 * number for arithmetic or charting, and avoid string-level math.
 */
import "server-only";
import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  budgetCategories,
  budgetPeriods,
  cashflowTransactions,
  financialAccounts,
  financialGoals,
  monthlyStatements,
} from "@/lib/db/schema";
import {
  isIsoOptionAccount,
  isoOptionAccountValues,
  isoOptionAccountValuesByMonth,
} from "./iso-options";

/** Parse a Drizzle `numeric` string value into a JS number. */
export function toNumber(n: string | number | null | undefined): number {
  if (n === null || n === undefined) return 0;
  if (typeof n === "number") return n;
  const parsed = Number(n);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Active accounts by default. Historical reads must explicitly include archived accounts. */
export async function listAccounts(
  householdId: string,
  options: { includeArchived?: boolean } = {},
) {
  return db
    .select()
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.householdId, householdId),
        options.includeArchived ? undefined : eq(financialAccounts.isArchived, false),
      ),
    )
    .orderBy(financialAccounts.name);
}

/**
 * Latest ending balance per account, sourced from `monthly_statements`. The
 * "as of" date is the statement's month (YYYY-MM-01); callers format it as
 * "as of {Month YYYY}". Accounts with no statement yet return `balance: 0`
 * and `asOf: null`.
 * Archived accounts retain their last known balances for reports, not input lists.
 */
export async function latestBalances(householdId: string) {
  const accounts = await listAccounts(householdId, { includeArchived: true });
  const today = new Date().toISOString().slice(0, 10);
  const isoValues = await isoOptionAccountValues(householdId, today);
  const results: Array<{
    accountId: string;
    accountName: string;
    type: (typeof financialAccounts.$inferSelect)["type"];
    currency: string;
    asOf: string | null;
    balance: number;
    isArchived?: boolean;
  }> = [];

  for (const a of accounts) {
    const [latest] = await db
      .select({
        month: monthlyStatements.month,
        endingBalance: monthlyStatements.endingBalance,
      })
      .from(monthlyStatements)
      .where(eq(monthlyStatements.accountId, a.id))
      .orderBy(desc(monthlyStatements.month))
      .limit(1);

    const isIso = isIsoOptionAccount(a.type, a.subtype);
    results.push({
      accountId: a.id,
      accountName: a.name,
      type: a.type,
      currency: a.currency,
      isArchived: a.isArchived,
      asOf: isIso ? today : (latest?.month ?? null),
      balance: isIso ? (isoValues.get(a.id) ?? 0) : toNumber(latest?.endingBalance),
    });
  }
  return results;
}

/**
 * Month-end net worth series. Each point is a YYYY-MM-01 anchor (representing
 * end-of-month for that ISO month). For each month in the window we sum each
 * account's most-recent statement ending balance ≤ that month, debt
 * subtracted. Accounts without any statement on/before a month contribute 0.
 */
export async function netWorthSeries(
  householdId: string,
  months = 12,
  options: { fromEarliest?: boolean } = {},
): Promise<Array<{ date: string; netWorth: number }>> {
  const breakdown = await netWorthBreakdownSeries(householdId, months, options);
  return breakdown.map((point) => ({ date: point.date, netWorth: point.netWorth }));
}

export async function netWorthBreakdownSeries(
  householdId: string,
  months = 12,
  options: { fromEarliest?: boolean } = {},
): Promise<
  Array<{
    date: string;
    netWorth: number;
    netWorthExcludingEquityComp: number;
    equityComp: number;
  }>
> {
  const accounts = await listAccounts(householdId, { includeArchived: true });
  if (accounts.length === 0) return [];

  const accountIds = accounts.map((a) => a.id);
  const byId = new Map(accounts.map((a) => [a.id, a] as const));

  // Pull every statement for these accounts, sorted (account, month asc).
  const statements = await db
    .select({
      accountId: monthlyStatements.accountId,
      month: monthlyStatements.month,
      endingBalance: monthlyStatements.endingBalance,
    })
    .from(monthlyStatements)
    .where(eq(monthlyStatements.householdId, householdId))
    .orderBy(monthlyStatements.accountId, monthlyStatements.month);

  if (statements.length === 0) return [];

  // Determine window: fromEarliest anchors to the first statement on file.
  const now = new Date();
  let start = startOfMonth(addMonths(now, -(months - 1)));
  if (options.fromEarliest) {
    const earliest = statements[0]!.month;
    start = startOfMonth(new Date(earliest + "T00:00:00Z"));
  }
  const totalMonths = options.fromEarliest
    ? Math.max(
        1,
        (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
          (now.getUTCMonth() - start.getUTCMonth()) +
          1,
      )
    : months;

  // Group statements by account, ascending.
  const perAccount = new Map<string, Array<{ month: string; balance: number }>>();
  for (const s of statements) {
    const list = perAccount.get(s.accountId) ?? [];
    list.push({ month: s.month, balance: toNumber(s.endingBalance) });
    perAccount.set(s.accountId, list);
  }

  const monthsList = Array.from({ length: totalMonths }, (_, i) =>
    startOfMonth(addMonths(start, i)).toISOString().slice(0, 10),
  );
  const isoValuesByMonth = await isoOptionAccountValuesByMonth(householdId, monthsList);
  const isoAccountIds = new Set(
    accounts.filter((a) => isIsoOptionAccount(a.type, a.subtype)).map((a) => a.id),
  );
  const series: Array<{
    date: string;
    netWorth: number;
    netWorthExcludingEquityComp: number;
    equityComp: number;
  }> = [];
  // Two-pointer forward-fill per account: at month `m`, use the latest
  // statement with month <= m.
  const cursors = new Map<string, number>();
  const current = new Map<string, number>();

  for (let i = 0; i < totalMonths; i++) {
    const iso = monthsList[i]!;

    for (const id of accountIds) {
      const list = perAccount.get(id) ?? [];
      let idx = cursors.get(id) ?? 0;
      while (idx < list.length && list[idx]!.month <= iso) {
        current.set(id, list[idx]!.balance);
        idx += 1;
      }
      cursors.set(id, idx);
    }
    const isoValues = isoValuesByMonth.get(iso);
    if (isoValues) {
      for (const id of isoAccountIds) current.set(id, isoValues.get(id) ?? 0);
    }

    let total = 0;
    let equityComp = 0;
    for (const [id, bal] of current) {
      const a = byId.get(id);
      if (!a) continue;
      const signed = a.type === "loan" || a.type === "credit_card" ? -Math.abs(bal) : bal;
      total += signed;
      if (isIsoOptionAccount(a.type, a.subtype) || a.type === "equity_comp") {
        equityComp += signed;
      }
    }
    series.push({
      date: iso,
      netWorth: total,
      netWorthExcludingEquityComp: total - equityComp,
      equityComp,
    });
  }

  return series;
}

export async function wealthCategorySeries(
  householdId: string,
  months = 12,
  options: { fromEarliest?: boolean } = {},
): Promise<
  Array<{ date: string; categories: Record<string, number>; accounts: Record<string, number> }>
> {
  const accounts = await listAccounts(householdId, { includeArchived: true });
  if (accounts.length === 0) return [];

  const accountIds = accounts.map((a) => a.id);
  const byId = new Map(accounts.map((a) => [a.id, a] as const));
  const statements = await db
    .select({
      accountId: monthlyStatements.accountId,
      month: monthlyStatements.month,
      endingBalance: monthlyStatements.endingBalance,
    })
    .from(monthlyStatements)
    .where(eq(monthlyStatements.householdId, householdId))
    .orderBy(monthlyStatements.accountId, monthlyStatements.month);

  if (statements.length === 0) return [];

  const now = new Date();
  let start = startOfMonth(addMonths(now, -(months - 1)));
  if (options.fromEarliest) {
    const earliest = statements[0]!.month;
    start = startOfMonth(new Date(earliest + "T00:00:00Z"));
  }
  const totalMonths = options.fromEarliest
    ? Math.max(
        1,
        (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
          (now.getUTCMonth() - start.getUTCMonth()) +
          1,
      )
    : months;

  const perAccount = new Map<string, Array<{ month: string; balance: number }>>();
  for (const s of statements) {
    const list = perAccount.get(s.accountId) ?? [];
    list.push({ month: s.month, balance: toNumber(s.endingBalance) });
    perAccount.set(s.accountId, list);
  }

  const monthsList = Array.from({ length: totalMonths }, (_, i) =>
    startOfMonth(addMonths(start, i)).toISOString().slice(0, 10),
  );
  const isoValuesByMonth = await isoOptionAccountValuesByMonth(householdId, monthsList);
  const isoAccountIds = new Set(
    accounts.filter((a) => isIsoOptionAccount(a.type, a.subtype)).map((a) => a.id),
  );
  const cursors = new Map<string, number>();
  const current = new Map<string, number>();

  return monthsList.map((iso) => {
    for (const id of accountIds) {
      const list = perAccount.get(id) ?? [];
      let idx = cursors.get(id) ?? 0;
      while (idx < list.length && list[idx]!.month <= iso) {
        current.set(id, list[idx]!.balance);
        idx += 1;
      }
      cursors.set(id, idx);
    }
    const isoValues = isoValuesByMonth.get(iso);
    if (isoValues) {
      for (const id of isoAccountIds) current.set(id, isoValues.get(id) ?? 0);
    }

    const categories: Record<string, number> = {};
    const accountValues: Record<string, number> = {};
    for (const [id, balance] of current) {
      if (balance <= 0) continue;
      const account = byId.get(id);
      if (!account) continue;
      const category = wealthCategoryForAccount(account.type, account.subtype);
      categories[category] = (categories[category] ?? 0) + balance;
      accountValues[id] = balance;
    }
    return { date: iso, categories, accounts: accountValues };
  });
}

function wealthCategoryForAccount(type: string, subtype: string | null): string {
  if (isIsoOptionAccount(type, subtype) || type === "equity_comp") return "equity_comp";
  return type;
}

/**
 * Asset allocation bucketed by account type. Uses the latest statement
 * ending balance per account; liabilities (loans, credit cards) are reported
 * with a negative value so the caller can render them on the debt side.
 */
export async function assetAllocation(
  householdId: string,
): Promise<Array<{ bucket: string; value: number }>> {
  const latest = await latestBalances(householdId);
  const buckets = new Map<string, number>();
  for (const b of latest) {
    const signed = b.type === "loan" || b.type === "credit_card" ? -Math.abs(b.balance) : b.balance;
    buckets.set(b.type, (buckets.get(b.type) ?? 0) + signed);
  }
  return Array.from(buckets, ([bucket, value]) => ({ bucket, value })).sort(
    (a, b) => Math.abs(b.value) - Math.abs(a.value),
  );
}

/**
 * Month-bucketed income / expense / net / savings rate for the last
 * `months` months. Positive amounts count as income; negative as expense.
 * `month` is the 1st-of-month ISO date.
 */
export async function cashflowByMonth(
  householdId: string,
  months = 12,
  options: { fromEarliest?: boolean } = {},
): Promise<
  Array<{
    month: string;
    income: number;
    expense: number;
    net: number;
    savingsRate: number;
  }>
> {
  let start = startOfMonth(addMonths(new Date(), -(months - 1)));

  if (options.fromEarliest) {
    const [earliest] = await db
      .select({ occurredOn: sql<string | null>`min(${cashflowTransactions.occurredOn})` })
      .from(cashflowTransactions)
      .where(eq(cashflowTransactions.householdId, householdId));
    if (earliest?.occurredOn) {
      // Anchor to the month of the earliest transaction, period — trim
      // leading empty months, and extend back if data predates the default.
      start = startOfMonth(new Date(earliest.occurredOn));
    }
  }

  // Render every month from `start` through the current month.
  const now = new Date();
  const monthSpan =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
  const totalMonths = options.fromEarliest ? Math.max(1, monthSpan) : months;

  const startIso = start.toISOString().slice(0, 10);

  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${cashflowTransactions.occurredOn}), 'YYYY-MM-DD')`,
      income: sql<string>`coalesce(sum(case when ${cashflowTransactions.amount} > 0 then ${cashflowTransactions.amount} else 0 end), 0)`,
      expense: sql<string>`coalesce(sum(case when ${cashflowTransactions.amount} < 0 then -${cashflowTransactions.amount} else 0 end), 0)`,
    })
    .from(cashflowTransactions)
    .where(
      and(
        eq(cashflowTransactions.householdId, householdId),
        gte(cashflowTransactions.occurredOn, startIso),
        eq(cashflowTransactions.kind, "cashflow"),
      ),
    )
    .groupBy(sql`date_trunc('month', ${cashflowTransactions.occurredOn})`)
    .orderBy(sql`date_trunc('month', ${cashflowTransactions.occurredOn})`);

  const byMonth = new Map(
    rows.map((r) => [
      r.month.slice(0, 10),
      { income: toNumber(r.income), expense: toNumber(r.expense) },
    ]),
  );

  const out: Array<{
    month: string;
    income: number;
    expense: number;
    net: number;
    savingsRate: number;
  }> = [];
  for (let i = 0; i < totalMonths; i++) {
    const d = startOfMonth(addMonths(start, i));
    const iso = d.toISOString().slice(0, 10);
    const hit = byMonth.get(iso) ?? { income: 0, expense: 0 };
    const net = hit.income - hit.expense;
    const savingsRate = hit.income > 0 ? net / hit.income : 0;
    out.push({ month: iso, income: hit.income, expense: hit.expense, net, savingsRate });
  }
  return out;
}

/**
 * Plan vs. actual per budget category for the given month (1st-of-month ISO).
 * Includes every category so the UI can show "no plan yet" rows. `planned`
 * and `actual` are positive magnitudes.
 */
export async function budgetActuals(
  householdId: string,
  month: string,
): Promise<
  Array<{
    categoryId: string;
    name: string;
    kind: (typeof budgetCategories.$inferSelect)["kind"];
    planned: number;
    actual: number;
  }>
> {
  const monthStart = month;
  const monthEnd = new Date(month + "T00:00:00Z");
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  monthEnd.setUTCDate(0); // last day of month
  const monthEndIso = monthEnd.toISOString().slice(0, 10);

  const categories = await db
    .select({
      id: budgetCategories.id,
      name: budgetCategories.name,
      kind: budgetCategories.kind,
    })
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.householdId, householdId),
        sql`${budgetCategories.archivedAt} is null`,
      ),
    )
    .orderBy(budgetCategories.name);

  if (categories.length === 0) return [];

  const plans = await db
    .select({
      categoryId: budgetPeriods.categoryId,
      planned: budgetPeriods.plannedAmount,
    })
    .from(budgetPeriods)
    .where(and(eq(budgetPeriods.householdId, householdId), eq(budgetPeriods.month, monthStart)));
  const planByCat = new Map(plans.map((p) => [p.categoryId, toNumber(p.planned)]));

  const actuals = await db
    .select({
      categoryId: cashflowTransactions.categoryId,
      total: sql<string>`coalesce(sum(abs(${cashflowTransactions.amount})), 0)`,
    })
    .from(cashflowTransactions)
    .where(
      and(
        eq(cashflowTransactions.householdId, householdId),
        gte(cashflowTransactions.occurredOn, monthStart),
        lte(cashflowTransactions.occurredOn, monthEndIso),
        eq(cashflowTransactions.kind, "cashflow"),
        sql`${cashflowTransactions.categoryId} is not null`,
      ),
    )
    .groupBy(cashflowTransactions.categoryId);
  const actualByCat = new Map(
    actuals
      .filter((a): a is { categoryId: string; total: string } => a.categoryId !== null)
      .map((a) => [a.categoryId, toNumber(a.total)]),
  );

  return categories.map((c) => ({
    categoryId: c.id,
    name: c.name,
    kind: c.kind,
    planned: planByCat.get(c.id) ?? 0,
    actual: actualByCat.get(c.id) ?? 0,
  }));
}

/** Recent transactions for the Cashflow tab feed. */
export async function listRecentTransactions(householdId: string, limit = 20) {
  return db
    .select({
      id: cashflowTransactions.id,
      occurredOn: cashflowTransactions.occurredOn,
      amount: cashflowTransactions.amount,
      currency: cashflowTransactions.currency,
      description: cashflowTransactions.description,
      categoryId: cashflowTransactions.categoryId,
      accountId: cashflowTransactions.accountId,
      source: cashflowTransactions.source,
      kind: cashflowTransactions.kind,
      transferGroupId: cashflowTransactions.transferGroupId,
      transferPeerId: cashflowTransactions.transferPeerId,
    })
    .from(cashflowTransactions)
    .where(eq(cashflowTransactions.householdId, householdId))
    .orderBy(desc(cashflowTransactions.occurredOn), desc(cashflowTransactions.createdAt))
    .limit(limit);
}

export type { LedgerFilters, LedgerCursor, LedgerRow } from "./types";
import type { LedgerCursor, LedgerFilters, LedgerRow } from "./types";

/**
 * Keyset-paginated ledger query. Orders by (occurred_on DESC, id DESC) so the
 * cursor pair `(occurredOn, id)` is sufficient. Returns up to `limit` rows
 * plus a `nextCursor` if more exist.
 */
export async function listLedger(
  householdId: string,
  filters: LedgerFilters,
  cursor: LedgerCursor | null,
  limit = 50,
): Promise<{ rows: LedgerRow[]; nextCursor: LedgerCursor | null }> {
  const where = [eq(cashflowTransactions.householdId, householdId)];

  if (filters.q && filters.q.trim().length > 0) {
    const pattern = `%${filters.q.trim()}%`;
    where.push(ilike(cashflowTransactions.description, pattern));
  }
  if (filters.accountId) {
    where.push(eq(cashflowTransactions.accountId, filters.accountId));
  }
  if (filters.categoryId) {
    where.push(eq(cashflowTransactions.categoryId, filters.categoryId));
  }
  if (filters.flow === "income") {
    where.push(eq(cashflowTransactions.kind, "cashflow"));
    where.push(sql`${cashflowTransactions.amount} > 0`);
  } else if (filters.flow === "expense") {
    where.push(eq(cashflowTransactions.kind, "cashflow"));
    where.push(sql`${cashflowTransactions.amount} < 0`);
  } else if (filters.flow === "transfer") {
    where.push(eq(cashflowTransactions.kind, "transfer"));
  }
  if (filters.from) where.push(gte(cashflowTransactions.occurredOn, filters.from));
  if (filters.to) where.push(lte(cashflowTransactions.occurredOn, filters.to));

  if (cursor) {
    where.push(
      or(
        sql`${cashflowTransactions.occurredOn} < ${cursor.occurredOn}`,
        and(
          eq(cashflowTransactions.occurredOn, cursor.occurredOn),
          sql`${cashflowTransactions.id} < ${cursor.id}`,
        ),
      )!,
    );
  }

  const rows = await db
    .select({
      id: cashflowTransactions.id,
      occurredOn: cashflowTransactions.occurredOn,
      amount: cashflowTransactions.amount,
      currency: cashflowTransactions.currency,
      description: cashflowTransactions.description,
      categoryId: cashflowTransactions.categoryId,
      accountId: cashflowTransactions.accountId,
      source: cashflowTransactions.source,
      kind: cashflowTransactions.kind,
      transferGroupId: cashflowTransactions.transferGroupId,
      transferPeerId: cashflowTransactions.transferPeerId,
    })
    .from(cashflowTransactions)
    .where(and(...where))
    .orderBy(desc(cashflowTransactions.occurredOn), desc(cashflowTransactions.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  const last = trimmed[trimmed.length - 1];
  const nextCursor = hasMore && last ? { occurredOn: last.occurredOn, id: last.id } : null;

  return { rows: trimmed, nextCursor };
}

/**
 * Peer accounts for a set of transfer rows. Used by the ledger to render
 * "Chase Checking → Vanguard Brokerage" eyebrow text without N+1 queries.
 */
export async function peerAccountsForTransfers(
  householdId: string,
  groupIds: string[],
): Promise<
  Map<string, Array<{ id: string; accountId: string | null; accountName: string | null }>>
> {
  if (groupIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: cashflowTransactions.id,
      groupId: cashflowTransactions.transferGroupId,
      accountId: cashflowTransactions.accountId,
      accountName: financialAccounts.name,
    })
    .from(cashflowTransactions)
    .leftJoin(financialAccounts, eq(financialAccounts.id, cashflowTransactions.accountId))
    .where(
      and(
        eq(cashflowTransactions.householdId, householdId),
        inArray(cashflowTransactions.transferGroupId, groupIds),
      ),
    );
  const map = new Map<
    string,
    Array<{ id: string; accountId: string | null; accountName: string | null }>
  >();
  for (const r of rows) {
    if (!r.groupId) continue;
    const arr = map.get(r.groupId) ?? [];
    arr.push({ id: r.id, accountId: r.accountId, accountName: r.accountName });
    map.set(r.groupId, arr);
  }
  return map;
}

/**
 * Sum the latest balance across accounts considered "invested" for FI
 * tracking: brokerage, retirement, crypto. Liabilities are ignored. Assumes
 * all accounts are in the base currency (FX conversion is TBD).
 */
export async function currentInvestedBalance(householdId: string): Promise<number> {
  const balances = await latestBalances(householdId);
  const investedTypes = new Set([
    "brokerage",
    "retirement",
    "crypto",
    "equity_comp",
    "iso_options",
  ]);
  return balances
    .filter((b) => investedTypes.has(b.type as string))
    .reduce((s, b) => s + b.balance, 0);
}

/** Current-month budget plan set (for the "manage plan" panel). */
export async function listBudgetPlanForMonth(householdId: string, month: string) {
  return db
    .select({
      categoryId: budgetPeriods.categoryId,
      plannedAmount: budgetPeriods.plannedAmount,
    })
    .from(budgetPeriods)
    .where(and(eq(budgetPeriods.householdId, householdId), eq(budgetPeriods.month, month)));
}

function startOfMonth(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  return out;
}

function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + n);
  return out;
}

export async function listFinancialGoals(householdId: string) {
  return db
    .select()
    .from(financialGoals)
    .where(eq(financialGoals.householdId, householdId))
    .orderBy(desc(financialGoals.createdAt));
}

export async function listBudgetCategories(householdId: string) {
  return db
    .select()
    .from(budgetCategories)
    .where(eq(budgetCategories.householdId, householdId))
    .orderBy(budgetCategories.name);
}
