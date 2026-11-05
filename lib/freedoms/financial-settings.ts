/**
 * Household-scoped financial settings. Today this is just the base currency,
 * stored on `freedom_settings.targetJson` for the financial freedom so we
 * don't need a new table yet.
 *
 * FI assumptions live on the active `financial_goals` row of kind `fi_number`
 * (single source of truth — see `getFiGoalAssumptions`). The Goals page is
 * the only writer.
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { financialGoals, freedomSettings } from "@/lib/db/schema";
import { DEFAULT_BASE_CURRENCY, isSupportedCurrency } from "./currency";
import type { FiGoalAssumptions } from "./types";
import { parseFiSettings } from "./fi-plan-settings";

// Re-export the plain constants so existing server-side callers keep working.
export {
  DEFAULT_BASE_CURRENCY,
  SUPPORTED_CURRENCIES,
  isSupportedCurrency,
  type SupportedCurrency,
} from "./currency";

type FinancialTargetJson = { baseCurrency?: string };

async function readFinancialSettings(householdId: string): Promise<FinancialTargetJson | null> {
  const [row] = await db
    .select({ targetJson: freedomSettings.targetJson })
    .from(freedomSettings)
    .where(
      and(eq(freedomSettings.householdId, householdId), eq(freedomSettings.freedom, "financial")),
    )
    .limit(1);
  return (row?.targetJson ?? null) as FinancialTargetJson | null;
}

export async function getBaseCurrency(householdId: string): Promise<string> {
  const json = await readFinancialSettings(householdId);
  const c = json?.baseCurrency;
  return c && typeof c === "string" ? c : DEFAULT_BASE_CURRENCY;
}

/**
 * Read FI assumptions from the active `fi_number` goal row. Returns an empty
 * object when no active goal exists or its `params` jsonb lacks the keys.
 */
export async function getFiGoalAssumptions(householdId: string): Promise<FiGoalAssumptions> {
  const [row] = await db
    .select({
      targetAmount: financialGoals.targetAmount,
      params: financialGoals.params,
    })
    .from(financialGoals)
    .where(
      and(
        eq(financialGoals.householdId, householdId),
        eq(financialGoals.kind, "fi_number"),
        eq(financialGoals.status, "active"),
      ),
    )
    .limit(1);
  if (!row) return {};
  const p = (row.params ?? {}) as Record<string, unknown>;
  return {
    settings: parseFiSettings(p) ?? undefined,
    annualSpend: numOrUndefined(p.annualSpend),
    withdrawalRate: numOrUndefined(p.withdrawalRate),
    realReturn: numOrUndefined(p.realReturn),
    inflationRate: numOrUndefined(p.inflationRate),
    downsideReduction: numOrUndefined(p.downsideReduction),
    monthlyContribution: numOrUndefined(p.monthlyContribution),
    useManualContribution: p.useManualContribution === true,
  };
}

function numOrUndefined(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export async function setBaseCurrency(householdId: string, currency: string): Promise<void> {
  if (!isSupportedCurrency(currency)) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  const existing = (await readFinancialSettings(householdId)) ?? {};
  const nextJson: FinancialTargetJson = { ...existing, baseCurrency: currency };

  await db
    .insert(freedomSettings)
    .values({
      householdId,
      freedom: "financial",
      targetJson: nextJson,
    })
    .onConflictDoUpdate({
      target: [freedomSettings.householdId, freedomSettings.freedom],
      set: { targetJson: nextJson, updatedAt: new Date() },
    });
}
