"use client";

import { useActionState, useEffect, useState } from "react";
import { Money } from "@/components/freedoms/money";
import { Modal } from "@/components/ui/modal";
import { RowMenu, RowMenuItem } from "@/components/ui/row-menu";
import {
  convertToTransfer,
  deleteTransaction,
  unconvertTransfer,
  updateTransaction,
  updateTransfer,
} from "./cashflow-actions";
import type { ActionResult } from "./types";

type Tx = {
  id: string;
  occurredOn: string;
  amount: string | number;
  currency: string;
  description: string | null;
  categoryId: string | null;
  accountId: string | null;
  source: string;
  kind: "cashflow" | "transfer";
  transferGroupId: string | null;
  transferPeerId: string | null;
};

type Account = { id: string; name: string; currency: string; isArchived?: boolean };
type Category = { id: string; name: string; kind: string };

type PeerSide = {
  accountId: string | null;
  accountName: string | null;
};

const inputBase =
  "daybreak-field min-h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--glass-control)] px-3 text-sm focus:border-[color:var(--color-foreground)]";
const labelCls = "font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]";

export function TransactionRow({
  tx,
  accounts,
  categories,
  peer,
}: {
  tx: Tx;
  accounts: Account[];
  categories: Category[];
  peer?: PeerSide | null;
}) {
  const [mode, setMode] = useState<"view" | "details" | "edit" | "confirm-delete">("view");
  const amt = Number(tx.amount);
  const isIncome = amt > 0;
  const isTransfer = tx.kind === "transfer";

  const account = accounts.find((a) => a.id === tx.accountId) ?? null;
  const archived =
    account?.isArchived || accounts.some((a) => a.id === peer?.accountId && a.isArchived);
  const category = categories.find((c) => c.id === tx.categoryId) ?? null;

  const sourceLabel = isTransfer
    ? peer?.accountName
      ? `transfer · ${isIncome ? "from" : "to"} ${peer.accountName}`
      : "transfer"
    : tx.source;

  const amountClass = isTransfer
    ? "text-[color:var(--color-ink-soft)]"
    : isIncome
      ? ""
      : "text-[color:var(--color-accent-warning,#9a3412)]";

  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-4 py-2">
        <span className="font-sans text-xs text-[color:var(--color-ink-soft)] tabular-nums">
          {tx.occurredOn}
        </span>
        <span className="flex-1 text-sm">{tx.description ?? "—"}</span>
        <span className={`tabular-nums ${amountClass}`}>
          {isIncome ? "+" : ""}
          <Money value={amt} currency={tx.currency} fractionDigits={2} />
        </span>
        <span className="font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)]">
          {sourceLabel}
        </span>
        <RowMenu label="Transaction actions">
          {(close) => (
            <>
              <RowMenuItem
                onSelect={() => {
                  setMode((m) => (m === "details" ? "view" : "details"));
                  close();
                }}
              >
                View
              </RowMenuItem>
              {!archived && (
                <RowMenuItem
                  onSelect={() => {
                    setMode("edit");
                    close();
                  }}
                >
                  Edit
                </RowMenuItem>
              )}
              <RowMenuItem
                tone="warning"
                onSelect={() => {
                  setMode("confirm-delete");
                  close();
                }}
              >
                Delete
              </RowMenuItem>
            </>
          )}
        </RowMenu>
      </div>

      <Modal
        open={mode === "details"}
        onClose={() => setMode("view")}
        title={isTransfer ? "Transfer" : "Transaction"}
        description={tx.occurredOn}
      >
        <DetailsPanel
          tx={tx}
          account={account}
          category={category}
          peer={peer ?? null}
          isTransfer={isTransfer}
          isIncome={isIncome}
        />
        <div className="flex justify-end gap-3 border-t border-[color:var(--color-border)] pt-4">
          {!archived && (
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode("view")}
            className="daybreak-button inline-flex min-h-11 items-center bg-[color:var(--glass-primary)] px-4 text-sm text-[color:var(--glass-primary-ink)] hover:opacity-90"
          >
            Done
          </button>
        </div>
      </Modal>

      <Modal
        open={mode === "edit"}
        onClose={() => setMode("view")}
        title={isTransfer ? "Edit transfer" : "Edit transaction"}
        size="lg"
      >
        <EditForm
          tx={tx}
          accounts={accounts.filter((a) => !a.isArchived)}
          categories={categories}
          peer={peer ?? null}
          onDone={() => setMode("view")}
        />
      </Modal>

      {mode === "confirm-delete" ? (
        <ConfirmDelete id={tx.id} onCancel={() => setMode("view")} />
      ) : null}
    </li>
  );
}

function DetailsPanel({
  tx,
  account,
  category,
  peer,
  isTransfer,
  isIncome,
}: {
  tx: Tx;
  account: Account | null;
  category: Category | null;
  peer: PeerSide | null;
  isTransfer: boolean;
  isIncome: boolean;
}) {
  const amt = Number(tx.amount);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <Field
        label="Amount"
        value={
          <span className="font-display text-2xl tabular-nums">
            {amt > 0 ? "+" : ""}
            <Money value={amt} currency={tx.currency} fractionDigits={2} />
          </span>
        }
      />
      <Field label="Description" value={tx.description ?? "—"} />
      <Field label="Account" value={account ? `${account.name} · ${account.currency}` : "—"} />
      {isTransfer ? (
        <Field label={isIncome ? "From" : "To"} value={peer?.accountName ?? "—"} />
      ) : (
        <Field label="Category" value={category ? `${category.name} · ${category.kind}` : "—"} />
      )}
      <Field label="Source" value={isTransfer ? "transfer · manual" : tx.source} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className={`${labelCls} w-24 shrink-0`}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

type EditFlow = "income" | "expense" | "transfer";

function EditForm({
  tx,
  accounts,
  categories,
  peer,
  onDone,
}: {
  tx: Tx;
  accounts: Account[];
  categories: Category[];
  peer: PeerSide | null;
  onDone: () => void;
}) {
  const amt = Number(tx.amount);
  const isTransfer = tx.kind === "transfer";
  const isIncomeSide = amt >= 0;
  const initialFlow: EditFlow = isTransfer ? "transfer" : isIncomeSide ? "income" : "expense";
  const absAmt = Math.abs(amt).toFixed(2);

  // For transfers, "From" is the negative leg, "To" is the positive leg.
  const initialFromId = isTransfer
    ? isIncomeSide
      ? (peer?.accountId ?? "")
      : (tx.accountId ?? "")
    : (tx.accountId ?? "");
  const initialToId = isTransfer
    ? isIncomeSide
      ? (tx.accountId ?? "")
      : (peer?.accountId ?? "")
    : "";

  const [flow, setFlow] = useState<EditFlow>(initialFlow);

  // We dispatch to one of four actions based on (was, now). Pick the right
  // useActionState binding once per render so the form is wired correctly.
  const isNowTransfer = flow === "transfer";
  const action =
    isTransfer && isNowTransfer
      ? "updateTransfer"
      : !isTransfer && isNowTransfer
        ? "convertToTransfer"
        : isTransfer && !isNowTransfer
          ? "unconvertTransfer"
          : "updateTransaction";

  const [updateTxState, updateTxAction, updateTxPending] = useActionState<
    ActionResult | null,
    FormData
  >(updateTransaction, null);
  const [updateTrState, updateTrAction, updateTrPending] = useActionState<
    ActionResult | null,
    FormData
  >(updateTransfer, null);
  const [convertState, convertAction, convertPending] = useActionState<
    ActionResult | null,
    FormData
  >(convertToTransfer, null);
  const [unconvertState, unconvertAction, unconvertPending] = useActionState<
    ActionResult | null,
    FormData
  >(unconvertTransfer, null);

  const formAction =
    action === "updateTransfer"
      ? updateTrAction
      : action === "convertToTransfer"
        ? convertAction
        : action === "unconvertTransfer"
          ? unconvertAction
          : updateTxAction;
  const state =
    action === "updateTransfer"
      ? updateTrState
      : action === "convertToTransfer"
        ? convertState
        : action === "unconvertTransfer"
          ? unconvertState
          : updateTxState;
  const pending =
    action === "updateTransfer"
      ? updateTrPending
      : action === "convertToTransfer"
        ? convertPending
        : action === "unconvertTransfer"
          ? unconvertPending
          : updateTxPending;

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-6">
      <input type="hidden" name="id" value={tx.id} />
      {action === "updateTransfer" && tx.transferGroupId ? (
        <input type="hidden" name="transferGroupId" value={tx.transferGroupId} />
      ) : null}

      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className={labelCls}>Flow</label>
        <select
          name="flow"
          value={flow}
          onChange={(e) => setFlow(e.target.value as EditFlow)}
          className={inputBase}
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer">Transfer</option>
        </select>
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className={labelCls}>Amount</label>
        <input
          type="number"
          step="0.01"
          min="0"
          name="amount"
          defaultValue={absAmt}
          required
          className={inputBase}
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className={labelCls}>Date</label>
        <input
          type="date"
          name="occurredOn"
          defaultValue={tx.occurredOn}
          required
          className={inputBase}
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-6">
        <label className={labelCls}>Description</label>
        <input
          name="description"
          defaultValue={tx.description ?? ""}
          maxLength={200}
          className={inputBase}
        />
      </div>

      {isNowTransfer && action === "convertToTransfer" ? (
        <>
          <div className="flex flex-col gap-1 sm:col-span-3">
            <label className={labelCls}>From account</label>
            <p className="flex h-9 items-center text-sm text-[color:var(--color-ink-soft)]">
              {accounts.find((a) => a.id === tx.accountId)?.name ?? "—"}
            </p>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-3">
            <label className={labelCls}>To account</label>
            <select name="peerAccountId" required className={inputBase} defaultValue="">
              <option value="">Select…</option>
              {accounts
                .filter((a) => a.id !== tx.accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </option>
                ))}
            </select>
          </div>
        </>
      ) : isNowTransfer ? (
        <>
          <div className="flex flex-col gap-1 sm:col-span-3">
            <label className={labelCls}>From account</label>
            <select
              name="fromAccountId"
              defaultValue={initialFromId}
              required
              className={inputBase}
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-3">
            <label className={labelCls}>To account</label>
            <select name="toAccountId" defaultValue={initialToId} required className={inputBase}>
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1 sm:col-span-3">
            <label className={labelCls}>Account</label>
            <select name="accountId" defaultValue={tx.accountId ?? ""} className={inputBase}>
              <option value="">None</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-3">
            <label className={labelCls}>Category</label>
            <select name="categoryId" defaultValue={tx.categoryId ?? ""} className={inputBase}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.kind}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="flex items-center justify-end gap-3 sm:col-span-6">
        {state?.ok === false ? (
          <p className="mr-auto text-sm text-[color:var(--color-accent-warning,#9a3412)]">
            {state.error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onDone}
          className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="daybreak-button inline-flex min-h-11 items-center bg-[color:var(--glass-primary)] px-4 text-sm text-[color:var(--glass-primary-ink)] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function ConfirmDelete({ id, onCancel }: { id: string; onCancel: () => void }) {
  return (
    <form
      action={deleteTransaction}
      className="mb-4 flex items-center gap-4 border-l border-dashed border-[color:var(--color-accent-warning,#9a3412)] py-2 pl-4"
    >
      <input type="hidden" name="id" value={id} />
      <span className="text-sm">Delete this transaction?</span>
      <button
        type="submit"
        className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-accent-warning,#9a3412)]"
      >
        Delete
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
      >
        Cancel
      </button>
    </form>
  );
}
