import Link from "next/link";
import { AppearanceControls } from "@/components/ui/appearance-controls";
import { FREEDOMS } from "@/lib/freedoms/constants";

const steps = [
  {
    n: "01",
    title: "Measure what matters",
    body: "A one-minute daily check-in across four freedoms. Skip anything you don't have data for — it waits.",
  },
  {
    n: "02",
    title: "Watch the compound curve",
    body: "A unified dashboard rolls each freedom into a single score, trend, and streak. No dashboards-of-dashboards.",
  },
  {
    n: "03",
    title: "Sit with the week",
    body: "Every Sunday, a three-prompt review. Wins. Struggles. Next week. Your own running narrative.",
  },
] as const;

export default function Home() {
  return (
    <main className="daybreak-public flex min-h-svh flex-col justify-between">
      <AppearanceControls />
      <header className="flex items-center justify-between">
        <span className="brand-mark">freedom-four</span>
        <nav className="app-nav-text flex gap-6">
          <Link href="/login" className="hover:text-[color:var(--color-foreground)]">
            Sign in
          </Link>
        </nav>
      </header>

      <section className="flex flex-col gap-10 py-16 sm:py-24">
        <p className="eyebrow">A personal instrument</p>

        <h1 className="font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl">
          Four freedoms.
          <br />
          <span className="text-[color:var(--color-ink-soft)] italic">One instrument.</span>
        </h1>

        <p className="max-w-xl text-lg leading-relaxed text-[color:var(--color-ink-soft)]">
          Financial, Location, Time, Health. Measure them weekly, reflect on them honestly, compound
          them over decades. A quiet system for the life you&rsquo;re actually living.
        </p>

        <div className="flex items-center gap-6">
          <Link
            href="/login"
            className="daybreak-button inline-flex h-11 items-center bg-[color:var(--glass-primary)] px-5 text-sm font-medium text-[color:var(--glass-primary-ink)] transition-opacity hover:opacity-90"
          >
            Begin
          </Link>
          <Link
            href="#freedoms"
            className="text-sm text-[color:var(--color-ink-soft)] underline underline-offset-4 hover:text-[color:var(--color-foreground)]"
          >
            The four freedoms
          </Link>
        </div>
      </section>

      <section id="freedoms" className="daybreak-panel p-6">
        <p className="eyebrow">The four</p>
        <ul className="mt-4 grid gap-0 sm:grid-cols-2">
          {FREEDOMS.map((f, i) => (
            <li
              key={f.key}
              className={[
                "flex flex-col gap-3 py-8 sm:py-10",
                i % 2 === 0 ? "sm:pr-10" : "sm:pl-10",
                i < 2 ? "" : "sm:border-t sm:border-[color:var(--color-border)]",
                i === 1 ? "border-t border-[color:var(--color-border)] sm:border-t-0" : "",
                i > 0 && i !== 2 ? "border-t border-[color:var(--color-border)] sm:border-t" : "",
              ].join(" ")}
            >
              <span
                aria-hidden
                className="h-[2px] w-8 rounded-full"
                style={{ background: f.colorVar }}
              />
              <h3 className="font-display text-2xl tracking-tight">{f.label}</h3>
              <p className="text-sm text-[color:var(--color-ink-soft)]">{f.question}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="daybreak-panel mt-16 p-6">
        <p className="eyebrow">How it works</p>
        <ol className="mt-4 flex flex-col gap-0">
          {steps.map((s, i) => (
            <li
              key={s.n}
              className={[
                "grid grid-cols-[auto_1fr] items-start gap-6 py-6",
                i > 0 ? "border-t border-[color:var(--color-border)]" : "",
              ].join(" ")}
            >
              <span className="eyebrow">{s.n}</span>
              <div className="flex flex-col gap-2">
                <h4 className="font-display text-xl tracking-tight">{s.title}</h4>
                <p className="text-sm text-[color:var(--color-ink-soft)]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="daybreak-panel mt-16 flex flex-col gap-4 p-6">
        <p className="eyebrow">Private by design</p>
        <p className="max-w-xl text-base leading-relaxed">
          No ads. No tracking pixels. Magic-link sign-in, a database you could point at your own
          Postgres tomorrow, and a quiet monthly cadence — not another app pinging you in the
          supermarket.
        </p>
        <Link
          href="/login"
          className="daybreak-button mt-2 inline-flex h-11 w-fit items-center bg-[color:var(--glass-primary)] px-5 text-sm font-medium text-[color:var(--glass-primary-ink)] transition-opacity hover:opacity-90"
        >
          Begin with your email
        </Link>
      </section>

      <footer className="brand-mark mt-16 flex items-center justify-between border-t border-[color:var(--color-border)] pt-6">
        <span>© {new Date().getFullYear()} freedom-four</span>
        <span>v0.1 · private beta</span>
      </footer>
    </main>
  );
}
