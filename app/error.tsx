"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col items-start justify-center gap-6 px-6 py-10">
      <p className="font-mono text-xs tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
        Something broke
      </p>
      <h1 className="font-serif text-5xl leading-[1.02] tracking-tight">A small fault.</h1>
      <p className="max-w-md text-sm text-[color:var(--color-ink-soft)]">
        Try again — or head home. If this keeps happening, the request id is{" "}
        <code className="font-mono text-xs">{error.digest ?? "(dev)"}</code>.
      </p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-[color:var(--color-foreground)] px-4 text-sm text-[color:var(--color-background)] hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="text-sm text-[color:var(--color-ink-soft)] underline underline-offset-2 hover:text-[color:var(--color-foreground)]"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
