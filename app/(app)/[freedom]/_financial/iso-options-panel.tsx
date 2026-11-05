"use client";

import { useActionState, useState } from "react";
import { Money } from "@/components/freedoms/money";
import { Modal } from "@/components/ui/modal";
import type { IsoOptionAccountSummary } from "@/lib/db/queries/types";
import {
  addIsoOptionExercise,
  addIsoOptionGrant,
  addIsoOptionValuation,
  deleteIsoOptionGrant,
  updateIsoOptionAccountDetails,
  updateIsoOptionGrant,
} from "./accounts-actions";
import type { ActionResult } from "./types";

const inputBase =
  "daybreak-field min-h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-2 text-sm focus:border-[color:var(--color-foreground)]";
const labelCls = "font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]";
const textButtonCls =
  "font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)] disabled:opacity-50";
const solidButtonCls =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 font-sans text-xs tracking-normal hover:bg-[color:var(--color-surface-muted,transparent)] disabled:opacity-50";
type IsoActionMode = "grant" | "valuation" | "exercise";

export function IsoOptionsLauncher({
  accountName,
  accountId,
  currency,
  summary,
}: {
  accountName: string;
  accountId: string;
  currency: string;
  summary?: IsoOptionAccountSummary;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={textButtonCls}>
        ISO values
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${accountName} ISO values`}
        size="xl"
        description="A quiet ledger for grants, valuations, exercises, and post-employment deadlines."
      >
        <IsoOptionsPanel
          accountId={accountId}
          accountName={accountName}
          currency={currency}
          summary={summary}
        />
      </Modal>
    </>
  );
}

export function IsoOptionsPanel({
  accountId,
  accountName,
  currency,
  summary,
}: {
  accountId: string;
  accountName: string;
  currency: string;
  summary?: IsoOptionAccountSummary;
}) {
  const grants = summary?.grants ?? [];
  const valuations = summary?.valuations ?? [];
  const [actionMode, setActionMode] = useState<IsoActionMode>(
    grants.length === 0 ? "grant" : "exercise",
  );
  const forfeitedShares = grants.reduce((sum, grant) => sum + grant.forfeitedShares, 0);
  return (
    <section className="flex max-h-[74vh] flex-col gap-6 overflow-y-auto pr-1">
      <div className="grid gap-6 border-b border-[color:var(--color-border)] pb-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex flex-col gap-4">
          <AccountDetailsForm accountId={accountId} accountName={accountName} summary={summary} />
          <div className="grid gap-4 sm:grid-cols-5">
            <IsoStat label="Value">
              <Money value={summary?.totalValue ?? 0} currency={currency} fractionDigits={0} />
            </IsoStat>
            <IsoStat label="Vested">{summary?.vestedShares.toLocaleString() ?? "0"}</IsoStat>
            <IsoStat label="Exercisable">
              {summary?.exercisableShares.toLocaleString() ?? "0"}
            </IsoStat>
            <IsoStat label="Owned vested">
              {summary?.ownedVestedShares.toLocaleString() ?? "0"}
            </IsoStat>
            <IsoStat label={forfeitedShares > 0 ? "Forfeited" : "Unvested"}>
              {(forfeitedShares > 0
                ? forfeitedShares
                : (summary?.unvestedShares ?? 0)
              ).toLocaleString()}
            </IsoStat>
          </div>
        </div>
        <ActionChooser mode={actionMode} onChange={setActionMode} grantCount={grants.length} />
      </div>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 className="font-display text-xl tracking-tight">Grants</h3>
              <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                Per-grant vesting lives here. Employer terms live once, above.
              </p>
            </div>
            {grants.length > 0 ? (
              <button
                type="button"
                onClick={() => setActionMode("grant")}
                className={textButtonCls}
              >
                Add grant
              </button>
            ) : null}
          </div>
          {grants.length > 0 ? (
            <div className="flex flex-col divide-y divide-[color:var(--color-border)] border-y border-[color:var(--color-border)]">
              {grants.map((grant) => (
                <GrantRow key={grant.id} grant={grant} summary={summary} currency={currency} />
              ))}
            </div>
          ) : (
            <div className="border-y border-[color:var(--color-border)] py-8">
              <p className="max-w-md text-sm text-[color:var(--color-ink-soft)]">
                Start with the grant paperwork: shares, strike, grant date, vesting start, and
                schedule.
              </p>
              <button
                type="button"
                onClick={() => setActionMode("grant")}
                className={`${solidButtonCls} mt-4`}
              >
                Add first grant
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {actionMode === "grant" ? <GrantCreateForm accountId={accountId} /> : null}
          {actionMode === "valuation" ? <ValuationForm accountId={accountId} /> : null}
          {actionMode === "exercise" ? <ExerciseForm grants={grants} /> : null}
          {valuations.length > 0 ? (
            <ValuationList valuations={valuations} currency={currency} />
          ) : null}
        </div>
      </section>
    </section>
  );
}

function AccountDetailsForm({
  accountId,
  accountName,
  summary,
}: {
  accountId: string;
  accountName: string;
  summary?: IsoOptionAccountSummary;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateIsoOptionAccountDetails,
    null,
  );
  const relationship = summary?.employerRelationship ?? "current";
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className={labelCls}>Employer terms</span>
          <span className="font-display text-xl tracking-tight">
            {summary?.employerName ?? accountName}
          </span>
          <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
            {relationship === "former" ? "Former employer" : "Current employer"}
            {relationship === "former" && summary?.employmentEndDate
              ? ` · last day ${summary.employmentEndDate}`
              : ""}
            {summary?.postTerminationExerciseDeadline
              ? ` · exercise by ${summary.postTerminationExerciseDeadline}`
              : ""}
          </span>
        </div>
        <span className={`${textButtonCls} pt-1 group-open:hidden`}>Edit terms</span>
        <span className={`${textButtonCls} hidden pt-1 group-open:inline`}>Close terms</span>
      </summary>
      <form
        action={action}
        className="mt-4 grid gap-3 border-t border-dashed border-[color:var(--color-border)] pt-4 md:grid-cols-[minmax(0,1fr)_11rem_10rem_9rem_auto]"
      >
        <input type="hidden" name="accountId" value={accountId} />
        <Field
          name="employerName"
          label="Employer"
          defaultValue={summary?.employerName ?? accountName}
          required
        />
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Relationship</span>
          <select name="employerRelationship" defaultValue={relationship} className={inputBase}>
            <option value="current">Current</option>
            <option value="former">Former</option>
          </select>
        </label>
        <Field
          name="employmentEndDate"
          label="Last day"
          type="date"
          defaultValue={summary?.employmentEndDate ?? ""}
        />
        <Field
          name="postTerminationExerciseDays"
          label="Window days"
          type="number"
          defaultValue={String(summary?.postTerminationExerciseDays ?? 90)}
          required
        />
        <button type="submit" disabled={pending} className={solidButtonCls}>
          {pending ? "Saving…" : "Save"}
        </button>
        <div className="md:col-span-5">
          <FormState state={state} />
        </div>
      </form>
    </details>
  );
}

function ActionChooser({
  mode,
  onChange,
  grantCount,
}: {
  mode: IsoActionMode;
  onChange: (mode: IsoActionMode) => void;
  grantCount: number;
}) {
  return (
    <aside className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
      <div className="flex flex-col gap-1">
        <span className={labelCls}>Next entry</span>
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          Choose one action. The form appears below, not all at once.
        </p>
      </div>
      <div className="grid gap-2">
        <ActionButton active={mode === "grant"} onClick={() => onChange("grant")}>
          Add grant
        </ActionButton>
        <ActionButton active={mode === "valuation"} onClick={() => onChange("valuation")}>
          Add valuation
        </ActionButton>
        <ActionButton
          active={mode === "exercise"}
          disabled={grantCount === 0}
          onClick={() => onChange("exercise")}
        >
          Record exercise
        </ActionButton>
      </div>
    </aside>
  );
}

function ActionButton({
  active,
  disabled = false,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`daybreak-button flex min-h-11 items-center justify-between px-3 text-xs disabled:opacity-40 ${
        active
          ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
          : "text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
      }`}
    >
      {children}
      <span aria-hidden>{active ? "—" : "+"}</span>
    </button>
  );
}

function GrantRow({
  grant,
  summary,
  currency,
}: {
  grant: IsoOptionAccountSummary["grants"][number];
  summary?: IsoOptionAccountSummary;
  currency: string;
}) {
  return (
    <article className="grid gap-4 py-4 text-sm lg:grid-cols-[minmax(0,1fr)_14rem]">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-col">
            <span className="font-display text-lg tracking-tight">{grant.label}</span>
            <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              {summary?.employerName ?? "Employer"} · {summary?.employerRelationship ?? "current"}
            </span>
          </div>
          <span className="font-display text-lg tabular-nums">
            <Money value={grant.totalValue} currency={currency} fractionDigits={0} />
          </span>
        </div>
        <dl className="grid gap-2 sm:grid-cols-6">
          <MiniKv label="Shares" value={grant.totalShares.toLocaleString()} />
          <MiniKv label="Vested" value={grant.vestedShares.toLocaleString()} />
          <MiniKv label="Exercisable" value={grant.exercisableShares.toLocaleString()} />
          <MiniKv label="Owned vested" value={grant.ownedVestedShares.toLocaleString()} />
          <MiniKv
            label={grant.forfeitedShares > 0 ? "Forfeited" : "Unvested"}
            value={(grant.forfeitedShares > 0
              ? grant.forfeitedShares
              : grant.unvestedShares
            ).toLocaleString()}
          />
          <MiniKv
            label="Strike"
            value={<Money value={grant.strikePrice} currency={currency} fractionDigits={2} />}
          />
        </dl>
        <dl className="grid gap-2 sm:grid-cols-4">
          <MiniKv label="Owned unvested" value={grant.ownedUnvestedShares.toLocaleString()} />
          <MiniKv
            label="Owned value"
            value={
              <Money value={grant.exercisedShareValue} currency={currency} fractionDigits={0} />
            }
          />
          <MiniKv
            label="Exercise cost"
            value={<Money value={grant.exerciseCost} currency={currency} fractionDigits={0} />}
          />
          <MiniKv
            label="Option spread"
            value={
              <Money value={grant.optionIntrinsicValue} currency={currency} fractionDigits={0} />
            }
          />
        </dl>
        <dl className="grid gap-2 sm:grid-cols-1">
          <MiniKv
            label="Share price"
            value={
              <Money
                value={summary?.latestSharePrice ?? summary?.latestFmv ?? null}
                currency={currency}
                fractionDigits={2}
              />
            }
          />
        </dl>
        <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
          Vesting starts {grant.vestingStartDate ?? "—"} · {grant.vestingSchedule.type} ·{" "}
          {grant.vestingSchedule.durationMonths} months · {grant.vestingSchedule.cliffMonths} month
          cliff
        </p>
        {summary?.employerRelationship === "former" ? (
          <p className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] tabular-nums">
            Last day {summary.employmentEndDate ?? "—"} · exercise window{" "}
            {summary.postTerminationExerciseDays} days
            {summary.postTerminationExerciseDeadline
              ? ` · deadline ${summary.postTerminationExerciseDeadline}`
              : ""}
            {grant.isExerciseWindowExpired ? " · expired" : ""}
          </p>
        ) : null}
        {grant.exercises.length > 0 ? (
          <ul className="flex flex-col gap-1 text-xs text-[color:var(--color-ink-soft)]">
            {grant.exercises.map((exercise) => (
              <li key={exercise.id} className="flex justify-between gap-3 tabular-nums">
                <span>
                  {exercise.exerciseDate} · {exercise.shares.toLocaleString()} shares
                </span>
                <span>
                  {exercise.exercisePrice !== null ? (
                    <Money value={exercise.exercisePrice} currency={currency} fractionDigits={2} />
                  ) : (
                    "—"
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <GrantEditForm grant={grant} />
    </article>
  );
}

function GrantCreateForm({ accountId }: { accountId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    addIsoOptionGrant,
    null,
  );
  return (
    <FormPanel title="Add grant" action={action} state={state}>
      <input type="hidden" name="accountId" value={accountId} />
      <GrantFields />
      <Submit pending={pending}>Add grant</Submit>
    </FormPanel>
  );
}

function GrantEditForm({ grant }: { grant: IsoOptionAccountSummary["grants"][number] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateIsoOptionGrant,
    null,
  );
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    deleteIsoOptionGrant,
    null,
  );
  return (
    <details>
      <summary className="cursor-pointer font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] select-none hover:text-[color:var(--color-foreground)]">
        Edit
      </summary>
      <form
        action={action}
        className="mt-3 flex flex-col gap-3 border-l border-dashed border-[color:var(--color-border)] pl-3"
      >
        <input type="hidden" name="id" value={grant.id} />
        <GrantFields grant={grant} />
        <div className="flex flex-wrap gap-2">
          <Submit pending={pending}>Save</Submit>
          <button
            type="submit"
            formAction={deleteAction}
            disabled={deletePending}
            className={solidButtonCls}
          >
            {deletePending ? "Deleting…" : "Delete"}
          </button>
        </div>
        <FormState state={state ?? deleteState} />
      </form>
    </details>
  );
}

function GrantFields({ grant }: { grant?: IsoOptionAccountSummary["grants"][number] }) {
  return (
    <>
      <Field name="label" label="Grant label" defaultValue={grant?.label} required />
      <div className="grid grid-cols-2 gap-2">
        <Field
          name="grantDate"
          label="Grant date"
          type="date"
          defaultValue={grant?.grantDate ?? ""}
        />
        <Field
          name="vestingStartDate"
          label="Vesting start"
          type="date"
          defaultValue={grant?.vestingStartDate ?? ""}
        />
        <Field
          name="expirationDate"
          label="Expiration"
          type="date"
          defaultValue={grant?.expirationDate ?? ""}
        />
        <Field
          name="totalShares"
          label="Shares"
          type="number"
          defaultValue={grant ? String(grant.totalShares) : ""}
          required
        />
        <Field
          name="strikePrice"
          label="Strike"
          type="number"
          step="0.000001"
          defaultValue={grant ? String(grant.strikePrice) : ""}
          required
        />
        <Field
          name="vestingDurationMonths"
          label="Duration mo"
          type="number"
          defaultValue={String(grant?.vestingSchedule.durationMonths ?? 48)}
          required
        />
        <Field
          name="vestingCliffMonths"
          label="Cliff mo"
          type="number"
          defaultValue={String(grant?.vestingSchedule.cliffMonths ?? 12)}
          required
        />
        <label className="flex items-center gap-2 pt-5 text-sm">
          <input
            type="checkbox"
            name="earlyExerciseAllowed"
            defaultChecked={grant?.earlyExerciseAllowed ?? false}
            className="daybreak-field h-4 w-4 accent-[color:var(--color-foreground)]"
          />
          <span className="text-[color:var(--color-ink-soft)]">Early exercise allowed</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Cadence</span>
          <select
            name="vestingType"
            defaultValue={grant?.vestingSchedule.type ?? "monthly"}
            className={inputBase}
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        </label>
      </div>
    </>
  );
}

function ValuationForm({ accountId }: { accountId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    addIsoOptionValuation,
    null,
  );
  return (
    <FormPanel title="Add valuation" action={action} state={state}>
      <input type="hidden" name="accountId" value={accountId} />
      <Field name="asOf" label="As of" type="date" required />
      <div className="grid grid-cols-2 gap-2">
        <Field name="fmv" label="FMV" type="number" step="0.000001" required />
        <Field name="sharePrice" label="Share price" type="number" step="0.000001" />
      </div>
      <Field name="notes" label="Notes" />
      <Submit pending={pending}>Add valuation</Submit>
    </FormPanel>
  );
}

function ExerciseForm({ grants }: { grants: IsoOptionAccountSummary["grants"] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    addIsoOptionExercise,
    null,
  );
  return (
    <FormPanel title="Record exercise" action={action} state={state}>
      <select name="grantId" required disabled={grants.length === 0} className={inputBase}>
        <option value="">{grants.length === 0 ? "Add a grant first" : "Select grant"}</option>
        {grants.map((grant) => (
          <option key={grant.id} value={grant.id}>
            {grant.label}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <Field name="exerciseDate" label="Exercise date" type="date" required />
        <Field name="shares" label="Shares" type="number" required />
        <Field name="exercisePrice" label="Exercise price" type="number" step="0.000001" />
        <Field name="fmvAtExercise" label="FMV at exercise" type="number" step="0.000001" />
      </div>
      <Field name="notes" label="Notes" />
      <Submit pending={pending || grants.length === 0}>Record exercise</Submit>
    </FormPanel>
  );
}

function ValuationList({
  valuations,
  currency,
}: {
  valuations: IsoOptionAccountSummary["valuations"];
  currency: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-[color:var(--color-border)] pt-4">
      <h4 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        Recent valuations
      </h4>
      <ul className="flex flex-col divide-y divide-[color:var(--color-border)] text-sm">
        {valuations.map((valuation) => (
          <li key={valuation.id} className="flex justify-between gap-3 py-2">
            <span className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
              {valuation.asOf}
            </span>
            <span>
              <Money value={valuation.fmv} currency={currency} fractionDigits={2} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FormPanel({
  title,
  action,
  state,
  children,
}: {
  title: string;
  action: (payload: FormData) => void;
  state: ActionResult | null;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4 first:border-t-0 first:pt-0"
    >
      <h4 className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
        {title}
      </h4>
      {children}
      <FormState state={state} />
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  step,
  defaultValue,
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  step?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        required={required}
        className={inputBase}
      />
    </label>
  );
}

function Submit({ pending, children }: { pending: boolean; children: string }) {
  return (
    <button type="submit" disabled={pending} className={solidButtonCls}>
      {pending ? "Saving…" : children}
    </button>
  );
}

function FormState({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p
      className={
        state.ok
          ? "text-xs text-[color:var(--color-ink-soft)]"
          : "text-xs text-[color:var(--color-accent-warning,#9a3412)]"
      }
    >
      {state.ok ? (state.message ?? "Saved.") : state.error}
    </p>
  );
}

function IsoStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-l border-[color:var(--color-border)] pl-3">
      <span className={labelCls}>{label}</span>
      <span className="font-display text-xl tabular-nums">{children}</span>
    </div>
  );
}

function MiniKv({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className={labelCls}>{label}</dt>
      <dd className="font-display text-base tabular-nums">{value}</dd>
    </div>
  );
}
