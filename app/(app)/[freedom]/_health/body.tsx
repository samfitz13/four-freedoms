import { listRecentBody } from "@/lib/db/queries/health";
import { formatWeightLb, kgToLb } from "@/lib/freedoms/health-units";
import { BodyMeasurementForm } from "./health-forms";

export async function HealthBodyTab({ householdId }: { householdId: string }) {
  const rows = await listRecentBody(householdId, 90);
  const weight = rows
    .filter((row) => row.weightKg !== null)
    .slice()
    .reverse()
    .map((row) => ({
      date: row.recordedAt.toISOString().slice(0, 10),
      value: kgToLb(Number(row.weightKg)),
    }));
  const bodyFat = rows
    .filter((row) => row.bodyFatPct !== null)
    .slice()
    .reverse()
    .map((row) => ({
      date: row.recordedAt.toISOString().slice(0, 10),
      value: Number(row.bodyFatPct),
    }));
  const waist = rows
    .filter((row) => row.waistCm !== null)
    .slice()
    .reverse()
    .map((row) => ({
      date: row.recordedAt.toISOString().slice(0, 10),
      value: Number(row.waistCm),
    }));

  return (
    <div className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-6">
        <h2 className="font-display text-2xl tracking-tight">Body</h2>
        <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
          Measurements are a trend, not a verdict.
        </p>
      </header>

      <section className="grid gap-8 lg:grid-cols-3">
        <ChartBlock title="Weight · 90d">
          <RangeLine series={weight} suffix=" lbs" annotate />
        </ChartBlock>
        <ChartBlock title="Body fat">
          <RangeLine series={bodyFat} suffix="%" />
        </ChartBlock>
        <ChartBlock title="Waist">
          <RangeLine series={waist} suffix=" cm" />
        </ChartBlock>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          Add measurement
        </h3>
        <BodyMeasurementForm />
      </section>

      <section className="flex flex-col divide-y divide-[color:var(--color-border)]">
        {rows.map((row) => (
          <details key={row.id} className="py-4">
            <summary className="grid cursor-pointer grid-cols-[8rem_1fr_auto] gap-4 text-sm">
              <span className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
                {formatDate(row.recordedAt)}
              </span>
              <span>
                {row.weightKg ? formatWeightLb(Number(row.weightKg)) : "—"}
                {row.bodyFatPct ? ` · ${Number(row.bodyFatPct).toFixed(1)}%` : ""}
                {row.waistCm ? ` · ${Number(row.waistCm).toFixed(1)} cm` : ""}
                {row.restingHr ? ` · ${row.restingHr} bpm` : ""}
              </span>
              <span className="text-[color:var(--color-ink-soft)]">Edit</span>
            </summary>
            {row.note ? (
              <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">{row.note}</p>
            ) : null}
            <div className="mt-5">
              <BodyMeasurementForm measurement={row} />
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4">
      <h3 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function RangeLine({
  series,
  suffix,
  annotate = false,
}: {
  series: { date: string; value: number }[];
  suffix: string;
  annotate?: boolean;
}) {
  if (series.length < 2)
    return <p className="text-sm text-[color:var(--color-ink-soft)]">Not enough signal yet.</p>;
  const width = 360;
  const height = 120;
  const pad = 16;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = series.map((point, index) => ({
    ...point,
    x: pad + index * ((width - pad * 2) / Math.max(1, series.length - 1)),
    y: pad + (height - pad * 2) * (1 - (point.value - min) / span),
  }));
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
  const minPoint = points.find((point) => point.value === min);
  const maxPoint = points.find((point) => point.value === max);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${series.length}-point measurement chart`}
    >
      <line x1={pad} x2={width - pad} y1={pad} y2={pad} stroke="var(--color-border)" />
      <line
        x1={pad}
        x2={width - pad}
        y1={height - pad}
        y2={height - pad}
        stroke="var(--color-border)"
      />
      <path d={path} fill="none" stroke="var(--color-freedom-health)" strokeWidth={1.5} />
      {annotate && minPoint ? <Annotation point={minPoint} label="min" /> : null}
      {annotate && maxPoint ? <Annotation point={maxPoint} label="max" /> : null}
      <text x={pad} y={height - 2} className="fill-[color:var(--color-ink-soft)] font-sans text-xs">
        {min.toFixed(1)}
        {suffix}
      </text>
    </svg>
  );
}

function Annotation({ point, label }: { point: { x: number; y: number }; label: string }) {
  return (
    <>
      <circle cx={point.x} cy={point.y} r={2} fill="var(--color-freedom-health)" />
      <text
        x={point.x + 4}
        y={point.y - 4}
        className="fill-[color:var(--color-ink-soft)] font-sans text-xs"
      >
        {label}
      </text>
    </>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}
