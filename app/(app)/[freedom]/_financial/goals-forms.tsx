"use client";

import { useActionState, useEffect, useRef } from "react";
import { createGoal, setFiGoal, updateGoalProgress } from "./goals-actions";
import type { ActionResult } from "./types";

const GOAL_KINDS_USER = [
  "net_worth_target",
  "savings_milestone",
  "debt_payoff",
  "emergency_fund",
] as const;

const inputBase =
  "h-10 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-3 text-sm focus:border-[color:var(--color-foreground)] focus:outline-none";
const labelCls =
  "font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase";
const btnPrimary =
  "inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-[color:var(--color-foreground)] px-4 text-sm text-[color:var(--color-background)] hover:opacity-90 disabled:opacity-50";

export function FiGoalForm({
  defaults,
  currency,
}: {
  defaults: {
    annualSpend?: number;
    withdrawalRate?: number;
    realReturn?: number;
    monthlyContribution?: number;
  };
  currency: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(setFiGoal, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Annual spend</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="annualSpend"
            min="0"
            step="100"
            defaultValue={defaults.annualSpend ?? ""}
            required
            className={inputBase}
          />
          <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
            {currency}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Withdrawal rate</label>
        <input
          type="number"
          name="withdrawalRate"
          min="0.005"
          max="0.25"
          step="0.005"
          defaultValue={defaults.withdrawalRate ?? 0.04}
          className={inputBase}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Real return</label>
        <input
          type="number"
          name="realReturn"
          min="-0.1"
          max="0.15"
          step="0.005"
          defaultValue={defaults.realReturn ?? 0.05}
          className={inputBase}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Monthly contribution</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="monthlyContribution"
            min="0"
            step="50"
            defaultValue={defaults.monthlyContribution ?? 0}
            className={inputBase}
          />
          <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
            {currency}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:col-span-4">
        {state ? (
          <p
            className={`mr-auto text-sm ${
              state.ok
                ? "text-[color:var(--color-ink-soft)]"
                : "text-[color:var(--color-accent-warning,#9a3412)]"
            }`}
          >
            {state.ok ? (state.message ?? "Saved.") : state.error}
          </p>
        ) : (
          <span className="mr-auto text-xs text-[color:var(--color-ink-soft)]">
            Withdrawal and return are decimals (e.g. 0.04, 0.05 = real, net of inflation).
          </span>
        )}
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : "Save FI target"}
        </button>
      </div>
    </form>
  );
}

export function NewGoalForm({ currency }: { currency: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createGoal, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-3 border border-dashed border-[color:var(--color-border)] p-5 sm:grid-cols-6"
    >
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className={labelCls}>Kind</label>
        <select name="kind" defaultValue="savings_milestone" className={inputBase}>
          {GOAL_KINDS_USER.map((k) => (
            <option key={k} value={k}>
              {k.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 sm:col-span-4">
        <label className={labelCls}>Title</label>
        <input name="title" required maxLength={80} className={inputBase} />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className={labelCls}>Target amount</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="targetAmount"
            min="0"
            step="100"
            required
            className={inputBase}
          />
          <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
            {currency}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className={labelCls}>Current</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="currentProgress"
            min="0"
            step="100"
            className={inputBase}
            placeholder="0"
          />
          <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
            {currency}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className={labelCls}>Target date</label>
        <input type="date" name="targetDate" className={inputBase} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-6">
        {state ? (
          <p
            className={`mr-auto text-sm ${
              state.ok
                ? "text-[color:var(--color-ink-soft)]"
                : "text-[color:var(--color-accent-warning,#9a3412)]"
            }`}
          >
            {state.ok ? (state.message ?? "Saved.") : state.error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Adding…" : "Add goal"}
        </button>
      </div>
    </form>
  );
}

export function UpdateProgressForm({
  id,
  currentProgress,
  currency,
}: {
  id: string;
  currentProgress: number;
  currency: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateGoalProgress,
    null,
  );
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        type="number"
        name="currentProgress"
        min="0"
        step="100"
        defaultValue={currentProgress}
        className="h-9 w-32 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-2 text-sm tabular-nums focus:border-[color:var(--color-foreground)] focus:outline-none"
      />
      <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-ink-soft)] uppercase">
        {currency}
      </span>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 font-mono text-xs tracking-[0.14em] uppercase hover:bg-[color:var(--color-surface-muted,transparent)] disabled:opacity-50"
      >
        {pending ? "…" : "Update"}
      </button>
      {state?.ok === false ? (
        <span className="text-xs text-[color:var(--color-accent-warning,#9a3412)]">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
