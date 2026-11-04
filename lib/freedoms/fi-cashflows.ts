/** End-of-month flows, after growth. Statement anchors already include their own month's flows. */
export function fiMonthlyCashFlow(input: {
  month: string;
  retirementMonth?: string | null;
  monthlyContribution: number;
  targetAnnualSpend: number;
  monthlyRetirementIncome?: number;
  incomeStartMonth?: string | null;
}) {
  const retired = Boolean(input.retirementMonth && input.month >= input.retirementMonth);
  return {
    retired,
    contribution: retired ? 0 : input.monthlyContribution,
    spending: retired ? input.targetAnnualSpend / 12 : 0,
    income:
      retired && input.incomeStartMonth && input.month >= input.incomeStartMonth
        ? (input.monthlyRetirementIncome ?? 0)
        : 0,
  };
}
