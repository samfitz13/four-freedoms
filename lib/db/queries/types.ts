/**
 * Shared types for the financial query helpers.
 */
import type { financialAccounts } from "@/lib/db/schema";

export type StatementWithAccount = {
  id: string;
  accountId: string;
  accountName: string;
  isArchived?: boolean;
  carriedFromMonth?: string;
  type: (typeof financialAccounts.$inferSelect)["type"];
  subtype: string | null;
  currency: string;
  month: string;
  endingBalance: number;
  employeeContribution: number;
  employerMatch: number;
  notes: string | null;
};

export type PaystubStateTax = {
  state: string;
  income: number;
  disability?: number;
  fli?: number;
  local?: Array<{ jurisdiction: string; amount: number }>;
};

export type LedgerFilters = {
  q?: string;
  accountId?: string;
  categoryId?: string;
  flow?: "income" | "expense" | "transfer";
  from?: string;
  to?: string;
};

export type LedgerCursor = { occurredOn: string; id: string };

export type LedgerRow = {
  id: string;
  occurredOn: string;
  amount: string;
  currency: string;
  description: string | null;
  categoryId: string | null;
  accountId: string | null;
  source: string;
  kind: "cashflow" | "transfer";
  transferGroupId: string | null;
  transferPeerId: string | null;
};

export type IsoOptionAccountSummary = {
  accountId: string;
  accountName: string;
  employerName: string | null;
  employerRelationship: "current" | "former";
  employmentEndDate: string | null;
  postTerminationExerciseDays: number;
  postTerminationExerciseDeadline: string | null;
  latestFmv: number | null;
  latestSharePrice: number | null;
  latestValuationDate: string | null;
  totalShares: number;
  vestedShares: number;
  unvestedShares: number;
  exercisableShares: number;
  exercisedShares: number;
  ownedVestedShares: number;
  ownedUnvestedShares: number;
  outstandingVestedShares: number;
  exerciseCost: number;
  exercisedShareValue: number;
  optionIntrinsicValue: number;
  totalValue: number;
  intrinsicValue: number;
  grants: Array<{
    id: string;
    label: string;
    grantDate: string | null;
    vestingStartDate: string | null;
    vestingSchedule: {
      type: "monthly" | "quarterly" | "annual";
      durationMonths: number;
      cliffMonths: number;
    };
    earlyExerciseAllowed: boolean;
    expirationDate: string | null;
    totalShares: number;
    strikePrice: number;
    vestedShares: number;
    unvestedShares: number;
    exercisableShares: number;
    exercisedShares: number;
    ownedVestedShares: number;
    ownedUnvestedShares: number;
    outstandingVestedShares: number;
    forfeitedShares: number;
    isExerciseWindowExpired: boolean;
    exerciseCost: number;
    exercisedShareValue: number;
    optionIntrinsicValue: number;
    totalValue: number;
    intrinsicValue: number;
    exercises: Array<{
      id: string;
      exerciseDate: string;
      shares: number;
      exercisePrice: number | null;
      fmvAtExercise: number | null;
      notes: string | null;
    }>;
  }>;
  valuations: Array<{
    id: string;
    asOf: string;
    fmv: number;
    sharePrice: number | null;
    notes: string | null;
  }>;
};

export type IsoOptionMonthlyCompensation = {
  month: string;
  compensation: number;
  vestedShares: number;
  unvestedShares: number;
  exercisableShares: number;
  exercisedShares: number;
  ownedVestedShares: number;
  ownedUnvestedShares: number;
  outstandingVestedShares: number;
  forfeitedShares: number;
  exerciseCost: number;
};

export type IsoOptionYearCompensation = {
  year: number;
  compensation: number;
  vestedShares: number;
  unvestedShares: number;
  exercisableShares: number;
  exercisedShares: number;
  ownedVestedShares: number;
  ownedUnvestedShares: number;
  outstandingVestedShares: number;
  forfeitedShares: number;
  exerciseCost: number;
  ownedShareValue: number;
  optionSpreadValue: number;
  totalValue: number;
  monthly: IsoOptionMonthlyCompensation[];
  accounts: IsoOptionAccountSummary[];
};

export type HealthFeedItem =
  | {
      kind: "sleep";
      id: string;
      occurredAt: Date;
      recordedOn: string;
      sleepHours: number;
      bedAt: string | null;
      wakeAt: string | null;
      note: string | null;
    }
  | {
      kind: "checkin";
      id: string;
      occurredAt: Date;
      energy: number | null;
      restingHr: number | null;
      note: string | null;
    }
  | {
      kind: "workout";
      id: string;
      occurredAt: Date;
      workoutKind: "strength" | "cardio" | "mobility" | "sport" | "other";
      minutes: number;
      intensity: number | null;
      note: string | null;
    }
  | {
      kind: "body";
      id: string;
      occurredAt: Date;
      weightKg: number | null;
      bodyFatPct: number | null;
      waistCm: number | null;
      restingHr: number | null;
      note: string | null;
    };
