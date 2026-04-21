"use client";

import { useTransition } from "react";

export function SeedButton({
  action,
  label,
  variant = "primary",
}: {
  action: () => Promise<void>;
  label: string;
  variant?: "primary" | "ghost";
}) {
  const [pending, startTransition] = useTransition();
  const cls =
    variant === "primary"
      ? "inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-[color:var(--color-foreground)] px-4 text-sm text-[color:var(--color-background)] hover:opacity-90 disabled:opacity-50"
      : "inline-flex h-10 items-center rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-4 text-sm text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)] disabled:opacity-50";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => action())}
      className={cls}
    >
      {pending ? "Working…" : label}
    </button>
  );
}
