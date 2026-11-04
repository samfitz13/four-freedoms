"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/ui/field";

import { useActionState, useEffect, useRef } from "react";
import { addTransaction, createCategory, setBudgetPlan } from "./cashflow-actions";
import type { ActionResult } from "./types";

const CATEGORY_KINDS = ["income", "fixed", "variable", "savings", "debt"] as const;

export function AddTransactionForm({
  accounts,
  categories,
  onSuccess,
}: {
  accounts: Array<{ id: string; name: string; currency: string }>;
  categories: Array<{ id: string; name: string; kind: string }>;
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    addTransaction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state, onSuccess]);

  return (
    <form
      ref={formRef}
      action={action}
      className="daybreak-panel grid gap-3 border-dashed p-6 sm:grid-cols-6"
    >
      <Field label="Flow" className="sm:col-span-1">
        <NativeSelect name="flow" defaultValue="expense">
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </NativeSelect>
      </Field>
      <Field label="Amount" className="sm:col-span-1">
        <Input type="number" step="0.01" min="0" name="amount" required />
      </Field>
      <Field label="Date" className="sm:col-span-1">
        <Input type="date" name="occurredOn" defaultValue={today} required />
      </Field>
      <Field label="Description" className="sm:col-span-3">
        <Input name="description" maxLength={200} />
      </Field>
      <Field label="Account" className="sm:col-span-3">
        <NativeSelect name="accountId" defaultValue="">
          <option value="">None</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.currency}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Category" className="sm:col-span-3">
        <NativeSelect name="categoryId" defaultValue="">
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.kind}
            </option>
          ))}
        </NativeSelect>
      </Field>
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
        <Button type="submit" disabled={pending} variant="primary">
          {pending ? "Adding…" : "Add transaction"}
        </Button>
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
      <Field label="Name">
        <Input name="name" required maxLength={60} />
      </Field>
      <Field label="Kind">
        <NativeSelect name="kind" defaultValue="variable">
          {CATEGORY_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Button type="submit" disabled={pending} variant="primary">
        {pending ? "Adding…" : "Add category"}
      </Button>
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
        <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          {kind}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          name="planned"
          aria-label={`${name} planned amount`}
          defaultValue={planned || ""}
          placeholder="0"
          className="w-32 tabular-nums"
        />
        <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          {currency}
        </span>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {state?.ok === false ? (
        <span className="text-xs text-[color:var(--color-accent-warning,#9a3412)]">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
