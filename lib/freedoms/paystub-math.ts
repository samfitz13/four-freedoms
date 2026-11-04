import type { PaystubStateTax } from "@/lib/db/queries/types";

type PaystubMathInput = {
  gross: number;
  federalIncomeTax: number;
  socialSecurity: number;
  medicare: number;
  additionalMedicare: number;
  employee401k: number;
  employeeRoth401k: number;
  hsa: number;
  otherPretax: number;
  otherPosttax: number;
  benefits: number;
  otherIncome: number;
  stateTaxes: PaystubStateTax[];
};

export function sumStateIncome(stateTaxes: PaystubStateTax[]): number {
  return stateTaxes.reduce((sum, entry) => sum + entry.income, 0);
}

export function sumStateFli(stateTaxes: PaystubStateTax[]): number {
  return stateTaxes.reduce((sum, entry) => sum + (entry.fli ?? 0) + (entry.disability ?? 0), 0);
}

export function sumLocal(stateTaxes: PaystubStateTax[]): number {
  return stateTaxes.reduce(
    (sum, entry) => sum + (entry.local?.reduce((localSum, l) => localSum + l.amount, 0) ?? 0),
    0,
  );
}

export function totalPaystubTaxes(
  input: Pick<
    PaystubMathInput,
    "federalIncomeTax" | "socialSecurity" | "medicare" | "additionalMedicare" | "stateTaxes"
  >,
): number {
  return (
    input.federalIncomeTax +
    input.socialSecurity +
    input.medicare +
    input.additionalMedicare +
    sumStateIncome(input.stateTaxes) +
    sumStateFli(input.stateTaxes) +
    sumLocal(input.stateTaxes)
  );
}

export function computeNet(input: PaystubMathInput): number {
  return (
    input.gross +
    input.otherIncome -
    totalPaystubTaxes(input) -
    input.employee401k -
    input.employeeRoth401k -
    input.hsa -
    input.otherPretax -
    input.otherPosttax -
    input.benefits
  );
}
