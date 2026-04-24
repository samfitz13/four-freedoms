/**
 * Deterministic FI (financial-independence) projection.
 *
 * Compounds `currentInvested` plus `monthlyContribution` at `realReturn`
 * (annual, already net of inflation) and reports the first year the balance
 * crosses `fiNumber = targetAnnualSpend / withdrawalRate`.
 *
 * No Monte Carlo in v1 — we want a single, stable "here is where you land"
 * line. Inputs are in the household base currency; this module does no FX.
 */

import type { FiProjection, FiProjectionInput, FiYear } from "./types";

export function projectFi(input: FiProjectionInput): FiProjection {
  const realReturn = input.realReturn ?? 0.05;
  const withdrawalRate = input.withdrawalRate ?? 0.04;
  const horizonYears = input.horizonYears ?? 50;
  const monthlyRate = realReturn / 12;

  const fiNumber = withdrawalRate > 0 ? input.targetAnnualSpend / withdrawalRate : Infinity;

  const years: FiYear[] = [];
  let balance = Math.max(0, input.currentInvested);
  let yearsToFi: number | null = null;

  push(0, balance);

  for (let y = 1; y <= horizonYears; y++) {
    // Simulate 12 monthly compoundings with end-of-month contributions.
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + monthlyRate) + input.monthlyContribution;
    }
    push(y, balance);
    if (yearsToFi === null && balance >= fiNumber) {
      yearsToFi = y;
      break;
    }
  }

  return { fiNumber, realReturn, withdrawalRate, years, yearsToFi };

  function push(year: number, bal: number) {
    const rawProgress = fiNumber > 0 && Number.isFinite(fiNumber) ? bal / fiNumber : 0;
    years.push({
      year,
      balance: bal,
      fiNumber,
      progress: clamp(rawProgress, 0, 1),
      rawProgress,
    });
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
