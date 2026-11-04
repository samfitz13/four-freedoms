import "server-only";

import { listProperties } from "@/lib/db/queries/location";

export async function computePropertyRollup(householdId: string) {
  const rows = await listProperties(householdId);
  return {
    count: rows.length,
    value: rows.reduce((sum, row) => sum + (row.lastValuation ?? 0), 0),
    equity: rows.reduce((sum, row) => sum + (row.equity ?? 0), 0),
  };
}
