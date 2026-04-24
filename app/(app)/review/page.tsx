import { requireUser } from "@/lib/auth-server";
import { getWeeklyReview, listEntriesInRange } from "@/lib/db/queries";
import { FREEDOMS } from "@/lib/freedoms/constants";
import type { FreedomKey } from "@/lib/freedoms/types";
import { freedomModules } from "@/lib/freedoms";
import { currentWeek } from "@/lib/week";
import { ScoreRing } from "@/components/freedoms/score-ring";
import { ReviewForm } from "./review-form";
import type { Reflections } from "./types";

export const metadata = { title: "Weekly review" };
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await requireUser();
  const week = currentWeek();

  const [weekRows, existing] = await Promise.all([
    listEntriesInRange(user.id, { start: week.start, end: week.end }),
    getWeeklyReview(user.id, week.start),
  ]);

  // Group by freedom and score each entry.
  const perFreedom = new Map<FreedomKey, { scores: number[]; count: number }>();
  for (const meta of FREEDOMS) perFreedom.set(meta.key, { scores: [], count: 0 });
  for (const row of weekRows) {
    const mod = freedomModules[row.freedom];
    const s = mod.scoreEntry(row.payload ?? {});
    const bucket = perFreedom.get(row.freedom)!;
    bucket.count += 1;
    if (s !== null) bucket.scores.push(s);
  }

  const perFreedomSummary = FREEDOMS.map((meta) => {
    const b = perFreedom.get(meta.key)!;
    const score = b.scores.length
      ? Math.round(b.scores.reduce((a, x) => a + x, 0) / b.scores.length)
      : null;
    return { meta, score, entries: b.count };
  });

  const scoredFreedoms = perFreedomSummary.filter((f) => f.score !== null);
  const suggestedScore = scoredFreedoms.length
    ? Math.round(scoredFreedoms.reduce((a, x) => a + (x.score ?? 0), 0) / scoredFreedoms.length)
    : null;

  const reflections: Reflections = (existing?.reflectionsJson ?? {}) as Reflections;

  return (
    <section className="flex flex-col gap-12">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
            Weekly review · {week.label}
          </p>
          <h1 className="font-serif text-4xl tracking-tight">How was your week?</h1>
          <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">
            {formatRange(week.start, week.end)}. Look at the four scores, then take three minutes to
            note what mattered.
          </p>
        </div>
        {suggestedScore !== null ? (
          <div className="flex flex-col items-end gap-2">
            <ScoreRing
              score={existing?.overallScore ?? suggestedScore}
              color="var(--color-foreground)"
              size={64}
              stroke={4}
            />
            <span className="font-serif text-3xl tabular-nums">
              {existing?.overallScore ?? suggestedScore}
            </span>
          </div>
        ) : null}
      </div>

      <ul className="grid grid-cols-2 gap-0 border-t border-[color:var(--color-border)]">
        {perFreedomSummary.map((f, i) => (
          <li
            key={f.meta.key}
            className={[
              "flex flex-col gap-2 py-6",
              i % 2 === 0 ? "sm:pr-8" : "sm:pl-8",
              i > 1 ? "border-t border-[color:var(--color-border)]" : "",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="h-[2px] w-6 rounded-full"
                  style={{ background: f.meta.colorVar }}
                />
                <h3 className="font-serif text-lg tracking-tight">{f.meta.label}</h3>
              </div>
              <ScoreRing score={f.score ?? 0} color={f.meta.colorVar} size={36} stroke={3} />
            </div>
            <div className="flex items-baseline justify-between font-mono text-xs text-[color:var(--color-ink-soft)]">
              <span>
                score{" "}
                <span className="text-[color:var(--color-foreground)]">
                  {f.score === null ? "—" : f.score}
                </span>
              </span>
              <span>
                {f.entries} {f.entries === 1 ? "entry" : "entries"}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <ReviewForm
        weekStart={week.start}
        weekLabel={week.label}
        suggestedScore={suggestedScore}
        reflections={reflections}
        overallScore={existing?.overallScore ?? null}
      />
    </section>
  );
}

function formatRange(start: string, end: string) {
  const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
  const [sy, sm, sd] = start.split("-").map(Number) as [number, number, number];
  const [ey, em, ed] = end.split("-").map(Number) as [number, number, number];
  const s = fmt.format(new Date(sy, sm - 1, sd));
  const e = fmt.format(new Date(ey, em - 1, ed));
  return `${s} → ${e}`;
}
