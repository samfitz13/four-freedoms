"use client";

import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/ui/field";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SUPPORTED_CURRENCIES } from "@/lib/freedoms/currency";
import type { FinancialAccount } from "@/lib/db/schema";
import { ACCOUNT_SUBTYPES } from "@/lib/freedoms/constants";
import { titleCaseSubtype } from "@/lib/freedoms/account-subtypes";
import { archiveAccount, createAccount, updateAccount } from "./accounts-actions";
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
  "equity_comp",
  "iso_options",
  "other",
] as const;

type AccountTypeKey = (typeof ACCOUNT_TYPES)[number];

function titleCaseType(t: string): string {
  return t
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function NewAccountForm({
  defaultCurrency,
  onSuccess,
}: {
  defaultCurrency: string;
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createAccount,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<AccountTypeKey>("checking");
  const subtypes: readonly string[] = ACCOUNT_SUBTYPES[type] ?? [];

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
      onReset={() => setType("checking")}
      className="daybreak-panel grid gap-4 border-dashed p-6 sm:grid-cols-6"
    >
      <Field label="Name" className="sm:col-span-2">
        <Input id="new-name" name="name" required maxLength={80} />
      </Field>
      <Field label="Type" className="sm:col-span-2">
        <NativeSelect
          id="new-type"
          name="type"
          required
          value={type}
          onChange={(e) => setType(e.target.value as AccountTypeKey)}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {titleCaseType(t)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Subtype" className="sm:col-span-2">
        <NativeSelect
          id="new-subtype"
          name="subtype"
          defaultValue=""
          disabled={subtypes.length === 0}
        >
          <option value="">{subtypes.length === 0 ? "—" : "None"}</option>
          {subtypes.map((s) => (
            <option key={s} value={s}>
              {titleCaseSubtype(s)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Currency" className="sm:col-span-1">
        <NativeSelect id="new-currency" name="currency" defaultValue={defaultCurrency}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Institution" className="sm:col-span-1">
        <Input id="new-institution" name="institution" maxLength={80} placeholder="Optional" />
      </Field>
      <div className="flex items-end justify-end gap-3 sm:col-span-6">
        <Button type="submit" disabled={pending} variant="primary">
          {pending ? "Adding…" : "Add account"}
        </Button>
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

export function EditAccountForm({
  account,
  onSuccess,
  onCancel,
}: {
  account: FinancialAccount;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateAccount,
    null,
  );
  const [type, setType] = useState<AccountTypeKey>(account.type as AccountTypeKey);
  const subtypes: readonly string[] = ACCOUNT_SUBTYPES[type] ?? [];
  useEffect(() => {
    if (state?.ok) onSuccess?.();
  }, [state, onSuccess]);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-6">
      <input type="hidden" name="id" value={account.id} />
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" defaultValue={account.name} required maxLength={80} />
      </Field>
      <Field label="Type" className="sm:col-span-2">
        <NativeSelect
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as AccountTypeKey)}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {titleCaseType(t)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Subtype" className="sm:col-span-2">
        <NativeSelect
          name="subtype"
          defaultValue={account.subtype ?? ""}
          disabled={subtypes.length === 0}
        >
          <option value="">{subtypes.length === 0 ? "—" : "None"}</option>
          {subtypes.map((s) => (
            <option key={s} value={s}>
              {titleCaseSubtype(s)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Currency" className="sm:col-span-1">
        <NativeSelect name="currency" defaultValue={account.currency}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Institution" className="sm:col-span-1">
        <Input name="institution" defaultValue={account.institution ?? ""} maxLength={80} />
      </Field>
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
        <Button type="submit" formAction={archiveAccount}>
          Archive
        </Button>
        {onCancel ? <Button onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" disabled={pending} variant="primary">
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
