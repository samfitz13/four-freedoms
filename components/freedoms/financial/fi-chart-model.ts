import type { MonthlyBalancePoint } from "@/lib/freedoms/types";
import { formatProjectionDate } from "@/lib/profile/birth-date";
import type {
  FiChartComparison,
  FiChartModel,
  FiChartSample,
  FiProjectionChartProps,
} from "./types";

/** Calendar months, not elapsed milliseconds: leap years cannot distort the scale. */
export function fiMonthIndex(date: string): number | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(date);
  if (!match) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

export function fiMonthString(index: number): string {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
}

export function formatFiMonth(date: string, birthDate?: string | null): string {
  return formatProjectionDate(date, birthDate);
}

export function fiScenarioMarkerPath(
  kind: FiChartComparison["kind"],
  x: number,
  y: number,
  size = 4,
): string {
  if (kind === "downside") return `M${x - size} ${y - size}h${size * 2}v${size * 2}h${-size * 2}Z`;
  if (kind === "upside") return `M${x} ${y - size}l${size} ${size * 2}h${-size * 2}Z`;
  return `M${x - size} ${y}a${size} ${size} 0 1 0 ${size * 2} 0a${size} ${size} 0 1 0 ${-size * 2} 0`;
}

export function buildFiChartModel(
  input: Pick<
    FiProjectionChartProps,
    "planSeries" | "actualSeries" | "fiNumber" | "comparisonSeries"
  >,
  nearTerm = false,
): FiChartModel | null {
  const plan = cleanSeries(input.planSeries);
  const actual = cleanSeries(input.actualSeries ?? []);
  const comparisons = (input.comparisonSeries ?? []).map((item) => ({
    ...item,
    series: cleanSeries(item.series),
  }));
  const anchor = fiMonthIndex(plan[0]?.month ?? "");
  if (anchor === null || !Number.isFinite(input.fiNumber) || input.fiNumber <= 0) return null;

  const allSamples = new Map<string, FiChartSample>(
    comparisons.flatMap((item) =>
      item.series.map((point) => [point.month, { ...point, recorded: false }] as const),
    ),
  );
  for (const point of plan) allSamples.set(point.month, { ...point, recorded: false });
  // At the shared anchor, show the recorded value, not a second forecast value.
  for (const point of actual) allSamples.set(point.month, { ...point, recorded: true });
  const all = [...allSamples.values()].sort((a, b) => a.month.localeCompare(b.month));
  const first = fiMonthIndex(all[0]!.month)!;
  const last = fiMonthIndex(all[all.length - 1]!.month)!;
  const start = nearTerm ? Math.max(first, anchor - 12) : first;
  const end = Math.max(start + 1, nearTerm ? Math.min(last, anchor + 60) : last);
  const inRange = (point: MonthlyBalancePoint) => {
    const month = fiMonthIndex(point.month)!;
    return month >= start && month <= end;
  };
  const visibleActual = actual.filter(inRange);
  const visiblePlan = plan.filter(inRange);
  const samples = all.filter(inRange);
  const visibleComparisons = comparisons.map((item) => ({
    ...item,
    series: item.series.filter(inRange),
  }));
  const values = [
    ...samples.map((point) => point.balance),
    ...visibleComparisons.flatMap((item) => item.series.map((point) => point.balance)),
    input.fiNumber,
    0,
  ];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const roughStep = (hi - lo) / 4;
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const fraction = roughStep / power;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.ceil(hi / step) * step;
  const yTicks = Array.from(
    { length: Math.round((yMax - yMin) / step) + 1 },
    (_, i) => yMin + i * step,
  );
  return {
    actual: visibleActual,
    plan: visiblePlan,
    comparisons: visibleComparisons,
    samples,
    start,
    end,
    anchor,
    yMin,
    yMax,
    yTicks,
  };
}

/** Inspect only supplied points. Never fill a missing statement month with zero. */
export function nearestFiSample(model: FiChartModel, month: number): number {
  let nearest = 0;
  for (let i = 1; i < model.samples.length; i++) {
    if (
      Math.abs(fiMonthIndex(model.samples[i]!.month)! - month) <
      Math.abs(fiMonthIndex(model.samples[nearest]!.month)! - month)
    )
      nearest = i;
  }
  return nearest;
}

function cleanSeries(series: MonthlyBalancePoint[]): MonthlyBalancePoint[] {
  const points = new Map<string, MonthlyBalancePoint>();
  for (const point of series) {
    if (fiMonthIndex(point.month) !== null && Number.isFinite(point.balance))
      points.set(point.month, point);
  }
  return [...points.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Smooth through every point, without overshooting balances or rounding away peaks. */
export function smoothFiPath(points: Array<{ x: number; y: number }>): string {
  const first = points[0];
  if (!first) return "";
  const linear = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  if (points.length < 3 || points.some((p, i) => i > 0 && p.x <= points[i - 1]!.x)) return linear;

  const slopes = points.slice(1).map((p, i) => {
    const previous = points[i]!;
    return (p.y - previous.y) / (p.x - previous.x);
  });
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0]!;
    if (i === points.length - 1) return slopes[i - 1]!;
    const before = slopes[i - 1]!;
    const after = slopes[i]!;
    if (Math.sign(before) !== Math.sign(after)) return 0;
    return Math.sign(before) * Math.min(Math.abs(before), Math.abs(after));
  });

  let path = `M${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]!;
    const point = points[i]!;
    const third = (point.x - previous.x) / 3;
    path += ` C${previous.x + third} ${previous.y + tangents[i - 1]! * third} ${point.x - third} ${point.y - tangents[i]! * third} ${point.x} ${point.y}`;
  }
  return path;
}
