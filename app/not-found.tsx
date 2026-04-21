import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col items-start justify-center gap-6 px-6 py-10">
      <p className="font-mono text-xs tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
        404
      </p>
      <h1 className="font-serif text-5xl leading-[1.02] tracking-tight">Nothing here.</h1>
      <p className="max-w-md text-sm text-[color:var(--color-ink-soft)]">
        The page you were looking for doesn&rsquo;t exist — or hasn&rsquo;t been written yet.
      </p>
      <Link
        href="/"
        className="inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-[color:var(--color-foreground)] px-4 text-sm text-[color:var(--color-background)] hover:opacity-90"
      >
        Back home
      </Link>
    </main>
  );
}
