"use client";

import { useActionState } from "react";
import { importCsv } from "./actions";
import type { ImportAccountOption, ImportResult } from "./types";

const inputBase =
  "daybreak-field min-h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-3 text-sm focus:border-[color:var(--color-foreground)]";
const labelCls = "font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]";

export function ImportForm({
  accounts,
  defaultAccountId = "",
}: {
  accounts: ImportAccountOption[];
  defaultAccountId?: string;
}) {
  const [state, action, pending] = useActionState<ImportResult | null, FormData>(importCsv, null);

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="daybreak-panel grid gap-4 border-dashed p-6 sm:grid-cols-6">
        <input type="hidden" name="kind" value="transactions" />

        <div className="flex flex-col gap-1 sm:col-span-3">
          <label className={labelCls} htmlFor="import-account">
            Account
          </label>
          <select
            id="import-account"
            name="accountId"
            defaultValue={defaultAccountId}
            className={inputBase}
          >
            <option value="">— No specific account —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.type.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 sm:col-span-3">
          <label className={labelCls} htmlFor="import-file">
            CSV file
          </label>
          <input
            id="import-file"
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="daybreak-field file: min-h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-3 text-sm file:mr-3 file:border-0 file:bg-[color:var(--glass-control)] file:font-sans file:text-xs file:tracking-normal"
          />
        </div>

        <div className="flex items-center gap-3 sm:col-span-6">
          <p className="mr-auto text-xs text-[color:var(--color-ink-soft)]">
            Transaction rows will be attached to the selected account. Bank exports with a summary
            preamble (Bank of America, Chase, Wells Fargo) work as-is.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="daybreak-button inline-flex min-h-11 items-center bg-[color:var(--glass-primary)] px-5 text-sm text-[color:var(--glass-primary-ink)] hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Importing…" : "Import"}
          </button>
        </div>
      </form>

      {state ? <ResultPanel result={state} /> : null}
    </div>
  );
}

function ResultPanel({ result }: { result: ImportResult }) {
  if (!result.ok) {
    return (
      <div className="daybreak-panel border-[color:var(--color-accent-warning,#9a3412)] bg-[color:var(--color-accent-warning-bg,transparent)] p-6">
        <p className="text-sm text-[color:var(--color-accent-warning,#9a3412)]">{result.error}</p>
      </div>
    );
  }
  return (
    <div className="daybreak-panel flex flex-col gap-3 p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg">Result</h3>
        <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          {result.kind}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-6 text-sm">
        <div>
          <dt className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            Inserted
          </dt>
          <dd className="font-display text-2xl tabular-nums">{result.inserted}</dd>
        </div>
        <div>
          <dt className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            Skipped
          </dt>
          <dd className="font-display text-2xl tabular-nums">{result.skipped}</dd>
        </div>
        <div>
          <dt className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
            Errors
          </dt>
          <dd className="font-display text-2xl tabular-nums">{result.errors.length}</dd>
        </div>
      </dl>
      {result.errors.length > 0 ? (
        <details>
          <summary className="cursor-pointer font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] select-none hover:text-[color:var(--color-foreground)]">
            View errors ({result.errors.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {result.errors.map((e, i) => (
              <li
                key={i}
                className="flex items-baseline gap-3 font-sans text-xs text-[color:var(--color-ink-soft)]"
              >
                <span className="tabular-nums">row {e.row}</span>
                <span className="text-[color:var(--color-accent-warning,#9a3412)]">
                  {e.message}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
