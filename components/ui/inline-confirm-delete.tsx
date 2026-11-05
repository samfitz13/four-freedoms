"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Quiet, editorial two-step delete. First click arms the action ("Delete?");
 * second click inside a short window confirms and submits. Escape or the
 * inline Cancel control disarms. Auto-disarms on timeout so a stale armed
 * state can't sit around and surprise the reader.
 *
 * No toast, no dialog, no undo snackbar. The confirmation is the editorial
 * version of "are you sure" — right where the action happens.
 */
export function InlineConfirmDelete({
  action,
  id,
  fieldName = "id",
  armLabel = "Delete",
  confirmLabel = "Delete?",
  ariaLabel,
  timeoutMs = 4000,
  buttonClassName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  fieldName?: string;
  armLabel?: string;
  confirmLabel?: string;
  ariaLabel?: string;
  timeoutMs?: number;
  buttonClassName?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLFormElement>(null);

  const disarm = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setArmed(false);
  };

  const arm = () => {
    setArmed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setArmed(false), timeoutMs);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const ghost =
    buttonClassName ??
    "daybreak-button text-xs text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-accent-warning,#9a3412)]";

  return (
    <form
      ref={containerRef}
      data-escape-scope={armed ? "" : undefined}
      action={action}
      onKeyDown={(event) => {
        if (event.key === "Escape" && armed) {
          event.preventDefault();
          event.stopPropagation();
          disarm();
        }
      }}
      onBlur={(e) => {
        if (!armed) return;
        if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
          disarm();
        }
      }}
    >
      <input type="hidden" name={fieldName} value={id} />
      {armed ? (
        <span className="inline-flex items-center gap-2">
          <ConfirmSubmitButton label={confirmLabel} />
          <button
            type="button"
            onClick={disarm}
            className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" onClick={arm} aria-label={ariaLabel ?? armLabel} className={ghost}>
          {armLabel}
        </button>
      )}
    </form>
  );
}

function ConfirmSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      autoFocus
      disabled={pending}
      className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-accent-warning,#9a3412)] disabled:opacity-60"
    >
      {pending ? "Deleting…" : label}
    </button>
  );
}
