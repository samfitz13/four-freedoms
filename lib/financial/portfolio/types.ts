import type { z } from "zod";
import type { investmentSnapshotSchema } from "./schema";

export type InvestmentSnapshotData = z.infer<ReturnType<typeof investmentSnapshotSchema>>;

export type InvestmentSnapshotView = {
  id: string;
  accountId: string;
  accountName: string;
  currency: string;
  preparedOn: string;
  sourceKey: string;
  data: InvestmentSnapshotData;
};
