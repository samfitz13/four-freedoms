"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { NewAccountForm } from "./account-form";

export function NewAccountLauncher({ defaultCurrency }: { defaultCurrency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="daybreak-button inline-flex min-h-11 items-center border border-[color:var(--color-border)] px-3 font-sans text-xs tracking-normal hover:bg-[color:var(--color-foreground)] hover:text-[color:var(--color-paper)]"
      >
        + New account
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New account"
        size="lg"
        description="Manual account you maintain by hand. Add an opening balance now or record one later."
      >
        <NewAccountForm defaultCurrency={defaultCurrency} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}
