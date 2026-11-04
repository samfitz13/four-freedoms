"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { FinancialAccount } from "@/lib/db/schema";
import { EditAccountForm } from "./account-form";

export function AccountEditLauncher({ account }: { account: FinancialAccount }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
      >
        Edit
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Edit ${account.name}`}
        size="lg"
        description="Change account metadata. Balances still live in Statements."
      >
        <EditAccountForm
          account={account}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
