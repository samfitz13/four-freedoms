/**
 * Household-scoped financial settings. Today this is just the base currency,
 * stored on `freedom_settings.targetJson` for the financial freedom so we
 * don't need a new table yet. More fields (FI assumptions, default withdrawal
 * rate, etc.) will grow here.
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { freedomSettings } from "@/lib/db/schema";
import { DEFAULT_BASE_CURRENCY, isSupportedCurrency } from "./currency";

// Re-export the plain constants so existing server-side callers keep working.
export {
  DEFAULT_BASE_CURRENCY,
  SUPPORTED_CURRENCIES,
  isSupportedCurrency,
  type SupportedCurrency,
} from "./currency";

type FinancialTargetJson = {
  baseCurrency?: string;
  // reserved for future use: fiAnnualSpend, realReturn, withdrawalRate, etc.
};

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
