"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { AddTransactionForm } from "./cashflow-forms";

export function AddTransactionLauncher({
  accounts,
  categories,
}: {
  accounts: Array<{ id: string; name: string; currency: string }>;
  categories: Array<{ id: string; name: string; kind: string }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="daybreak-button inline-flex min-h-11 items-center border border-[color:var(--color-border)] px-3 font-sans text-xs tracking-normal hover:bg-[color:var(--color-foreground)] hover:text-[color:var(--color-paper)]"
      >
        + Add transaction
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add transaction"
        size="lg"
        description="Income, expense, or transfer between two of your accounts."
      >
        <AddTransactionForm
          accounts={accounts}
          categories={categories}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
