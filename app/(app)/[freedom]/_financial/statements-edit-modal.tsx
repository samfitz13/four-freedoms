"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { acceptsContribution, acceptsEmployerMatch } from "@/lib/freedoms/account-subtypes";
import type { AccountType } from "@/lib/freedoms/types";
import { saveMonthStatements } from "./statements-actions";
import type { ActionResult, EditableRow } from "./types";

const inputBase =
  "daybreak-field min-h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-2 text-right text-sm tabular-nums focus:border-[color:var(--color-foreground)]";

export function StatementsEditLauncher({
  month,
  monthLabel,
  rows,
  savingsRateGoal,
}: {
  month: string;
  monthLabel: string;
  rows: EditableRow[];
  savingsRateGoal: number | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="daybreak-button inline-flex min-h-11 items-center border border-[color:var(--color-border)] px-3 font-sans text-xs tracking-normal hover:bg-[color:var(--color-foreground)] hover:text-[color:var(--color-paper)]"
      >
        Edit month
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Edit ${monthLabel}`}
        size="lg"
        description="Per-account ending balance + contributions for the month. Leave a row blank to skip it; gain is computed from the prior month's ending balance."
      >
        <EditForm
          month={month}
          rows={rows}
          savingsRateGoal={savingsRateGoal}
          onClose={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function EditForm({
  month,
  rows,
  savingsRateGoal,
  onClose,
}: {
  month: string;
  rows: EditableRow[];
  savingsRateGoal: number | null;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveMonthStatements,
    null,
  );
  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  // Only render the Match column when at least one row in this modal is
  // employer-sponsored — otherwise it's just a column of dashes.
  const anyMatchEligible = rows.some((r) => acceptsEmployerMatch(r.type as AccountType, r.subtype));

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="month" value={month} />

      <div className="-mx-2 max-h-[55vh] overflow-y-auto px-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
              <th className="py-2 text-left">Account</th>
              <th className="py-2 text-right">Ending balance</th>
              <th className="py-2 text-right">Contribution</th>
              {anyMatchEligible ? <th className="py-2 text-right">Match</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const type = r.type as AccountType;
              const showMatch = acceptsEmployerMatch(type, r.subtype);
              const showContribution = acceptsContribution(type);
              const ctbLabel = r.isDerived
                ? "Derived"
                : r.klass === "debt"
                  ? "Principal"
                  : showMatch
                    ? "Employee"
                    : "Contribution";
              return (
                <tr
                  key={r.accountId}
                  className="border-t border-dashed border-[color:var(--color-border)]"
                >
                  <td className="py-2 pr-3">
                    <div className="flex flex-col">
                      <span className="font-display">{r.accountName}</span>
                      <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                        {r.klass} · {ctbLabel}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pl-3">
                    {r.isDerived ? (
                      <div className="flex flex-col items-end">
                        <span className="tabular-nums">{r.endingBalance.toFixed(2)}</span>
                        <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
                          ISO model
                        </span>
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        name={`bal[${r.accountId}]`}
                        defaultValue={r.endingBalance.toFixed(2)}
                        className={inputBase}
                      />
                    )}
                  </td>
                  <td className="py-2 pl-3">
                    {showContribution ? (
                      <input
                        type="number"
                        step="0.01"
                        name={`ctb[${r.accountId}]`}
                        defaultValue={r.employeeContribution.toFixed(2)}
                        className={inputBase}
                      />
                    ) : (
                      <span className="block text-right text-[color:var(--color-ink-soft)]">—</span>
                    )}
                  </td>
                  {anyMatchEligible ? (
                    <td className="py-2 pl-3">
                      {showMatch ? (
                        <input
                          type="number"
                          step="0.01"
                          name={`match[${r.accountId}]`}
                          defaultValue={r.employerMatch.toFixed(2)}
                          className={inputBase}
                        />
                      ) : (
                        <span className="block text-right text-[color:var(--color-ink-soft)]">
                          —
                        </span>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--color-border)] pt-4">
        <label className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          Savings rate goal
        </label>
        <div className="flex items-baseline gap-2">
          <input
            type="number"
            step="0.1"
            min={0}
            max={100}
            name="savingsRateGoal"
            defaultValue={savingsRateGoal !== null ? (savingsRateGoal * 100).toFixed(1) : ""}
            placeholder="e.g. 30"
            className="daybreak-field min-h-11 w-24 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-2 text-right text-sm tabular-nums focus:border-[color:var(--color-foreground)]"
          />
          <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            %
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {state?.ok === false ? (
            <span className="text-sm text-[color:var(--color-accent-warning,#9a3412)]">
              {state.error}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="daybreak-button inline-flex min-h-11 items-center border border-[color:var(--color-border)] px-3 font-sans text-xs tracking-normal hover:bg-[color:var(--color-surface-muted,transparent)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="daybreak-button inline-flex min-h-11 items-center bg-[color:var(--glass-primary)] px-4 text-sm text-[color:var(--glass-primary-ink)] hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save month"}
          </button>
        </div>
      </div>
    </form>
  );
}
