"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTransaction, createCategory, setBudgetPlan } from "./cashflow-actions";
import type { ActionResult } from "./types";

const CATEGORY_KINDS = ["income", "fixed", "variable", "savings", "debt"] as const;

const inputBase =
  "h-10 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-3 text-sm focus:border-[color:var(--color-foreground)] focus:outline-none";
const labelCls =
  "font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase";
const btnPrimary =
  "inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-[color:var(--color-foreground)] px-4 text-sm text-[color:var(--color-background)] hover:opacity-90 disabled:opacity-50";

export function AddTransactionForm({
  accounts,
  categories,
}: {
  accounts: Array<{ id: string; name: string; currency: string }>;
  categories: Array<{ id: string; name: string; kind: string }>;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    addTransaction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-3 border border-dashed border-[color:var(--color-border)] p-5 sm:grid-cols-6"
    >
      <div className="flex flex-col gap-1 sm:col-span-1">
        <label className={labelCls}>Flow</label>
        <select name="flow" defaultValue="expense" className={inputBase}>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>
      <div className="flex flex-col gap-1 sm:col-span-1">
        <label className={labelCls}>Amount</label>
        <input type="number" step="0.01" min="0" name="amount" required className={inputBase} />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-1">
        <label className={labelCls}>Date</label>
        <input type="date" name="occurredOn" defaultValue={today} required className={inputBase} />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-3">
        <label className={labelCls}>Description</label>
        <input name="description" maxLength={200} className={inputBase} />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-3">
        <label className={labelCls}>Account</label>
        <select name="accountId" defaultValue="" className={inputBase}>
          <option value="">None</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.currency}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 sm:col-span-3">
        <label className={labelCls}>Category</label>
        <select name="categoryId" defaultValue="" className={inputBase}>
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.kind}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end justify-end gap-3 sm:col-span-6">
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
          {pending ? "Adding…" : "Add transaction"}
        </button>
      </div>
    </form>
  );
}

export function AddCategoryForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createCategory,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Name</label>
        <input name="name" required maxLength={60} className={inputBase} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Kind</label>
        <select name="kind" defaultValue="variable" className={inputBase}>
          {CATEGORY_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Adding…" : "Add category"}
      </button>
      {state ? (
        <p
          className={`ml-2 text-sm ${
            state.ok
              ? "text-[color:var(--color-ink-soft)]"
              : "text-[color:var(--color-accent-warning,#9a3412)]"
          }`}
        >
          {state.ok ? (state.message ?? "Saved.") : state.error}
        </p>
      ) : null}
    </form>
  );
}

export function SetPlanRow({
  month,
  categoryId,
  name,
  kind,
  planned,
  currency,
}: {
  month: string;
  categoryId: string;
  name: string;
  kind: string;
  planned: number;
  currency: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    setBudgetPlan,
    null,
  );
  return (
    <form action={action} className="flex items-center gap-3 py-2">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <div className="flex flex-col">
        <span className="text-sm">{name}</span>
        <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
          {kind}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          name="planned"
          defaultValue={planned || ""}
          placeholder="0"
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
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {state?.ok === false ? (
        <span className="text-xs text-[color:var(--color-accent-warning,#9a3412)]">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
