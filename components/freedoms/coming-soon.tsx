import type { FreedomMeta } from "@/lib/freedoms/types";

/**
 * Editorial placeholder for freedoms whose typed domain model isn't built
 * yet. Mirrors the voice in `design.md` §9 — margin note, no CTA.
 */
export function ComingSoonFreedom({ meta, blurb }: { meta: FreedomMeta; blurb: string }) {
  return (
    <section className="flex flex-col gap-10">
      <header className="daybreak-section-head flex flex-col gap-3 border-b border-[color:var(--color-border)] pb-10">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-[2px] w-8 rounded-full"
            style={{ background: meta.colorVar }}
          />
          <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            {meta.label}
          </span>
        </div>
        <h1 className="font-display max-w-xl text-4xl leading-[1.1] tracking-tight">
          {meta.question}
        </h1>
      </header>

      <p className="max-w-xl text-sm text-[color:var(--color-ink-soft)]">{blurb}</p>

      <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        In development
      </p>
    </section>
  );
}
