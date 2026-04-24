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
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  accountBalances,
  budgetCategories,
  budgetPeriods,
  cashflowTransactions,
  entries,
  financialAccounts,
  financialGoals,
} from "@/lib/db/schema";

/** Parse a Drizzle `numeric` string value into a JS number. */
export function toNumber(n: string | number | null | undefined): number {
  if (n === null || n === undefined) return 0;
  if (typeof n === "number") return n;
  const parsed = Number(n);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function listAccounts(householdId: string) {
  return db
    .select()
    .from(financialAccounts)
    .where(
      and(eq(financialAccounts.householdId, householdId), eq(financialAccounts.isArchived, false)),
    )
    .orderBy(financialAccounts.name);
}

/**
 * Latest balance per account for a household. Implemented as a per-account
 * lookup for simplicity; wealth-tab queries will graduate to a window
 * function once the volume justifies it.
 */
export async function latestBalances(householdId: string) {
  const accounts = await listAccounts(householdId);
  const results: Array<{
    accountId: string;
    accountName: string;
    type: (typeof financialAccounts.$inferSelect)["type"];
    currency: string;
    asOf: string | null;
    balance: number;
  }> = [];

  for (const a of accounts) {
    const [latest] = await db
      .select({
        asOf: accountBalances.asOf,
        balance: accountBalances.balance,
      })
      .from(accountBalances)
      .where(eq(accountBalances.accountId, a.id))
      .orderBy(desc(accountBalances.asOf))
      .limit(1);

    results.push({
      accountId: a.id,
      accountName: a.name,
      type: a.type,
      currency: a.currency,
      asOf: latest?.asOf ?? null,
      balance: toNumber(latest?.balance),
    });
  }
  return results;
}

/**
 * Placeholder implementations — wired in later PRs.
 * Kept as named exports so callers can import without TS errors today.
 */

/**
 * Daily net worth series for the last `months` months, assembled in memory
 * from per-account balance snapshots with forward-fill. Accounts without any
 * snapshot in the window contribute 0 for days before their first snapshot.
 * Loans/credit cards are subtracted (treated as liabilities).
 */
export async function netWorthSeries(
  householdId: string,
  months = 12,
): Promise<Array<{ date: string; netWorth: number }>> {
  const accounts = await listAccounts(householdId);
  if (accounts.length === 0) return [];

  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  const startIso = start.toISOString().slice(0, 10);

  const ids = accounts.map((a) => a.id);
  const byId = new Map(accounts.map((a) => [a.id, a] as const));

  // Pull every balance from ~6mo before the window too so we can forward-fill
  // into the first day. Simpler: pull all balances for these accounts.
  const balances = await db
    .select({
      accountId: accountBalances.accountId,
      asOf: accountBalances.asOf,
      balance: accountBalances.balance,
    })
    .from(accountBalances)
    .where(inArray(accountBalances.accountId, ids))
    .orderBy(accountBalances.accountId, accountBalances.asOf);

  if (balances.length === 0) return [];

  // Group by account, sorted ascending by asOf.
  const perAccount = new Map<string, Array<{ asOf: string; balance: number }>>();
  for (const b of balances) {
    const list = perAccount.get(b.accountId) ?? [];
    list.push({ asOf: b.asOf, balance: toNumber(b.balance) });
    perAccount.set(b.accountId, list);
  }

  // Build day list.
  const days: string[] = [];
  const d = new Date(start);
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }

  // Two-pointer forward-fill per account.
  const cursors = new Map<string, number>();
  const current = new Map<string, number>();

  const series: Array<{ date: string; netWorth: number }> = [];
  for (const day of days) {
    for (const id of ids) {
      const list = perAccount.get(id) ?? [];
      let idx = cursors.get(id) ?? 0;
      while (idx < list.length && list[idx]!.asOf <= day) {
        current.set(id, list[idx]!.balance);
        idx += 1;
      }
      cursors.set(id, idx);
    }

    let total = 0;
    for (const [id, bal] of current) {
      const a = byId.get(id);
      if (!a) continue;
      // TODO: FX conversion using household base currency once rates land.
      const signed = a.type === "loan" || a.type === "credit_card" ? -Math.abs(bal) : bal;
      total += signed;
    }
    // Only emit days on or after the window start.
    if (day >= startIso) series.push({ date: day, netWorth: total });
  }

  return series;
}

/**
 * Asset allocation bucketed by account type. Uses the latest balance per
 * account; liabilities (loans, credit cards) are reported with a negative
 * value so the caller can render them on the debt side.
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
 * Balance history for a single account within the last `days` days. Used by
 * the Accounts tab drawer to show recent entries.
 */
export async function listBalancesForAccount(accountId: string, days = 180) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return db
    .select({
      id: accountBalances.id,
      asOf: accountBalances.asOf,
      balance: accountBalances.balance,
      source: accountBalances.source,
      note: accountBalances.note,
    })
    .from(accountBalances)
    .where(and(eq(accountBalances.accountId, accountId), gte(accountBalances.asOf, cutoffIso)))
    .orderBy(desc(accountBalances.asOf));
}

/**
 * Month-bucketed income / expense / net / savings rate for the last
 * `months` months. Positive amounts count as income; negative as expense.
 * `month` is the 1st-of-month ISO date.
 */
export async function cashflowByMonth(
  householdId: string,
  months = 12,
): Promise<
  Array<{
    month: string;
    income: number;
    expense: number;
    net: number;
    savingsRate: number;
  }>
> {
  const start = startOfMonth(addMonths(new Date(), -(months - 1)));
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
  for (let i = 0; i < months; i++) {
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
    })
    .from(cashflowTransactions)
    .where(eq(cashflowTransactions.householdId, householdId))
    .orderBy(desc(cashflowTransactions.occurredOn), desc(cashflowTransactions.createdAt))
    .limit(limit);
}

/**
 * Sum the latest balance across accounts considered "invested" for FI
 * tracking: brokerage, retirement, crypto. Liabilities are ignored. Assumes
 * all accounts are in the base currency (FX conversion is TBD).
 */
export async function currentInvestedBalance(householdId: string): Promise<number> {
  const balances = await latestBalances(householdId);
  const investedTypes = new Set(["brokerage", "retirement", "crypto"]);
  return balances
    .filter((b) => investedTypes.has(b.type as string))
    .reduce((s, b) => s + b.balance, 0);
}

/**
 * Latest reported net worth from freedom `entries` — a cheap fallback when the
 * user hasn't wired up accounts yet.
 */
export async function latestReportedNetWorth(householdId: string): Promise<number | null> {
  const [row] = await db
    .select({ payload: entries.payload, occurredOn: entries.occurredOn })
    .from(entries)
    .where(and(eq(entries.householdId, householdId), eq(entries.freedom, "financial")))
    .orderBy(desc(entries.occurredOn), desc(entries.createdAt))
    .limit(1);
  if (!row) return null;
  const payload = row.payload as Record<string, unknown> | null;
  const v = payload?.netWorth;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
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
