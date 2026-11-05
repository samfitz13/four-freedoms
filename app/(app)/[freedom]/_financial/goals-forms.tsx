"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { createGoal, setFiGoal, setGoalLinks, updateGoalProgress } from "./goals-actions";
import type { AccountOption, ActionResult, DerivedFiDefaults } from "./types";
import type { FiGoalAssumptions } from "@/lib/freedoms/types";
import { FI_RETURN_DEFAULTS } from "@/lib/freedoms/constants";
import { nominalToRealReturn } from "@/lib/freedoms/fi-scenarios";
import { FiPlanFields } from "./fi-plan-fields";
import type { FiPlanFormInputs } from "@/lib/freedoms/types";

export type { AccountOption, DerivedFiDefaults };

const GOAL_KINDS_USER = [
  "net_worth_target",
  "savings_milestone",
  "debt_payoff",
  "emergency_fund",
  "savings_rate_target",
] as const;

const LINKABLE_CLASSES = [
  { value: "cash", label: "Cash" },
  { value: "investments", label: "Investments" },
  { value: "debt", label: "Debt" },
  { value: "equity", label: "Equity" },
] as const;

function fmtMonthYear(month: string | null): string {
  if (!month) return "";
  const d = new Date(month + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}

function titleCaseKind(k: string): string {
  return k
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const inputBase =
  "daybreak-field min-h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-3 text-sm focus:border-[color:var(--color-foreground)]";
const labelCls = "font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]";
const btnPrimary =
  "daybreak-button inline-flex min-h-11 items-center bg-[color:var(--glass-primary)] px-4 text-sm text-[color:var(--glass-primary-ink)] hover:opacity-90 disabled:opacity-50";
const EMPTY_GOAL_FIELDS = {
  title: "",
  targetAmount: "",
  currentProgress: "",
  targetRate: "",
  rateWindow: "12",
  targetDate: "",
};

function usePreservedForm(allowReset?: RefObject<boolean>) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = ref.current;
    // React disables synthetic events during its automatic action reset.
    // A native listener keeps failed submissions, including checkboxes, intact.
    const preserve = (event: Event) => {
      if (!allowReset?.current) event.preventDefault();
    };
    form?.addEventListener("reset", preserve);
    return () => form?.removeEventListener("reset", preserve);
  }, [allowReset]);
  return ref;
}

export function FiGoalForm({
  defaults,
  derived,
  currency,
  onSuccess,
  view,
  birthDate,
}: {
  defaults: FiGoalAssumptions;
  derived?: DerivedFiDefaults;
  currency: string;
  onSuccess?: () => void;
  view?: FiPlanFormInputs;
  birthDate?: string | null;
}) {
  const fieldId = useId();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(setFiGoal, null);
  const formRef = usePreservedForm();
  const [returnMode, setReturnMode] = useState(
    view?.settings?.returnMode ?? (defaults.annualSpend !== undefined ? "manual" : "portfolio"),
  );
  useEffect(() => {
    if (state?.ok) onSuccess?.();
  }, [state, onSuccess]);

  // Pre-fill: saved value wins, otherwise derived value, otherwise the
  // canonical defaults (4% withdrawal, 5% real return).
  const initContribution =
    defaults.monthlyContribution ?? derived?.trailingContributions.average ?? 0;
  const initRealReturnPct = ((defaults.realReturn ?? FI_RETURN_DEFAULTS.realReturn) * 100).toFixed(
    1,
  );
  const initWithdrawalPct = ((defaults.withdrawalRate ?? 0.04) * 100).toFixed(1);

  const [contribution, setContribution] = useState<string>(String(initContribution));
  const [manualContribution, setManualContribution] = useState(
    defaults.useManualContribution ?? false,
  );
  const [realReturnPct, setRealReturnPct] = useState<string>(initRealReturnPct);
  const [annualSpend, setAnnualSpend] = useState(String(defaults.annualSpend ?? ""));
  const [withdrawalPct, setWithdrawalPct] = useState(initWithdrawalPct);
  const [inflationPct, setInflationPct] = useState(
    ((defaults.inflationRate ?? FI_RETURN_DEFAULTS.inflationRate) * 100).toFixed(1),
  );
  const [downsidePct, setDownsidePct] = useState(
    ((defaults.downsideReduction ?? FI_RETURN_DEFAULTS.downsideReduction) * 100).toFixed(1),
  );
  const historicalReal =
    derived?.realizedAnnualReturn !== null &&
    derived?.realizedAnnualReturn !== undefined &&
    inflationPct !== ""
      ? nominalToRealReturn(derived.realizedAnnualReturn, Number(inflationPct) / 100)
      : null;

  return (
    <form ref={formRef} action={action} className="goals-form">
      <div className="goals-field-wide fi-input-label">
        <label htmlFor={`${fieldId}-returnMode`}>Return assumptions</label>
        <select
          className="daybreak-field"
          id={`${fieldId}-returnMode`}
          name="returnMode"
          value={returnMode}
          onChange={(e) => setReturnMode(e.target.value === "portfolio" ? "portfolio" : "manual")}
        >
          <option value="portfolio">Portfolio planning assumptions</option>
          <option value="manual">Manual real return (net of fees)</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${fieldId}-annualSpend`} className={labelCls}>
          Annual spend
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="annualSpend"
            id={`${fieldId}-annualSpend`}
            min="0"
            step="100"
            value={annualSpend}
            onChange={(event) => setAnnualSpend(event.target.value)}
            required
            className={inputBase}
          />
          <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            {currency}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${fieldId}-withdrawalRate`} className={labelCls}>
          Withdrawal rate
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="withdrawalRate"
            id={`${fieldId}-withdrawalRate`}
            min="0.5"
            max="25"
            step="0.1"
            value={withdrawalPct}
            onChange={(event) => setWithdrawalPct(event.target.value)}
            className={inputBase}
          />
          <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            % / yr
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1" hidden={returnMode !== "manual"}>
        <label htmlFor={`${fieldId}-realReturn`} className={labelCls}>
          Base real return (after inflation)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="realReturn"
            id={`${fieldId}-realReturn`}
            min="-20"
            max="30"
            step="0.1"
            value={realReturnPct}
            required
            onChange={(e) => setRealReturnPct(e.target.value)}
            className={inputBase}
          />
          <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            % / yr
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1" hidden={returnMode !== "manual"}>
        <label htmlFor={`${fieldId}-downsideReduction`} className={labelCls}>
          Downside / upside sensitivity
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="downsideReduction"
            id={`${fieldId}-downsideReduction`}
            min="0.1"
            max="20"
            step="0.1"
            required
            value={downsidePct}
            onChange={(event) => setDownsidePct(event.target.value)}
            className={inputBase}
          />
          <span className={labelCls}>pp / yr</span>
        </div>
      </div>
      <div className="goals-field-wide flex flex-col gap-1">
        <label htmlFor={`${fieldId}-inflationRate`} className={labelCls}>
          Assumed annual inflation
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="inflationRate"
            id={`${fieldId}-inflationRate`}
            min="0"
            max="20"
            step="0.1"
            required
            value={inflationPct}
            onChange={(event) => setInflationPct(event.target.value)}
            className={inputBase}
          />
          <span className={labelCls}>% / yr</span>
        </div>
        {historicalReal !== null && (
          <p className="fi-chart-note">
            {(derived!.realizedAnnualReturn! * 100).toFixed(1)}% nominal →{" "}
            {(historicalReal * 100).toFixed(1)}% real · Retrospective only
          </p>
        )}
      </div>
      <div className="goals-field-wide flex flex-col gap-1">
        <label className="goals-account-option">
          <input
            type="checkbox"
            role="switch"
            name="useManualContribution"
            value="true"
            checked={manualContribution}
            aria-checked={manualContribution}
            onChange={(event) => setManualContribution(event.target.checked)}
          />
          <span>Manual contribution override</span>
        </label>
        <p className="fi-chart-note">
          12-month average, including employer matches.
          {derived?.trailingContributions && (
            <>
              {" "}
              {derived.trailingContributions.monthsObserved}/12 months recorded (
              {fmtMonthYear(derived.trailingContributions.windowStart)}–
              {fmtMonthYear(derived.trailingContributions.windowEnd)}).
            </>
          )}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        {manualContribution ? (
          <>
            <label htmlFor={`${fieldId}-monthlyContribution`} className={labelCls}>
              Monthly contribution
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="monthlyContribution"
                id={`${fieldId}-monthlyContribution`}
                min="0"
                step="0.01"
                required
                value={contribution}
                onChange={(e) => setContribution(e.target.value)}
                className={inputBase}
              />
              <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                {currency}
              </span>
            </div>
          </>
        ) : (
          <>
            <input type="hidden" name="monthlyContribution" value={contribution} />
            <span className={labelCls}>Automatic monthly contribution</span>
            <p className="text-sm tabular-nums">
              {derived?.trailingContributions.average !== null &&
              derived?.trailingContributions.average !== undefined
                ? `${derived.trailingContributions.average.toLocaleString("en", { maximumFractionDigits: 2 })} ${currency} / mo`
                : "No recent contributions"}
            </p>
          </>
        )}
      </div>
      <FiPlanFields view={view} birthDate={birthDate} portfolio={returnMode === "portfolio"} />
      <div className="goals-form-footer">
        {state ? (
          <p
            role="status"
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
          {pending ? "Saving…" : "Save FI target"}
        </button>
      </div>
    </form>
  );
}

export function NewGoalForm({
  currency,
  accounts,
  onSuccess,
}: {
  currency: string;
  accounts: AccountOption[];
  onSuccess?: () => void;
}) {
  const fieldId = useId();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createGoal, null);
  const allowReset = useRef(false);
  const formRef = usePreservedForm(allowReset);
  const [values, setValues] = useState(EMPTY_GOAL_FIELDS);
  const [kind, setKind] = useState<string>("savings_milestone");
  const [linkMode, setLinkMode] = useState<"manual" | "accounts" | "class">("manual");
  const [linkClass, setLinkClass] = useState<string>("");

  // Form reset handler — runs at form submit success via the onReset hook
  // surfaced from useActionState's resolved state. Avoids setState-in-effect.
  const handleReset = () => {
    setKind("savings_milestone");
    setLinkMode("manual");
    setLinkClass("");
    setValues(EMPTY_GOAL_FIELDS);
  };
  useEffect(() => {
    if (state?.ok) {
      allowReset.current = true;
      formRef.current?.reset();
      allowReset.current = false;
      onSuccess?.();
    }
  }, [state, onSuccess, formRef]);

  // Sensible link defaults per kind, applied in the kind-select onChange.
  const onKindChange = (next: string) => {
    setKind(next);
    if (next === "emergency_fund") {
      setLinkMode("class");
      setLinkClass("cash");
    } else if (next === "debt_payoff") {
      setLinkMode("class");
      setLinkClass("debt");
    } else if (next === "savings_rate_target") {
      setLinkMode("manual");
      setLinkClass("");
    }
  };

  const isRate = kind === "savings_rate_target";

  return (
    <form
      ref={formRef}
      action={action}
      onReset={(event) => {
        if (!allowReset.current) event.preventDefault();
        else handleReset();
      }}
      className="goals-form"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`${fieldId}-kind`} className={labelCls}>
          Goal type
        </label>
        <select
          name="kind"
          id={`${fieldId}-kind`}
          value={kind}
          onChange={(e) => onKindChange(e.target.value)}
          className={inputBase}
        >
          {GOAL_KINDS_USER.map((k) => (
            <option key={k} value={k}>
              {titleCaseKind(k)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${fieldId}-title`} className={labelCls}>
          Name
        </label>
        <input
          name="title"
          id={`${fieldId}-title`}
          required
          maxLength={80}
          className={inputBase}
          value={values.title}
          onChange={(event) => setValues({ ...values, title: event.target.value })}
        />
      </div>

      {isRate ? (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${fieldId}-targetRate`} className={labelCls}>
              Target savings rate
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="targetRate"
                value={values.targetRate}
                onChange={(event) => setValues({ ...values, targetRate: event.target.value })}
                id={`${fieldId}-targetRate`}
                min="1"
                max="80"
                step="0.5"
                required
                className={inputBase}
              />
              <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                %
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${fieldId}-rateWindow`} className={labelCls}>
              Measured over
            </label>
            <select
              name="rateWindow"
              id={`${fieldId}-rateWindow`}
              value={values.rateWindow}
              onChange={(event) => setValues({ ...values, rateWindow: event.target.value })}
              className={inputBase}
            >
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">12 months</option>
              <option value="24">24 months</option>
            </select>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${fieldId}-targetAmount`} className={labelCls}>
              Target amount
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="targetAmount"
                value={values.targetAmount}
                onChange={(event) => setValues({ ...values, targetAmount: event.target.value })}
                id={`${fieldId}-targetAmount`}
                min="0"
                step="100"
                required
                className={inputBase}
              />
              <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                {currency}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${fieldId}-linkMode`} className={labelCls}>
              Track progress from
            </label>
            <select
              name="linkMode"
              id={`${fieldId}-linkMode`}
              value={linkMode}
              onChange={(e) => setLinkMode(e.target.value as typeof linkMode)}
              className={inputBase}
            >
              <option value="manual">Manual entry</option>
              <option value="accounts">Specific accounts</option>
              <option value="class">Account class</option>
            </select>
          </div>

          {linkMode === "manual" ? (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${fieldId}-currentProgress`} className={labelCls}>
                Current amount
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="currentProgress"
                  value={values.currentProgress}
                  onChange={(event) =>
                    setValues({ ...values, currentProgress: event.target.value })
                  }
                  id={`${fieldId}-currentProgress`}
                  min="0"
                  step="100"
                  className={inputBase}
                />
                <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                  {currency}
                </span>
              </div>
            </div>
          ) : null}

          {linkMode === "accounts" ? <AccountSelection accounts={accounts} /> : null}

          {linkMode === "class" ? (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${fieldId}-linkedClass`} className={labelCls}>
                Account class
              </label>
              <select
                name="linkedClass"
                id={`${fieldId}-linkedClass`}
                value={linkClass}
                onChange={(e) => setLinkClass(e.target.value)}
                className={inputBase}
              >
                <option value="">None</option>
                {LINKABLE_CLASSES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {kind === "debt_payoff" ? <input type="hidden" name="invert" value="true" /> : null}
        </>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${fieldId}-targetDate`} className={labelCls}>
          Target date (optional)
        </label>
        <input
          type="date"
          name="targetDate"
          id={`${fieldId}-targetDate`}
          className={inputBase}
          value={values.targetDate}
          onChange={(event) => setValues({ ...values, targetDate: event.target.value })}
        />
      </div>
      <div className="goals-form-footer">
        {state ? (
          <p
            role="status"
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

export function GoalLinksForm({
  goalId,
  initial,
  accounts,
  onSuccess,
}: {
  goalId: string;
  initial: {
    linkMode: "manual" | "accounts" | "class";
    linkedAccountIds: string[];
    linkedClass: string | null;
    invert: boolean;
  };
  accounts: AccountOption[];
  onSuccess?: () => void;
}) {
  const fieldId = useId();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    setGoalLinks,
    null,
  );
  const [linkMode, setLinkMode] = useState(initial.linkMode);
  const formRef = usePreservedForm();
  const [linkClass, setLinkClass] = useState(initial.linkedClass ?? "");
  const [invert, setInvert] = useState(initial.invert ? "true" : "false");
  useEffect(() => {
    if (state?.ok) onSuccess?.();
  }, [state, onSuccess]);

  return (
    <form ref={formRef} action={action} className="goals-form">
      <input type="hidden" name="id" value={goalId} />
      <div className="flex flex-col gap-1">
        <label htmlFor={`${fieldId}-linkMode`} className={labelCls}>
          Track progress from
        </label>
        <select
          name="linkMode"
          id={`${fieldId}-linkMode`}
          value={linkMode}
          onChange={(e) => setLinkMode(e.target.value as typeof linkMode)}
          className={inputBase}
        >
          <option value="manual">Manual entry</option>
          <option value="accounts">Specific accounts</option>
          <option value="class">Account class</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${fieldId}-invert`} className={labelCls}>
          Progress measures
        </label>
        <select
          name="invert"
          id={`${fieldId}-invert`}
          value={invert}
          onChange={(event) => setInvert(event.target.value)}
          className={inputBase}
        >
          <option value="false">Current balance</option>
          <option value="true">Debt paid down</option>
        </select>
      </div>

      {linkMode === "accounts" ? (
        <AccountSelection accounts={accounts} selected={initial.linkedAccountIds} />
      ) : null}

      {linkMode === "class" ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${fieldId}-linkedClass`} className={labelCls}>
            Account class
          </label>
          <select
            name="linkedClass"
            id={`${fieldId}-linkedClass`}
            value={linkClass}
            onChange={(event) => setLinkClass(event.target.value)}
            className={inputBase}
          >
            <option value="">Pick…</option>
            {LINKABLE_CLASSES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="goals-form-footer">
        {state ? (
          <p
            role="status"
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
          {pending ? "Saving…" : "Save links"}
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
  const fieldId = useId();
  const [progress, setProgress] = useState(String(currentProgress));
  const formRef = usePreservedForm();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateGoalProgress,
    null,
  );
  return (
    <form ref={formRef} action={action} className="goals-progress-form">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={fieldId} className="sr-only">
        Current amount ({currency})
      </label>
      <input
        type="number"
        name="currentProgress"
        id={fieldId}
        min="0"
        step="100"
        value={progress}
        onChange={(event) => setProgress(event.target.value)}
        className="daybreak-field min-h-11 w-32 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-2 text-sm tabular-nums focus:border-[color:var(--color-foreground)]"
      />
      <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {currency}
      </span>
      <button
        type="submit"
        disabled={pending}
        className="daybreak-button inline-flex min-h-11 items-center border border-[color:var(--color-border)] px-3 font-sans text-xs tracking-normal hover:bg-[color:var(--color-surface-muted,transparent)] disabled:opacity-50"
      >
        {pending ? "…" : "Update"}
      </button>
      {state?.ok === false ? (
        <span role="alert" className="text-xs text-[color:var(--color-accent-warning,#9a3412)]">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function AccountSelection({
  accounts,
  selected = [],
}: {
  accounts: AccountOption[];
  selected?: string[];
}) {
  const [selection, setSelection] = useState(selected);
  return (
    <fieldset className="goals-field-wide goals-account-selection">
      <legend className={labelCls}>Linked accounts</legend>
      {accounts.length ? (
        accounts.map((account) => (
          <label key={account.id} className="goals-account-option">
            <input
              type="checkbox"
              name="linkedAccountIds"
              value={account.id}
              checked={selection.includes(account.id)}
              onChange={(event) => {
                const checked = event.target.checked;
                setSelection((prior) =>
                  checked ? [...prior, account.id] : prior.filter((id) => id !== account.id),
                );
              }}
            />
            <span>
              {account.name}
              <small>{account.type.replace(/_/g, " ")}</small>
            </span>
          </label>
        ))
      ) : (
        <p>Add an account first, or choose manual entry.</p>
      )}
    </fieldset>
  );
}
