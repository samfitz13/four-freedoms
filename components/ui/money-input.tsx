"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { Input } from "./input";

export function MoneyInput({
  name,
  label,
  defaultValue = 0,
  currency = "USD",
  required = false,
  className = "",
}: {
  name: string;
  label: string;
  defaultValue?: number;
  currency?: string;
  required?: boolean;
  className?: string;
}) {
  const [raw, setRaw] = useState(toRaw(defaultValue));
  const [focused, setFocused] = useState(false);
  const number = parseMoney(raw);
  const symbol = currencySymbol(currency);

  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {label}
      </span>
      <span className="relative block">
        <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 font-sans text-xs text-[color:var(--color-ink-soft)]">
          {symbol}
        </span>
        <Input
          type="text"
          inputMode="decimal"
          pattern="[0-9.,]*"
          required={required}
          value={focused ? raw : formatMoney(number)}
          onFocus={(e) => {
            // Select after the formatted value becomes editable, not before React replaces it.
            flushSync(() => setFocused(true));
            e.currentTarget.select();
          }}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => {
            setRaw(toRaw(number));
            setFocused(false);
          }}
          className="rounded-[var(--radius-sm)] pr-2 pl-6 text-right tabular-nums focus:border-[color:var(--color-foreground)]"
        />
        <input type="hidden" name={name} value={toRaw(number)} />
      </span>
    </label>
  );
}

export function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.max(0, value) : 0;
  const parsed = Number(
    String(value ?? "")
      .replace(/[$,]/g, "")
      .trim(),
  );
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function toRaw(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function currencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? "$"
  );
}
