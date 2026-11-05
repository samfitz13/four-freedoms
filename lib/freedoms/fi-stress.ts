import { planMonthlySeries } from "./fi-projection";
import { fiMonthDistance, shiftFiMonth } from "./fi-plan-settings";
import type { FiStressResults } from "./types";
export type { FiStressResult, FiStressResults } from "./types";
export function buildFiStressTests(
  projection: Parameters<typeof planMonthlySeries>[0],
  shockRealReturn: number | null,
): FiStressResults {
  const retirement = projection.retirementMonth;
  if (!retirement)
    return { results: [], unavailable: "Complete retirement settings to compare shock timing." };
  if (shockRealReturn === null)
    return { results: [], unavailable: "Complete portfolio allocation to compare shock timing." };
  const later = shiftFiMonth(retirement, 120);
  const lastShockMonth = shiftFiMonth(later, 11);
  const end =
    projection.endMonth ??
    shiftFiMonth(projection.startMonth, (projection.horizonYears ?? 50) * 12);
  if (retirement <= projection.startMonth || fiMonthDistance(lastShockMonth, end) < 0)
    return {
      results: [],
      unavailable:
        "This horizon does not contain both full shock years. Historical retirement shocks are not reconstructed.",
    };
  return {
    unavailable: null,
    results: [retirement, later].map((shockMonth, i) => ({
      title: i === 0 ? "Shock at retirement" : "Shock ten years later",
      shockMonth,
      plan: planMonthlySeries({
        ...projection,
        annualReturnForMonth: (month) =>
          month >= shockMonth && month < shiftFiMonth(shockMonth, 12)
            ? shockRealReturn
            : projection.realReturn,
      }),
    })),
  };
}
