import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { financialAccounts, monthlyStatements } from "@/lib/db/schema";
import { listAccounts } from "@/lib/db/queries/financial";
import { listInvestmentSnapshots } from "@/lib/db/queries/investment-snapshots";
import { getBaseCurrency, getFiGoalAssumptions } from "./financial-settings";
import { buildFiPlan } from "./fi-plan";

/** Goals and Overview call this adapter, with identical household-scoped inputs. */
export async function getHouseholdFiPlan(
  householdId: string,
  today = new Date(),
  paramsOverride?: unknown,
) {
  const [accounts, snapshots, fi, currency, rows] = await Promise.all([
    listAccounts(householdId, { includeArchived: true }),
    listInvestmentSnapshots(householdId),
    getFiGoalAssumptions(householdId),
    getBaseCurrency(householdId),
    db
      .select({
        accountId: monthlyStatements.accountId,
        month: monthlyStatements.month,
        balance: monthlyStatements.endingBalance,
        employee: monthlyStatements.employeeContribution,
        employer: monthlyStatements.employerMatch,
      })
      .from(monthlyStatements)
      .innerJoin(financialAccounts, eq(financialAccounts.id, monthlyStatements.accountId))
      .where(
        and(
          eq(monthlyStatements.householdId, householdId),
          eq(financialAccounts.householdId, householdId),
          lt(monthlyStatements.month, today.toISOString().slice(0, 7) + "-01"),
        ),
      ),
  ]);
  return buildFiPlan({
    accounts,
    snapshots,
    currency,
    params: paramsOverride === undefined ? (fi.settings ?? null) : paramsOverride,
    today,
    statements: rows.map((r) => ({
      accountId: r.accountId,
      month: r.month,
      balance: Number(r.balance),
      contribution: Number(r.employee) + Number(r.employer),
    })),
  });
}
