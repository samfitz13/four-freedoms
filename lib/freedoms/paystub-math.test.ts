import assert from "node:assert/strict";
import { test } from "node:test";
import type { PaystubStateTax } from "@/lib/db/queries/types";
import {
  computeNet,
  sumLocal,
  sumStateFli,
  sumStateIncome,
  totalPaystubTaxes,
} from "./paystub-math";

function paystub(
  overrides: Partial<Parameters<typeof computeNet>[0]> = {},
): Parameters<typeof computeNet>[0] {
  return {
    gross: 0,
    federalIncomeTax: 0,
    socialSecurity: 0,
    medicare: 0,
    additionalMedicare: 0,
    employee401k: 0,
    employeeRoth401k: 0,
    hsa: 0,
    otherPretax: 0,
    otherPosttax: 0,
    benefits: 0,
    otherIncome: 0,
    stateTaxes: [],
    ...overrides,
  };
}

function multiStateTaxes(): PaystubStateTax[] {
  return [
    {
      state: "NY",
      income: 400,
      fli: 15,
      disability: 5,
      local: [
        { jurisdiction: "City", amount: 20 },
        { jurisdiction: "District", amount: 10 },
      ],
    },
    {
      state: "CA",
      income: 250,
      disability: 10,
      local: [{ jurisdiction: "County", amount: 5 }],
    },
  ];
}

test("empty state taxes produce zero for every state and local subtotal", () => {
  assert.equal(sumStateIncome([]), 0);
  assert.equal(sumStateFli([]), 0);
  assert.equal(sumLocal([]), 0);
});

test("state income totals include every state without counting leave or local taxes", () => {
  assert.equal(sumStateIncome(multiStateTaxes()), 650);
});

test("family leave and disability are combined across states without counting income taxes", () => {
  assert.equal(sumStateFli(multiStateTaxes()), 30);
});

test("missing optional leave and disability amounts behave like explicit zero", () => {
  assert.equal(
    sumStateFli([
      { state: "CA", income: 100 },
      { state: "NJ", income: 50, fli: 0, disability: 0 },
    ]),
    0,
  );
});

test("local taxes include every jurisdiction in every state", () => {
  assert.equal(sumLocal(multiStateTaxes()), 35);
});

test("missing and empty local tax arrays both produce zero", () => {
  assert.equal(
    sumLocal([
      { state: "CA", income: 100 },
      { state: "NY", income: 50, local: [] },
    ]),
    0,
  );
});

test("total taxes include federal withholding even without state taxes", () => {
  assert.equal(
    totalPaystubTaxes(
      paystub({
        federalIncomeTax: 450,
        socialSecurity: 62,
        medicare: 14.5,
        additionalMedicare: 9,
      }),
    ),
    535.5,
  );
});

test("total taxes combine federal, state, leave, disability and local amounts exactly once", () => {
  assert.equal(
    totalPaystubTaxes(
      paystub({
        federalIncomeTax: 1000,
        socialSecurity: 620,
        medicare: 145,
        additionalMedicare: 45,
        stateTaxes: multiStateTaxes(),
      }),
    ),
    2525,
  );
});

for (const field of ["federalIncomeTax", "socialSecurity", "medicare", "additionalMedicare"]) {
  test(`${field} contributes to both tax totals and the net-pay deduction`, () => {
    const input = paystub({ gross: 1000, [field]: 37.25 });
    assert.equal(totalPaystubTaxes(input), 37.25);
    assert.equal(computeNet(input), 962.75);
  });
}

test("net pay adds other income and subtracts all taxes and employee deductions", () => {
  const input = paystub({
    gross: 10_000,
    otherIncome: 500,
    federalIncomeTax: 1000,
    socialSecurity: 620,
    medicare: 145,
    additionalMedicare: 45,
    stateTaxes: multiStateTaxes(),
    employee401k: 600,
    employeeRoth401k: 200,
    hsa: 100,
    otherPretax: 50,
    otherPosttax: 25,
    benefits: 125,
  });
  assert.equal(computeNet(input), 6875);
});

test("other income increases net pay, including a paycheck without base gross pay", () => {
  assert.equal(computeNet(paystub({ gross: 1000, otherIncome: 250 })), 1250);
  assert.equal(computeNet(paystub({ otherIncome: 250 })), 250);
});

for (const field of [
  "employee401k",
  "employeeRoth401k",
  "hsa",
  "otherPretax",
  "otherPosttax",
  "benefits",
]) {
  test(`${field} reduces net pay once without being classified as a tax`, () => {
    const input = paystub({ gross: 1000, [field]: 37.25 });
    assert.equal(totalPaystubTaxes(input), 0);
    assert.equal(computeNet(input), 962.75);
  });
}

test("an all-zero paycheck stays zero rather than becoming missing or invalid", () => {
  const input = paystub();
  assert.equal(totalPaystubTaxes(input), 0);
  assert.equal(computeNet(input), 0);
});

test("fractional currency amounts survive tax and net-pay calculations", () => {
  const input = paystub({
    gross: 100.01,
    otherIncome: 0.03,
    federalIncomeTax: 12.34,
    stateTaxes: [{ state: "NY", income: 1.11 }],
    employee401k: 5.55,
    hsa: 0.1,
    benefits: 0.2,
  });
  assert.ok(Math.abs(totalPaystubTaxes(input) - 13.45) < 1e-9);
  assert.ok(Math.abs(computeNet(input) - 80.74) < 1e-9);
});

test("calculations do not mutate the paystub or nested state and local tax entries", () => {
  const input = paystub({ gross: 10_000, stateTaxes: multiStateTaxes() });
  const before = structuredClone(input);
  sumStateIncome(input.stateTaxes);
  sumStateFli(input.stateTaxes);
  sumLocal(input.stateTaxes);
  totalPaystubTaxes(input);
  computeNet(input);
  assert.deepEqual(input, before);
});
