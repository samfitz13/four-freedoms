import { z } from "zod";

function fundSchema() {
  return z.object({
    symbol: z.enum(["IUSV", "IUSG", "VEA", "VWO", "VTWO", "MUB"]),
    name: z.string().min(1).max(200),
    short: z.string().min(1).max(100),
    shares: z.number().positive().max(1_000_000),
    price: z.number().positive().max(1_000_000),
    average: z.number().nonnegative().max(1_000_000),
    expense: z.number().nonnegative().max(100),
    count: z.number().int().positive(),
    date: z.string().min(1).max(100),
    source: z.number().int().positive(),
    index: z.string().min(1).max(200),
    role: z.string().max(2000),
    upside: z.string().max(2000),
    risk: z.string().max(2000),
    note: z.string().max(2000),
    holdings: z.array(z.tuple([z.string().min(1).max(200), z.number().min(0).max(100)])).max(100),
    countries: z
      .array(z.tuple([z.string().min(1).max(200), z.number().min(0).max(100)]))
      .max(100)
      .optional(),
    holdingsDate: z.string().max(100).optional(),
    holdingsSource: z.number().int().positive().optional(),
  });
}

function sourceSchema() {
  return z.object({
    id: z.number().int().positive(),
    title: z.string().min(1).max(300),
    date: z.string().min(1).max(100),
    url: z
      .url()
      .max(2000)
      .refine((url) => new URL(url).protocol === "https:", "Sources must use HTTPS"),
  });
}

export function atlasInputSchema() {
  return z
    .object({
      prepared: z.string().min(1).max(100),
      cash: z.number().min(0).max(1_000_000_000_000),
      funds: z.array(fundSchema()).length(6),
      sources: z.array(sourceSchema()).min(1).max(100),
    })
    .superRefine((data, ctx) => {
      if (new Set(data.funds.map((fund) => fund.symbol)).size !== data.funds.length) {
        ctx.addIssue({ code: "custom", message: "Duplicate ETF symbol" });
      }
      const ids = new Set(data.sources.map((source) => source.id));
      if (ids.size !== data.sources.length)
        ctx.addIssue({ code: "custom", message: "Duplicate source ID" });
      for (const fund of data.funds) {
        if (
          !ids.has(fund.source) ||
          (fund.holdingsSource !== undefined && !ids.has(fund.holdingsSource))
        ) {
          ctx.addIssue({ code: "custom", message: "A fund references a missing source" });
        }
      }
    });
}

export function investmentSnapshotSchema() {
  return z.object({
    version: z.literal(1),
    prepared: z.string().min(1).max(100),
    // Atlas's screenshot does not show a quote timestamp. Do not infer one.
    priceAsOf: z.null(),
    funds: z.array(fundSchema()).max(6),
    cash: z.object({
      amount: z.number().min(0).max(1_000_000_000_000),
      basis: z.enum(["reconstructed", "estimate"]),
      asOf: z.iso.date().nullable(),
      note: z.string().min(1).max(2000),
    }),
    sources: z.array(sourceSchema()).max(100),
  });
}
