"use client";

import { useState, useTransition } from "react";

type ActionResult = { ok: boolean; message?: string } | void;
type ActionFn = () => Promise<ActionResult>;

export function SeedButton({
  action,
  label,
  variant = "primary",
  confirm,
}: {
  action: ActionFn;
  label: string;
  variant?: "primary" | "ghost";
  /** When set, require the user to type this phrase before running the action. */
  confirm?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<"idle" | "confirming">("idle");
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState<null | { ok: boolean; message: string }>(null);

  const reset = () => {
    setStage("idle");
    setTyped("");
  };

  const run = () => {
    setStatus(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result && typeof result === "object") {
          setStatus({
            ok: result.ok,
            message: result.message ?? (result.ok ? "Done." : "Something went wrong."),
          });
        } else {
          setStatus({ ok: true, message: "Done." });
        }
      } catch (err) {
        setStatus({
          ok: false,
          message: err instanceof Error ? err.message : "Something went wrong.",
        });
      } finally {
        reset();
      }
    });
  };

  const baseCls =
    variant === "primary"
      ? "daybreak-button inline-flex min-h-11 items-center bg-[color:var(--glass-primary)] px-4 text-sm text-[color:var(--glass-primary-ink)] hover:opacity-90 disabled:opacity-50"
      : "daybreak-button inline-flex min-h-11 items-center border border-[color:var(--color-border)] px-4 text-sm text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)] disabled:opacity-50";

  if (stage === "confirming" && confirm) {
    const matched = typed.trim().toUpperCase() === confirm.toUpperCase();
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor={`confirm-${confirm}`}
            className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]"
          >
            Type <span className="text-[color:var(--color-foreground)]">{confirm}</span> to confirm
          </label>
          <input
            id={`confirm-${confirm}`}
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matched && !pending) {
                e.preventDefault();
                run();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                reset();
              }
            }}
            autoComplete="off"
            spellCheck={false}
            aria-label={`Type ${confirm} to confirm`}
            className="daybreak-field w-32 border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-1 py-1 font-sans text-sm focus:border-[color:var(--color-foreground)]"
          />
          <button
            type="button"
            disabled={!matched || pending}
            onClick={run}
            className="daybreak-button inline-flex min-h-11 items-center border border-[color:var(--color-foreground)] px-4 text-sm disabled:opacity-40"
          >
            {pending ? "Working…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)] disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        {status ? <StatusLine status={status} /> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm) {
            setStatus(null);
            setStage("confirming");
          } else {
            run();
          }
        }}
        className={baseCls}
      >
        {pending ? "Working…" : label}
      </button>
      {status ? <StatusLine status={status} /> : null}
    </div>
  );
}

function StatusLine({ status }: { status: { ok: boolean; message: string } }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]"
    >
      {status.message}
    </p>
  );
}
