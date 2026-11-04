import type { DailyPoint } from "@/lib/freedoms/types";

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysAgo(today: Date, days: number): string {
  const d = new Date(today);
  d.setDate(today.getDate() - days);
  return isoDate(d);
}

export function startOfDay(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function money(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export function hours(value: number): string {
  const whole = Math.floor(value);
  const minutes = Math.round((value - whole) * 60);
  return minutes === 0 ? `${whole}h` : `${whole}h${String(minutes).padStart(2, "0")}`;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function sparklineFrom(points: Array<{ date: string; value: number | null }>): DailyPoint[] {
  const values = points.flatMap((point) => (point.value === null ? [] : [point.value]));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = max - min || 1;
  return points.map((point) => ({
    date: point.date,
    score: point.value === null ? null : Math.round(((point.value - min) / span) * 100),
  }));
}

export function correlation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const xMean = mean(xs);
  const yMean = mean(ys);
  if (xMean === null || yMean === null) return null;
  let top = 0;
  let x2 = 0;
  let y2 = 0;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]! - xMean;
    const y = ys[i]! - yMean;
    top += x * y;
    x2 += x * x;
    y2 += y * y;
  }
  const denom = Math.sqrt(x2 * y2);
  return denom === 0 ? null : top / denom;
}
