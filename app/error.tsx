"use client";

import Link from "next/link";
import { AppearanceControls } from "@/components/ui/appearance-controls";
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
    <main className="daybreak-public daybreak-auth flex flex-col items-start justify-center gap-6">
      <AppearanceControls />
      <p className="eyebrow">Something broke</p>
      <h1 className="font-display text-5xl leading-[1.02] tracking-tight">A small fault.</h1>
      <p className="max-w-md text-sm text-[color:var(--color-ink-soft)]">
        Try again — or head home. If this keeps happening, the request id is{" "}
        <code className="font-mono text-xs">{error.digest ?? "(dev)"}</code>.
      </p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="daybreak-button inline-flex min-h-11 items-center bg-[color:var(--glass-primary)] px-4 text-sm text-[color:var(--glass-primary-ink)] hover:opacity-90"
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
