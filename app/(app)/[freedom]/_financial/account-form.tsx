"use client";

import { useActionState, useEffect, useRef } from "react";
import { SUPPORTED_CURRENCIES } from "@/lib/freedoms/currency";
import type { FinancialAccount } from "@/lib/db/schema";
import { archiveAccount, createAccount, recordBalance, updateAccount } from "./accounts-actions";
import type { ActionResult } from "./types";

const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "brokerage",
  "retirement",
  "crypto",
  "real_estate",
  "loan",
  "credit_card",
  "other",
] as const;

const inputBase =
  "h-10 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-3 text-sm focus:border-[color:var(--color-foreground)] focus:outline-none";
const labelCls =
  "font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase";
const btnPrimary =
  "inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-[color:var(--color-foreground)] px-4 text-sm text-[color:var(--color-background)] hover:opacity-90 disabled:opacity-50";
const btnGhost =
  "inline-flex h-10 items-center rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 font-mono text-xs tracking-[0.14em] uppercase hover:bg-[color:var(--color-surface-muted,transparent)]";

export function NewAccountForm({ defaultCurrency }: { defaultCurrency: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createAccount,
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
      className="grid gap-4 border border-dashed border-[color:var(--color-border)] p-5 sm:grid-cols-6"
    >
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className={labelCls} htmlFor="new-name">
          Name
        </label>
        <input id="new-name" name="name" required maxLength={80} className={inputBase} />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className={labelCls} htmlFor="new-type">
          Type
        </label>
        <select id="new-type" name="type" required defaultValue="checking" className={inputBase}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 sm:col-span-1">
        <label className={labelCls} htmlFor="new-currency">
          Currency
        </label>
        <select
          id="new-currency"
          name="currency"
          defaultValue={defaultCurrency}
          className={inputBase}
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 sm:col-span-1">
        <label className={labelCls} htmlFor="new-institution">
          Institution
        </label>
        <input
          id="new-institution"
          name="institution"
          maxLength={80}
          className={inputBase}
          placeholder="Optional"
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className={labelCls} htmlFor="new-initial-balance">
          Starting balance
        </label>
        <input
          id="new-initial-balance"
          name="initialBalance"
          type="number"
          step="0.01"
          className={inputBase}
          placeholder="Optional"
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className={labelCls} htmlFor="new-initial-asof">
          As of
        </label>
        <input
          id="new-initial-asof"
          name="initialAsOf"
          type="date"
          defaultValue={today}
          className={inputBase}
        />
      </div>
      <div className="flex items-end justify-end gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Adding…" : "Add account"}
        </button>
      </div>
      {state ? (
        <p
          className={`text-sm sm:col-span-6 ${
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

export function EditAccountForm({ account }: { account: FinancialAccount }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateAccount,
    null,
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-6">
      <input type="hidden" name="id" value={account.id} />
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className={labelCls}>Name</label>
        <input
          name="name"
          defaultValue={account.name}
          required
          maxLength={80}
          className={inputBase}
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className={labelCls}>Type</label>
        <select name="type" defaultValue={account.type} className={inputBase}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 sm:col-span-1">
        <label className={labelCls}>Currency</label>
        <select name="currency" defaultValue={account.currency} className={inputBase}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 sm:col-span-1">
        <label className={labelCls}>Institution</label>
        <input
          name="institution"
          defaultValue={account.institution ?? ""}
          maxLength={80}
          className={inputBase}
        />
      </div>
      <div className="flex items-end justify-end gap-2 sm:col-span-6">
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
        <button type="submit" formAction={archiveAccount} className={btnGhost}>
          Archive
        </button>
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

export function RecordBalanceForm({
  accountId,
  defaultBalance,
}: {
  accountId: string;
  defaultBalance?: number;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    recordBalance,
    null,
  );
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_140px_160px_auto]">
      <input type="hidden" name="accountId" value={accountId} />
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Note</label>
        <input name="note" maxLength={200} className={inputBase} placeholder="Optional" />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>As of</label>
        <input type="date" name="asOf" defaultValue={today} required className={inputBase} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Balance</label>
        <input
          type="number"
          step="0.01"
          name="balance"
          defaultValue={defaultBalance ?? ""}
          required
          className={inputBase}
        />
      </div>
      <div className="flex items-end">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : "Record"}
        </button>
      </div>
      {state ? (
        <p
          className={`text-sm sm:col-span-4 ${
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
