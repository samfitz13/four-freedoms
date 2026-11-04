/**
 * Types for the freedom registry. Financial reads from typed domain tables
 * (accounts, balances, transactions, goals). The other three freedoms are
 * editorial placeholders until their own typed models arrive.
 */
import type { FinancialAccount } from "@/lib/db/schema";
import type { FREEDOM_KEYS, FREEDOM_STATUSES } from "./constants";
import type {
  AccountClass,
  FinancialAttentionVerdict,
  FinancialFiVerdict,
  FinancialHealthVerdict,
  StatementFlag,
} from "./enums";

export type AccountType = FinancialAccount["type"];

export type FreedomKey = (typeof FREEDOM_KEYS)[number];
export type FreedomStatus = (typeof FREEDOM_STATUSES)[number];

export interface FreedomMeta {
  key: FreedomKey;
  label: string;
  question: string;
  colorVar: string;
  /** Margin-note subtitle shown on the placeholder / card quiet state. */
  blurb: string;
}

export interface FreedomModule {
  meta: FreedomMeta;
  status: FreedomStatus;
}

/**
 * Headline summary for a freedom card. Live freedoms (today: financial)
 * carry a populated score/trend; coming-soon freedoms carry null signals so
 * the card can render a quiet placeholder variant.
 */
export interface FreedomSummary {
  key: FreedomKey;
  score: number | null;
  trend: number | null;
  /** Count of typed activity events this week. null = not yet measured. */
  entriesThisWeek: number | null;
  /** Consecutive days with activity. null = not yet measured. */
  streak: number | null;
}

/** FI (financial-independence) projection input. */
export interface FiProjectionInput {
  currentInvested: number;
  monthlyContribution: number;
  realReturn?: number;
  withdrawalRate?: number;
  targetAnnualSpend: number;
  horizonYears?: number;
}

export interface FiYear {
  year: number;
  balance: number;
  fiNumber: number;
  progress: number;
  rawProgress: number;
}

export interface DailyPoint {
  /** ISO date `YYYY-MM-DD` */
  date: string;
  /** 0..100 score, or null when the day has no signal. */
  score: number | null;
}

export interface FiProjection {
  fiNumber: number;
  realReturn: number;
  withdrawalRate: number;
  years: FiYear[];
  yearsToFi: number | null;
}

/** Derived FI inputs computed from monthly_statements. Source-of-truth
 * helpers live in `lib/freedoms/financial-derived.ts`. */
export interface DerivedFiInputs {
  avgMonthlyContribution: number | null;
  realizedAnnualReturn: number | null;
  monthsObserved: number;
  oldestMonth: string | null;
  latestMonth: string | null;
  trailingContributions: FiContributionHistory;
  returnHistory: FiReturnHistory;
}

export type FiReturnStatement = {
  accountId: string;
  month: string;
  balance: number;
  contribution: number;
};

export type FiReturnHistory = {
  annualNominalReturn: number | null;
  monthsObserved: number;
  skippedTransitions: number;
  startMonth: string | null;
  endMonth: string | null;
};

export type FiAsset = (typeof import("./constants").FI_ASSETS)[number];
export type FiAllocation = Record<FiAsset, number>;
export type FiPlanSettings = import("zod").z.infer<
  typeof import("./fi-plan-settings").fiPlanSettingsSchema
>;
export type FiManualAllocation = FiPlanSettings["manualAllocations"][string];
export type FiParsedSettings = NonNullable<
  ReturnType<typeof import("./fi-plan-settings").parseFiSettings>
>;
export type FiPlanView = ReturnType<typeof import("./fi-plan").buildFiPlan>;
export type FiPlanFormInputs = Pick<FiPlanView, "settings" | "allocation">;
export type FiStressResult = { title: string; shockMonth: string; plan: PlanResult };
export type FiStressResults = { results: FiStressResult[]; unavailable: string | null };
export type FiAccountInput = {
  id: string;
  name: string;
  type: string;
  currency: string;
  isArchived?: boolean;
};
export type FiStatementInput = {
  accountId: string;
  month: string;
  balance: number;
  contribution: number;
};
export type FiAccountCoverage = {
  id: string;
  name: string;
  included: boolean;
  eligible: boolean;
  cashOnly: boolean;
  archived: boolean;
  balance: number | null;
  statementMonth: string | null;
  snapshotDate: string | null;
  quoteDate: string | null;
  cashDate: string | null;
  confirmationKey: string | null;
  warnings: string[];
  allocation: FiAllocation | null;
  expenseRate: number;
  source: "manual" | "snapshot" | "cash" | null;
};

export type FiReturnScenario = {
  kind: "base" | "downside" | "upside";
  title: string;
  realReturn: number | null;
  plan: PlanResult | null;
};

export type FiContributionHistory = {
  average: number | null;
  monthsObserved: number;
  windowStart: string;
  windowEnd: string;
};

/** A single monthly balance reading (YYYY-MM-01). */
export interface MonthlyBalancePoint {
  month: string;
  balance: number;
  spending?: number;
  income?: number;
  shortfall?: number;
  cumulativeShortfall?: number;
}

/** Output of `planMonthlySeries` — plan-driven projection. */
export interface PlanResult {
  series: MonthlyBalancePoint[];
  fiNumber: number;
  monthsToFi: number | null;
  fiMonth: string | null;
  retirementMonth?: string | null;
  depletionMonth?: string | null;
  firstShortfallMonth?: string | null;
  cumulativeShortfall?: number;
}

/** One month of derived savings-rate signal. */
export interface SavingsRatePoint {
  month: string;
  totalSaved: number;
  netIncome: number;
  savingsRate: number | null;
}

/**
 * FI assumptions read off the active `financial_goals` row of kind
 * `fi_number`. Single source of truth for the household's FI plan.
 */
export interface FiGoalAssumptions {
  settings?: import("./fi-plan-settings").FiParsedSettings;
  /** Target annual spend in retirement, in base currency. */
  annualSpend?: number;
  /** Safe-withdrawal rate (0..1). */
  withdrawalRate?: number;
  /** Expected annual real return (0..1). */
  realReturn?: number;
  /** Assumed inflation used only to illustrate historical nominal returns in real terms. */
  inflationRate?: number;
  /** Percentage-point reduction from the base real return for the downside case. */
  downsideReduction?: number;
  /** Monthly contribution toward the FI target, in base currency. */
  monthlyContribution?: number;
  /** Only explicit overrides use the saved amount; otherwise derive recent contributions. */
  useManualContribution?: boolean;
}

/**
 * Statement row enriched with computed gain + reconciliation flags. Lives
 * here so both the calculator and the UI components can share the shape.
 */
export interface AccountStatementRow {
  id: string;
  accountId: string;
  accountName: string;
  isArchived?: boolean;
  carriedFromMonth?: string;
  type: AccountType;
  subtype: string | null;
  currency: string;
  month: string;
  endingBalance: number;
  employeeContribution: number;
  employerMatch: number;
  notes: string | null;
  klass: AccountClass;
  /** Computed: ending - prior - employee_contribution - employer_match. */
  gain: number;
  flags: Array<{ kind: StatementFlag; expected: number; actual: number; delta: number }>;
}

export interface CompositionPoint {
  klass: AccountClass;
  value: number;
}

export interface AccountClassSeries {
  klass: AccountClass;
  points: Array<{ month: string; value: number }>;
}

export interface MonthlyRollup {
  month: string;
  hasData: boolean;

  netWorth: number;
  netWorthPrev: number | null;
  delta: number | null;
  deltaPct: number | null;

  composition: CompositionPoint[];

  netIncome: number;
  netIncomeFromPaystubs: number;
  netIncomeFromCashflow: number;
  expenses: number;
  totalSaved: number;
  savingsRate: number | null;
  savingsRateGoal: number | null;

  fiNumber: number | null;
  fiPercent: number | null;
  fiPercentDelta: number | null;
  swMonthly: number | null;
  swYearly: number | null;
  totalGains: number;

  rows: AccountStatementRow[];
}

/**
 * Shared shape for a freedom's headline card/overview. Each freedom extends
 * this with its own domain metrics.
 */
interface FreedomBaseSummary {
  score: number;
  trend: number;
  series: DailyPoint[];
  entriesThisWeek: number;
  streak: number;
}

/**
 * Headline metrics for the Financial freedom, derived from typed domain
 * tables. See `lib/freedoms/financial-summary.ts`.
 */
export interface FinancialSummary extends FreedomBaseSummary {
  netWorth: number | null;
  netWorth30: number | null;
  delta30: number | null;
  savingsRate: number | null;
  runwayMonths: number | null;
  fiProgress: number | null;
  invested: number;
}

export interface FinancialOverviewVerdict {
  health: FinancialHealthVerdict;
  fi: FinancialFiVerdict;
  attention: FinancialAttentionVerdict;
  sentence: string;
}

export interface FinancialOverviewKpis {
  netWorth: number | null;
  netWorthDelta: number | null;
  netWorthDeltaPct: number | null;
  savedThisMonth: number | null;
  savingsRate: number | null;
  gainLoss: number | null;
  fiProgress: number | null;
  runwayMonths: number | null;
}

export interface RunwayEstimate {
  months: number | null;
  liquidCash: number;
  creditCardDebt: number;
  availableCash: number;
  monthlyBurn: number | null;
  windowMonths: number;
  basis: "actual_3mo" | "actual_6mo" | "insufficient_data";
}

export interface FinancialOverviewBalanceRow {
  label: string;
  value: number;
  share: number | null;
  klass: string;
}

export interface FinancialOverviewMovement {
  start: number | null;
  saved: number;
  employerMatch: number;
  gainLoss: number;
  debtDrag: number;
  end: number | null;
}

export interface FinancialOverviewIncomeQuality {
  paystubNet: number;
  cashflowIncome: number;
  expenses: number;
  saved: number;
  savingsRate: number | null;
  drift: number | null;
  paystubRows: number;
  employerMatch: number;
  savingsSeries: Array<{ month: string; savingsRate: number | null }>;
}

export interface FinancialOverviewFiTrack {
  projection?: import("./fi-plan").FiPlanView;
  fiNumber: number | null;
  invested: number;
  gap: number | null;
  progress: number | null;
  monthsToFi: number | null;
  monthlyContribution: number | null;
  annualSpend: number | null;
  withdrawalRate: number | null;
}

export interface FinancialOverviewAttention {
  title: string;
  detail: string;
  href: string;
}

export interface FinancialOverviewData {
  month: string | null;
  verdict: FinancialOverviewVerdict;
  activeAccounts: number;
  kpis: FinancialOverviewKpis;
  balanceSheet: {
    assets: FinancialOverviewBalanceRow[];
    liabilities: FinancialOverviewBalanceRow[];
    netWorth: number | null;
  };
  runway: RunwayEstimate;
  movementBridge: FinancialOverviewMovement;
  incomeQuality: FinancialOverviewIncomeQuality;
  fiTrack: FinancialOverviewFiTrack;
  attention: FinancialOverviewAttention[];
}

/** Headline metrics for the Location freedom. */
export interface LocationSummary extends FreedomBaseSummary {
  /** Name of the place you're currently at, if any. */
  currentPlace: string | null;
  currentCountry: string | null;
  /** Whether that place is on your preferred list. */
  currentIsPreferred: boolean;
  /** Days since the current stay began. */
  daysAtCurrent: number | null;
  yearPlaceBreakdown: Array<{
    placeId: string;
    placeName: string;
    country: string | null;
    days: number;
    share: number;
  }>;
  currentRole: "primary" | "secondary" | "visiting" | null;
  currentTimezone: string;
  /** Mean satisfaction (1..10) over the last 30 days. Null if no logs. */
  meanSatisfaction30: number | null;
  /** Distinct preferred places visited in the last 12 months. */
  preferredVisited12mo: number;
  primaryResidenceName: string | null;
  primaryResidenceStartedOn: string | null;
  yearsAtPrimary: number;
  connectionsOnCadence: number;
  connectionsWithCadence: number;
  daysAwayYtd: number;
  daysAway365: number;
  nextTrip: {
    id: string;
    name: string;
    purpose: string;
    startsOn: string;
    endsOn: string;
  } | null;
  components: {
    rootedness: number;
    belonging: number;
    exploration: number;
    satisfaction: number;
  };
}

/** Headline metrics for the Time freedom. */
export interface TimeSummary extends FreedomBaseSummary {
  mattersHours7: number;
  totalHours7: number;
  mattersShare7: number;
  daysLogged7: number;
  habitsHitThisWeek: number;
  habitsTargetedThisWeek: number;
  nonZeroKinds7: number;
  components: {
    intention: number;
    cadence: number;
    balance: number;
    coverage: number;
  };
}

/** Headline metrics for the Health freedom. */
export interface HealthSummary extends FreedomBaseSummary {
  meanSleep30: number | null;
  sleepVariance30: number | null;
  trainingDays30: number;
  trainingMinutes30: number;
  trainingByKind30: Record<string, number>;
  meanEnergy30: number | null;
  meanRhr30: number | null;
  meanRestingHr30: number | null;
  latestWeightKg: number | null;
  weightDelta30: number | null;
  latestBodyFatPct: number | null;
  components: {
    sleep: number;
    trainingFrequency: number;
    trainingVolume: number;
    recovery: number;
    energy: number;
  };
}
