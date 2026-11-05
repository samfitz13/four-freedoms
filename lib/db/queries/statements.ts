/**
 * Tenant-scoped read/write helpers for the monthly statements ledger.
 *
 * `month` is always the first day of the month (YYYY-MM-01); the balance
 * stored on the row is implicitly end-of-month. Money columns are
 * `numeric` and round-trip as strings — use `toNumber()` from `./financial`.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  cashflowTransactions,
  financialAccounts,
  monthlyStatements,
  monthlySummaries,
  paystubs,
} from "@/lib/db/schema";
import { toNumber, listAccounts } from "./financial";
import type { PaystubStateTax, StatementWithAccount } from "./types";

export type { PaystubStateTax, StatementWithAccount };

/** First day of the ISO month containing `d`, as YYYY-MM-01. */
export function monthStart(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d + "T00:00:00Z") : d;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Last day (28..31) of the ISO month starting at `month`. */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  // Day 0 of next month = last day of this month.
  const d = new Date(Date.UTC(y!, m!, 0));
  return d.toISOString().slice(0, 10);
}

/** Subtract `n` months from a YYYY-MM-01 string. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + n, 1));
  return monthStart(d);
}

export async function listStatementsForMonth(
  householdId: string,
  month: string,
): Promise<StatementWithAccount[]> {
  const columns = {
    id: monthlyStatements.id,
    accountId: monthlyStatements.accountId,
    accountName: financialAccounts.name,
    isArchived: financialAccounts.isArchived,
    type: financialAccounts.type,
    subtype: financialAccounts.subtype,
    currency: financialAccounts.currency,
    month: monthlyStatements.month,
    endingBalance: monthlyStatements.endingBalance,
    employeeContribution: monthlyStatements.employeeContribution,
    employerMatch: monthlyStatements.employerMatch,
    notes: monthlyStatements.notes,
  };
  const rows = await db
    .select(columns)
    .from(monthlyStatements)
    .innerJoin(financialAccounts, eq(financialAccounts.id, monthlyStatements.accountId))
    .where(
      and(
        eq(monthlyStatements.householdId, householdId),
        eq(financialAccounts.householdId, householdId),
        eq(monthlyStatements.month, month),
      ),
    )
    .orderBy(asc(financialAccounts.name));

  // Archiving stops entry, not ownership. Carry the final recorded balance
  // only after its statement month, with no invented contributions.
  const archived = await db
    .selectDistinctOn([monthlyStatements.accountId], columns)
    .from(monthlyStatements)
    .innerJoin(financialAccounts, eq(financialAccounts.id, monthlyStatements.accountId))
    .where(
      and(
        eq(monthlyStatements.householdId, householdId),
        eq(financialAccounts.householdId, householdId),
        eq(financialAccounts.isArchived, true),
      ),
    )
    .orderBy(monthlyStatements.accountId, desc(monthlyStatements.month));
  const carried = archived
    .filter((r) => r.month < month && !rows.some((row) => row.accountId === r.accountId))
    .map((r) => ({
      ...r,
      employeeContribution: "0",
      employerMatch: "0",
      carriedFromMonth: r.month,
    }));
  return [...rows, ...carried].map((r) => ({
    ...r,
    endingBalance: toNumber(r.endingBalance),
    employeeContribution: toNumber(r.employeeContribution),
    employerMatch: toNumber(r.employerMatch),
  }));
}

/** Distinct months for which the household has any statement, newest first. */
export async function listStatementMonths(householdId: string): Promise<string[]> {
  const rows = await db
    .select({ month: monthlyStatements.month })
    .from(monthlyStatements)
    .where(eq(monthlyStatements.householdId, householdId))
    .groupBy(monthlyStatements.month)
    .orderBy(desc(monthlyStatements.month));
  return rows.map((r) => r.month as unknown as string);
}

/** Per-account history for the last `months` months (oldest first). */
export async function getStatementHistory(
  householdId: string,
  months = 12,
): Promise<
  Array<{
    accountId: string;
    accountName: string;
    type: (typeof financialAccounts.$inferSelect)["type"];
    subtype: string | null;
    points: Array<{
      month: string;
      endingBalance: number;
      employeeContribution: number;
      employerMatch: number;
    }>;
  }>
> {
  const accounts = await listAccounts(householdId, { includeArchived: true });
  if (accounts.length === 0) return [];

  // Window: last `months` months, anchored to today.
  const today = new Date();
  const anchor = monthStart(today);
  const start = shiftMonth(anchor, -(months - 1));

  const rows = await db
    .select({
      accountId: monthlyStatements.accountId,
      month: monthlyStatements.month,
      endingBalance: monthlyStatements.endingBalance,
      employeeContribution: monthlyStatements.employeeContribution,
      employerMatch: monthlyStatements.employerMatch,
    })
    .from(monthlyStatements)
    .where(
      and(
        eq(monthlyStatements.householdId, householdId),
        gte(monthlyStatements.month, start),
        lte(monthlyStatements.month, anchor),
      ),
    )
    .orderBy(asc(monthlyStatements.month));

  const byAccount = new Map<
    string,
    Array<{
      month: string;
      endingBalance: number;
      employeeContribution: number;
      employerMatch: number;
    }>
  >();
  for (const r of rows) {
    const list = byAccount.get(r.accountId) ?? [];
    list.push({
      month: r.month as unknown as string,
      endingBalance: toNumber(r.endingBalance),
      employeeContribution: toNumber(r.employeeContribution),
      employerMatch: toNumber(r.employerMatch),
    });
    byAccount.set(r.accountId, list);
  }

  return accounts.map((a) => ({
    accountId: a.id,
    accountName: a.name,
    type: a.type,
    subtype: a.subtype,
    points: byAccount.get(a.id) ?? [],
  }));
}

/**
 * Sum of cashflow transactions tagged as a contribution to each account,
 * for a given month.
 */
export async function sumTaggedContributionsForMonth(
  householdId: string,
  month: string,
): Promise<Map<string, number>> {
  const start = month;
  const end = monthEnd(month);
  const rows = await db
    .select({
      accountId: cashflowTransactions.contributionToAccountId,
      total: sql<string>`sum(abs(${cashflowTransactions.amount}))`,
    })
    .from(cashflowTransactions)
    .where(
      and(
        eq(cashflowTransactions.householdId, householdId),
        gte(cashflowTransactions.occurredOn, start),
        lte(cashflowTransactions.occurredOn, end),
        sql`${cashflowTransactions.contributionToAccountId} is not null`,
      ),
    )
    .groupBy(cashflowTransactions.contributionToAccountId);

  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.accountId) out.set(r.accountId, toNumber(r.total));
  }
  return out;
}

export async function listPaystubsForMonth(householdId: string, month: string) {
  const start = month;
  const end = monthEnd(month);
  const rows = await db
    .select()
    .from(paystubs)
    .where(
      and(
        eq(paystubs.householdId, householdId),
        gte(paystubs.payDate, start),
        lte(paystubs.payDate, end),
      ),
    )
    .orderBy(asc(paystubs.payDate));
  return rows;
}

export async function listPaystubsForYear(householdId: string, year: number) {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  return db
    .select()
    .from(paystubs)
    .where(
      and(
        eq(paystubs.householdId, householdId),
        gte(paystubs.payDate, start),
        lte(paystubs.payDate, end),
      ),
    )
    .orderBy(asc(paystubs.payDate));
}

export async function listPaystubsRange(householdId: string, startDate: string, endDate: string) {
  return db
    .select()
    .from(paystubs)
    .where(
      and(
        eq(paystubs.householdId, householdId),
        gte(paystubs.payDate, startDate),
        lte(paystubs.payDate, endDate),
      ),
    )
    .orderBy(asc(paystubs.payDate));
}

export async function listAllPaystubs(householdId: string) {
  return db
    .select()
    .from(paystubs)
    .where(eq(paystubs.householdId, householdId))
    .orderBy(desc(paystubs.payDate));
}

export function normalizeStateTaxes(value: unknown): PaystubStateTax[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const raw = entry as Record<string, unknown>;
      const state = typeof raw.state === "string" ? raw.state.trim().toUpperCase() : "";
      if (!state) return null;
      const local = Array.isArray(raw.local)
        ? raw.local
            .map((l) => {
              if (!l || typeof l !== "object") return null;
              const localRaw = l as Record<string, unknown>;
              const jurisdiction =
                typeof localRaw.jurisdiction === "string" ? localRaw.jurisdiction.trim() : "";
              const amount = Number(localRaw.amount ?? 0);
              if (!jurisdiction || !Number.isFinite(amount)) return null;
              return { jurisdiction, amount };
            })
            .filter((l): l is { jurisdiction: string; amount: number } => l !== null)
        : undefined;
      const income = Number(raw.income ?? 0);
      const disability = Number(raw.disability ?? 0);
      const fli = Number(raw.fli ?? 0);
      return {
        state,
        income: Number.isFinite(income) ? income : 0,
        ...(Number.isFinite(disability) && disability !== 0 ? { disability } : {}),
        ...(Number.isFinite(fli) && fli !== 0 ? { fli } : {}),
        ...(local && local.length > 0 ? { local } : {}),
      };
    })
    .filter((entry): entry is PaystubStateTax => entry !== null);
}

export function totalStateTaxes(stateTaxes: unknown): number {
  return normalizeStateTaxes(stateTaxes).reduce((sum, entry) => {
    const local = entry.local?.reduce((localSum, l) => localSum + l.amount, 0) ?? 0;
    return sum + entry.income + (entry.disability ?? 0) + (entry.fli ?? 0) + local;
  }, 0);
}

export function totalPaystubTaxes(paystub: {
  federalIncomeTax: string | number | null | undefined;
  socialSecurity: string | number | null | undefined;
  medicare: string | number | null | undefined;
  additionalMedicare: string | number | null | undefined;
  stateTaxes: unknown;
}): number {
  return (
    toNumber(paystub.federalIncomeTax) +
    toNumber(paystub.socialSecurity) +
    toNumber(paystub.medicare) +
    toNumber(paystub.additionalMedicare) +
    totalStateTaxes(paystub.stateTaxes)
  );
}

export async function getMonthlySummary(householdId: string, month: string) {
  const [row] = await db
    .select()
    .from(monthlySummaries)
    .where(and(eq(monthlySummaries.householdId, householdId), eq(monthlySummaries.month, month)))
    .limit(1);
  return row ?? null;
}

/** Most recent monthly_summary row strictly before `month`. */
export async function priorMonthlySummary(householdId: string, month: string) {
  const [row] = await db
    .select()
    .from(monthlySummaries)
    .where(
      and(eq(monthlySummaries.householdId, householdId), sql`${monthlySummaries.month} < ${month}`),
    )
    .orderBy(desc(monthlySummaries.month))
    .limit(1);
  return row ?? null;
}

export async function upsertStatement(values: {
  id?: string;
  householdId: string;
  accountId: string;
  month: string;
  endingBalance: number;
  employeeContribution: number;
  employerMatch: number;
  notes?: string | null;
}) {
  const id = values.id ?? randomUUID();
  await db
    .insert(monthlyStatements)
    .values({
      id,
      householdId: values.householdId,
      accountId: values.accountId,
      month: values.month,
      endingBalance: values.endingBalance.toFixed(2),
      employeeContribution: values.employeeContribution.toFixed(2),
      employerMatch: values.employerMatch.toFixed(2),
      notes: values.notes ?? null,
    })
    .onConflictDoUpdate({
      target: [monthlyStatements.accountId, monthlyStatements.month],
      set: {
        endingBalance: values.endingBalance.toFixed(2),
        employeeContribution: values.employeeContribution.toFixed(2),
        employerMatch: values.employerMatch.toFixed(2),
        notes: values.notes ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function upsertMonthlySummary(values: {
  householdId: string;
  month: string;
  savingsRateGoal: number | null;
  notes?: string | null;
}) {
  const id = randomUUID();
  await db
    .insert(monthlySummaries)
    .values({
      id,
      householdId: values.householdId,
      month: values.month,
      savingsRateGoal: values.savingsRateGoal !== null ? values.savingsRateGoal.toFixed(4) : null,
      notes: values.notes ?? null,
    })
    .onConflictDoUpdate({
      target: [monthlySummaries.householdId, monthlySummaries.month],
      set: {
        savingsRateGoal: values.savingsRateGoal !== null ? values.savingsRateGoal.toFixed(4) : null,
        notes: values.notes ?? null,
        updatedAt: new Date(),
      },
    });
}
