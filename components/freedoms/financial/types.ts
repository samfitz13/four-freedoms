import type { FiReturnHistory, FiReturnScenario, MonthlyBalancePoint } from "@/lib/freedoms/types";

export type ChartPoint = { date: string; value: number };

export type StackedAreaLayer = {
  key: string;
  label: string;
  color: string;
  points: ChartPoint[];
  outline?: "solid" | "dotted";
};

export type FiChartMilestone = {
  id: string;
  title: string;
  targetDate: string | null;
  targetAmount: number | null;
  status: string;
};

export type FiProjectionChartProps = {
  planSeries: MonthlyBalancePoint[];
  comparisonSeries?: FiChartComparison[];
  actualSeries?: MonthlyBalancePoint[];
  fiNumber: number;
  fiMonth?: string | null;
  todayMonth: string;
  currency: string;
  birthDate?: string | null;
  milestones?: FiChartMilestone[];
  ariaLabel?: string;
  retirementMonth?: string | null;
};

export type FiChartComparison = {
  kind: FiReturnScenario["kind"];
  title: string;
  series: MonthlyBalancePoint[];
  fiMonth: string | null;
  depletionMonth?: string | null;
  firstShortfallMonth?: string | null;
};

export type FiChartSample = MonthlyBalancePoint & { recorded: boolean };

export type FiScenarioComparisonProps = {
  scenarios: FiReturnScenario[];
  returnHistory?: FiReturnHistory;
  stress?: import("@/lib/freedoms/fi-stress").FiStressResults;
  chart: Omit<FiProjectionChartProps, "planSeries" | "fiNumber" | "fiMonth" | "ariaLabel">;
};

export type FiChartModel = {
  actual: MonthlyBalancePoint[];
  plan: MonthlyBalancePoint[];
  comparisons: FiChartComparison[];
  samples: FiChartSample[];
  start: number;
  end: number;
  anchor: number;
  yMin: number;
  yMax: number;
  yTicks: number[];
};
