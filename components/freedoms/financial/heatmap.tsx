/**
 * Budget-actuals "heatmap" — really a per-row progress bar sized against
 * its plan, colored by whether spend is under (calm) or over (warning).
 */
import { Money } from "@/components/freedoms/money";

type HeatmapRow = {
  categoryId: string;
  name: string;
  kind: string;
  planned: number;
  actual: number;
};

export function BudgetHeatmap({
  rows,
  currency,
  incomeColor = "var(--color-freedom-financial, #065f46)",
  warnColor = "var(--color-accent-warning, #9a3412)",
  baseColor = "var(--color-ink-soft, #6b7280)",
}: {
  rows: HeatmapRow[];
  currency: string;
  incomeColor?: string;
  warnColor?: string;
  baseColor?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
      {rows.map((r) => {
        const ratio = r.planned > 0 ? r.actual / r.planned : r.actual > 0 ? 1 : 0;
        const pct = Math.max(0, Math.min(1.25, ratio)); // allow 125% visual overflow
        const over = r.planned > 0 && r.actual > r.planned;
        const color = r.kind === "income" ? incomeColor : over ? warnColor : baseColor;
        const widthPct = Math.min(100, pct * 100);
        return (
          <li key={r.categoryId} className="flex flex-col gap-2 py-3">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <span className="text-sm">{r.name}</span>
                <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                  {r.kind}
                </span>
              </div>
              <div className="flex items-baseline gap-3 font-sans text-xs tabular-nums">
                <span className="text-[color:var(--color-ink-soft)]">
                  <Money value={r.actual} currency={currency} fractionDigits={0} />
                  {" / "}
                  {r.planned > 0 ? (
                    <Money value={r.planned} currency={currency} fractionDigits={0} />
                  ) : (
                    <span>no plan</span>
                  )}
                </span>
                <span className={over ? "text-[color:var(--color-accent-warning,#9a3412)]" : ""}>
                  {r.planned > 0 ? `${Math.round(ratio * 100)}%` : "—"}
                </span>
              </div>
            </div>
            <div
              className="relative h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: "var(--color-border)" }}
              aria-hidden
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${widthPct}%`, background: color, opacity: 0.85 }}
              />
              {r.planned > 0 ? (
                <div
                  className="absolute inset-y-[-2px] w-px"
                  style={{ left: "100%", background: "var(--color-foreground)" }}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
