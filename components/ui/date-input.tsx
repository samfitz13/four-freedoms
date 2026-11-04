"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "./input";
import { NativeSelect } from "./native-select";
import { Button } from "./button";

type DateInputProps = {
  id?: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  className?: string;
};

export function DateInput({ id, name, defaultValue, required = false, className }: DateInputProps) {
  const initialValue = defaultValue ?? "";
  const [displayValue, setDisplayValue] = useState(formatDisplay(initialValue));
  const [dateValue, setDateValue] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => monthFromValue(initialValue));
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const parsed = parseDate(displayValue);
    input.setCustomValidity(displayValue && !parsed ? "Use YYYY-MM-DD, M/D/YYYY, or Today." : "");
  }, [displayValue]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  function updateDate(value: string) {
    setDateValue(value);
    setDisplayValue(formatDisplay(value));
    if (value) setVisibleMonth(monthFromValue(value));
  }

  function handleChange(value: string) {
    setDisplayValue(value);
    setDateValue(parseDate(value) ?? "");
  }

  function handleBlur() {
    const parsed = parseDate(displayValue);
    if (parsed) updateDate(parsed);
  }

  function selectDate(value: string) {
    updateDate(value);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div
      ref={rootRef}
      data-escape-scope={isOpen ? "" : undefined}
      className="relative flex flex-col gap-1"
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
          inputRef.current?.focus();
        }
      }}
    >
      <input type="hidden" name={name} value={dateValue} />
      <Input
        id={id}
        ref={inputRef}
        type="text"
        required={required}
        inputMode="numeric"
        placeholder="Select date"
        value={displayValue}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={handleBlur}
        className={className}
      />
      {isOpen ? (
        <CalendarPopover
          selectedValue={dateValue}
          visibleMonth={visibleMonth}
          setVisibleMonth={setVisibleMonth}
          onSelect={selectDate}
          onToday={() => selectDate(toDateInputValue(new Date()))}
          onClear={required ? undefined : () => selectDate("")}
        />
      ) : null}
    </div>
  );
}

function CalendarPopover({
  selectedValue,
  visibleMonth,
  setVisibleMonth,
  onSelect,
  onToday,
  onClear,
}: {
  selectedValue: string;
  visibleMonth: Date;
  setVisibleMonth: (date: Date) => void;
  onSelect: (value: string) => void;
  onToday: () => void;
  onClear?: () => void;
}) {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const days = getCalendarDays(year, month);
  const years = Array.from({ length: 121 }, (_, index) => new Date().getFullYear() - 100 + index);

  return (
    <div className="daybreak-popover daybreak-date-popover">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          type="button"
          onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
          className="daybreak-button px-2 py-1 font-sans text-xs text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
          aria-label="Previous month"
        >
          ←
        </Button>
        <div className="grid flex-1 grid-cols-[1fr_5rem] gap-2">
          <NativeSelect
            aria-label="Month"
            value={month}
            onChange={(event) => setVisibleMonth(new Date(year, Number(event.target.value), 1))}
            className="daybreak-field border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-1 py-1 text-sm focus:border-[color:var(--color-foreground)]"
          >
            {monthNames.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Year"
            value={year}
            onChange={(event) => setVisibleMonth(new Date(Number(event.target.value), month, 1))}
            className="daybreak-field border-b border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-1 py-1 text-sm tabular-nums focus:border-[color:var(--color-foreground)]"
          >
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button
          type="button"
          onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
          className="daybreak-button px-2 py-1 font-sans text-xs text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
          aria-label="Next month"
        >
          →
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdayNames.map((day, index) => (
          <div
            key={`${day}-${index}`}
            className="py-1 font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]"
          >
            {day}
          </div>
        ))}
        {days.map((day) => {
          const value = toDateInputValue(day.date);
          const isSelected = value === selectedValue;
          const isOutside = day.date.getMonth() !== month;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              className={[
                "aspect-square text-sm tabular-nums hover:bg-[color:var(--color-paper-soft)]",
                isSelected
                  ? "bg-[color:var(--color-foreground)] text-[color:var(--color-background)]"
                  : "",
                isOutside && !isSelected ? "text-[color:var(--color-ink-soft)]" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {day.date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex gap-3 border-t border-[color:var(--color-border)] pt-3 font-sans text-xs tracking-normal">
        <Button
          type="button"
          onClick={onToday}
          className="daybreak-button text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
        >
          Today
        </Button>
        {onClear ? (
          <Button
            type="button"
            onClick={onClear}
            className="daybreak-button text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function parseDate(value: string) {
  const text = value.trim();
  if (!text) return "";

  const normalized = text.toLowerCase();
  if (normalized === "today") return toDateInputValue(new Date());
  if (normalized === "yesterday") return offsetDate(-1);
  if (normalized === "tomorrow") return offsetDate(1);

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) return buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text);
  if (slash) {
    const month = slash[1] ?? "";
    const day = slash[2] ?? "";
    const yearText = slash[3] ?? "";
    const year = Number(yearText.length === 2 ? `20${yearText}` : yearText);
    return buildDate(year, Number(month), Number(day));
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateInputValue(parsed);
}

function buildDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return toDateInputValue(date);
}

function formatDisplay(value: string) {
  if (!value) return "";
  const date = dateFromInputValue(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function offsetDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromInputValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function monthFromValue(value: string) {
  return dateFromInputValue(value) ?? new Date();
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function getCalendarDays(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date };
  });
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const weekdayNames = ["S", "M", "T", "W", "T", "F", "S"];
