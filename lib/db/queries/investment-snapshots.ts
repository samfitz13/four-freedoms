import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { financialAccounts, investmentSnapshots } from "@/lib/db/schema";
import { investmentSnapshotSchema } from "@/lib/financial/portfolio/schema";
import type { InvestmentSnapshotView } from "@/lib/financial/portfolio/types";

export async function listInvestmentSnapshots(
  householdId: string,
): Promise<InvestmentSnapshotView[]> {
  const rows = await db
    .selectDistinctOn([investmentSnapshots.accountId], {
      id: investmentSnapshots.id,
      accountId: investmentSnapshots.accountId,
      accountName: financialAccounts.name,
      currency: financialAccounts.currency,
      preparedOn: investmentSnapshots.preparedOn,
      sourceKey: investmentSnapshots.sourceKey,
      data: investmentSnapshots.data,
    })
    .from(investmentSnapshots)
    .innerJoin(financialAccounts, eq(financialAccounts.id, investmentSnapshots.accountId))
    .where(
      and(
        eq(investmentSnapshots.householdId, householdId),
        eq(financialAccounts.householdId, householdId),
      ),
    )
    .orderBy(
      investmentSnapshots.accountId,
      desc(investmentSnapshots.preparedOn),
      desc(investmentSnapshots.createdAt),
    );
  return rows.map((row) => ({ ...row, data: investmentSnapshotSchema().parse(row.data) }));
}
