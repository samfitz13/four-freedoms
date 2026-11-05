import { z } from "zod";
import { atlasInputSchema, investmentSnapshotSchema } from "./schema";
import type { InvestmentSnapshotData } from "./types";

export function atlasSnapshot(input: unknown, cashAsOf: string) {
  const data = atlasInputSchema().parse(input);
  z.iso.date().parse(cashAsOf);
  return investmentSnapshotSchema().parse({
    version: 1,
    prepared: data.prepared,
    priceAsOf: null,
    funds: data.funds,
    cash: {
      amount: data.cash,
      basis: "reconstructed",
      asOf: cashAsOf,
      note: "Reconstructed from transactions, including BUPXX as cash. Not independently confirmed by a current statement.",
    },
    sources: data.sources,
  });
}

export function summarizeSnapshot(data: InvestmentSnapshotData) {
  const positions = data.funds.map((fund) => {
    const valueCents = Math.round(fund.shares * fund.price * 100);
    const basisCents = Math.round(fund.shares * fund.average * 100);
    return { ...fund, valueCents, basisCents, gainCents: valueCents - basisCents };
  });
  const holdingsCents = positions.reduce((sum, p) => sum + p.valueCents, 0);
  const cashCents = Math.round(data.cash.amount * 100);
  const stocksCents = positions
    .filter((p) => p.symbol !== "MUB")
    .reduce((sum, p) => sum + p.valueCents, 0);
  const bondsCents = holdingsCents - stocksCents;
  const gainCents = positions.reduce((sum, p) => sum + p.gainCents, 0);
  return {
    positions,
    holdingsCents,
    cashCents,
    stocksCents,
    bondsCents,
    gainCents,
    totalCents: holdingsCents + cashCents,
  };
}
