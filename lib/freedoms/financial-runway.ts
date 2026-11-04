import "server-only";
import type { RunwayEstimate } from "@/lib/freedoms/types";

type BalancePoint = {
  type: string;
  balance: number;
};

type CashflowMonth = {
  month: string;
  expense: number;
};

export function computeRunwayEstimate({
  balances,
  months,
  currentMonth,
}: {
  balances: BalancePoint[];
  months: CashflowMonth[];
  currentMonth: string;
}): RunwayEstimate {
  const liquidCash = balances
    .filter((balance) => balance.type === "checking" || balance.type === "savings")
    .reduce((sum, balance) => sum + balance.balance, 0);
  const creditCardDebt = balances
    .filter((balance) => balance.type === "credit_card")
    .reduce((sum, balance) => sum + Math.abs(balance.balance), 0);
  const availableCash = liquidCash - creditCardDebt;
  const closedMonths = months
    .filter((month) => month.month < currentMonth && month.expense > 0)
    .sort((a, b) => a.month.localeCompare(b.month));

  const recentThree = closedMonths.slice(-3);
  const window = recentThree.length >= 3 ? recentThree : closedMonths.slice(-6);
  const basis =
    window.length >= 3 ? "actual_3mo" : window.length > 0 ? "actual_6mo" : "insufficient_data";
  const monthlyBurn =
    window.length > 0
      ? window.reduce((sum, month) => sum + month.expense, 0) / window.length
      : null;
  const runwayMonths =
    monthlyBurn !== null && monthlyBurn > 0 ? Math.max(0, availableCash / monthlyBurn) : null;

  return {
    months: runwayMonths,
    liquidCash,
    creditCardDebt,
    availableCash,
    monthlyBurn,
    windowMonths: window.length,
    basis,
  };
}
