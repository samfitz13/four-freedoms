"use client";

import { useActionState } from "react";
import { importCsv } from "./actions";
import type { ImportResult } from "./types";

const inputBase =
  "h-10 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-3 text-sm focus:border-[color:var(--color-foreground)] focus:outline-none";
const labelCls =
  "font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportResult | null, FormData>(importCsv, null);

  return (
    <div className="flex flex-col gap-6">
      <form
        action={action}
        encType="multipart/form-data"
        className="grid gap-4 border border-dashed border-[color:var(--color-border)] p-5 sm:grid-cols-4"
      >
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className={labelCls} htmlFor="import-kind">
            Format
          </label>
          <select id="import-kind" name="kind" defaultValue="transactions" className={inputBase}>
            <option value="transactions">Transactions</option>
            <option value="accounts">Accounts snapshot</option>
            <option value="holdings">Holdings</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className={labelCls} htmlFor="import-file">
            CSV file
          </label>
          <input
            id="import-file"
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="h-10 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-transparent px-3 text-sm file:mr-3 file:border-0 file:bg-transparent file:font-mono file:text-xs file:tracking-[0.14em] file:uppercase"
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-4">
          <p className="mr-auto text-xs text-[color:var(--color-ink-soft)]">
            Max 2MB / 5,000 rows per upload. Unknown accounts and categories are auto-created.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-[color:var(--color-foreground)] px-5 text-sm text-[color:var(--color-background)] hover:opacity-90 disabled:opacity-50"
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
      <div className="border border-[color:var(--color-accent-warning,#9a3412)] bg-[color:var(--color-accent-warning-bg,transparent)] p-4">
        <p className="text-sm text-[color:var(--color-accent-warning,#9a3412)]">{result.error}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 border border-[color:var(--color-border)] p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-lg">Result</h3>
        <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
          {result.kind}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-6 text-sm">
        <div>
          <dt className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
            Inserted
          </dt>
          <dd className="font-serif text-2xl tabular-nums">{result.inserted}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
            Skipped
          </dt>
          <dd className="font-serif text-2xl tabular-nums">{result.skipped}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase">
            Errors
          </dt>
          <dd className="font-serif text-2xl tabular-nums">{result.errors.length}</dd>
        </div>
      </dl>
      {result.errors.length > 0 ? (
        <details>
          <summary className="cursor-pointer font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-soft)] uppercase select-none hover:text-[color:var(--color-foreground)]">
            View errors ({result.errors.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {result.errors.map((e, i) => (
              <li
                key={i}
                className="flex items-baseline gap-3 font-mono text-xs text-[color:var(--color-ink-soft)]"
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
