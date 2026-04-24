"use client";

import { useActionState } from "react";
import { FREEDOMS } from "@/lib/freedoms/constants";
import { freedomModules } from "@/lib/freedoms";
import type { FreedomField } from "@/lib/freedoms/types";
import { submitCheckIn } from "./actions";
import type { CheckInResult } from "./types";

type Prefill = Partial<Record<(typeof FREEDOMS)[number]["key"], Record<string, unknown>>>;

/** Fields beyond this index (per freedom) render collapsed by default. */
const FINANCIAL_QUICK_FIELDS = new Set(["netWorth", "savingsRate", "runwayMonths", "note"]);

export function CheckInForm({
  defaultDate,
  prefill,
  baseCurrency,
}: {
  defaultDate: string;
  prefill: Prefill;
  baseCurrency: string;
}) {
  const [state, formAction, pending] = useActionState<CheckInResult | null, FormData>(
    submitCheckIn,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-12">
      <div className="flex items-center gap-4">
        <label
          htmlFor="occurredOn"
          className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase"
        >
          Date
        </label>
        <input
          id="occurredOn"
          name="occurredOn"
          type="date"
          defaultValue={defaultDate}
          required
          className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-3 py-1.5 font-mono text-sm tabular-nums"
        />
      </div>

      {FREEDOMS.map((meta) => {
        const mod = freedomModules[meta.key];
        const values = prefill[meta.key] ?? {};
        const isFinancial = meta.key === "financial";
        const quick = isFinancial
          ? mod.fields.filter((f) => FINANCIAL_QUICK_FIELDS.has(f.name))
          : mod.fields;
        const detail = isFinancial
          ? mod.fields.filter((f) => !FINANCIAL_QUICK_FIELDS.has(f.name))
          : [];
        const hasDetailValues = detail.some((f) => values[f.name] !== undefined);

        return (
          <fieldset
            key={meta.key}
            className="flex flex-col gap-5 border-t border-[color:var(--color-border)] pt-8"
          >
            <legend className="sr-only">{meta.label}</legend>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="h-[2px] w-6 rounded-full"
                style={{ background: meta.colorVar }}
              />
              <h2 className="font-serif text-2xl tracking-tight">{meta.label}</h2>
            </div>
            <p className="text-sm text-[color:var(--color-ink-soft)]">{meta.question}</p>
            <div className="grid gap-5 sm:grid-cols-2">
              {quick.map((field) => (
                <FieldInput
                  key={field.name}
                  freedom={meta.key}
                  field={field}
                  defaultValue={values[field.name]}
                  baseCurrency={baseCurrency}
                />
              ))}
            </div>
            {isFinancial && detail.length > 0 ? (
              <details
                open={hasDetailValues}
                className="group mt-2 border-t border-dashed border-[color:var(--color-border)] pt-4"
              >
                <summary className="cursor-pointer font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase select-none hover:text-[color:var(--color-foreground)]">
                  More detail (optional)
                </summary>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  {detail.map((field) => (
                    <FieldInput
                      key={field.name}
                      freedom={meta.key}
                      field={field}
                      defaultValue={values[field.name]}
                      baseCurrency={baseCurrency}
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </fieldset>
        );
      })}

      <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-[color:var(--color-border)] bg-[color:var(--color-background)] py-4">
        {state?.ok === false ? (
          <p className="text-sm text-[color:var(--color-accent-warning,#9a3412)]">{state.error}</p>
        ) : state?.ok ? (
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            Saved {state.written.length} {state.written.length === 1 ? "freedom" : "freedoms"}.{" "}
            <span className="font-mono text-xs">(dashboard updated)</span>
          </p>
        ) : (
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            Fill what you know — anything blank is skipped.
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-[color:var(--color-foreground)] px-5 text-sm text-[color:var(--color-background)] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save check-in"}
        </button>
      </div>
    </form>
  );
}

function FieldInput({
  freedom,
  field,
  defaultValue,
  baseCurrency,
}: {
  freedom: string;
  field: FreedomField;
  defaultValue?: unknown;
  baseCurrency: string;
}) {
  const id = `${freedom}.${field.name}`;
  const label = (
    <label
      htmlFor={id}
      className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase"
    >
      {field.label}
    </label>
  );
  const hint = field.hint ? (
    <span className="text-xs text-[color:var(--color-ink-soft)]">{field.hint}</span>
  ) : null;

  const base =
    "h-10 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-3 text-sm focus:border-[color:var(--color-foreground)] focus:outline-none";

  switch (field.kind) {
    case "number": {
      return (
        <div className="flex flex-col gap-1">
          {label}
          <div className="flex items-center gap-2">
            <input
              id={id}
              name={id}
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              defaultValue={typeof defaultValue === "number" ? defaultValue : ""}
              className={base}
            />
            {field.suffix ? (
              <span className="font-mono text-xs text-[color:var(--color-ink-soft)]">
                {field.suffix}
              </span>
            ) : null}
          </div>
          {hint}
        </div>
      );
    }
    case "currency": {
      return (
        <div className="flex flex-col gap-1">
          {label}
          <div className="flex items-center gap-2">
            <input
              id={id}
              name={id}
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              defaultValue={typeof defaultValue === "number" ? defaultValue : ""}
              className={base}
            />
            <span className="font-mono text-xs text-[color:var(--color-ink-soft)]">
              {baseCurrency}
            </span>
          </div>
          {hint}
        </div>
      );
    }
    case "percent": {
      const num = typeof defaultValue === "number" ? Math.round(defaultValue * 100) : "";
      return (
        <div className="flex flex-col gap-1">
          {label}
          <div className="flex items-center gap-2">
            <input
              id={id}
              name={id}
              type="number"
              min={0}
              max={100}
              step={1}
              defaultValue={num}
              className={base}
            />
            <span className="font-mono text-xs text-[color:var(--color-ink-soft)]">%</span>
          </div>
          {hint}
        </div>
      );
    }
    case "int": {
      return (
        <div className="flex flex-col gap-1">
          {label}
          <input
            id={id}
            name={id}
            type="number"
            min={field.min}
            max={field.max}
            step={1}
            defaultValue={typeof defaultValue === "number" ? defaultValue : ""}
            className={base}
          />
          {hint}
        </div>
      );
    }
    case "text": {
      return (
        <div className="flex flex-col gap-1 sm:col-span-2">
          {label}
          <input
            id={id}
            name={id}
            type="text"
            maxLength={field.maxLength}
            defaultValue={typeof defaultValue === "string" ? defaultValue : ""}
            className={base}
          />
          {hint}
        </div>
      );
    }
    case "boolean": {
      const checked = defaultValue === true;
      return (
        <div className="flex flex-col gap-1">
          {label}
          <label
            htmlFor={id}
            className="flex h-10 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 text-sm"
          >
            <input
              id={id}
              name={id}
              type="checkbox"
              defaultChecked={checked}
              className="accent-[color:var(--color-foreground)]"
            />
            <span>{field.label}</span>
          </label>
          {hint}
        </div>
      );
    }
  }
}
