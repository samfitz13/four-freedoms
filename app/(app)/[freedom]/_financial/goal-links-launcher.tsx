"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { GoalLinksForm, type AccountOption } from "./goals-forms";

export function GoalLinksLauncher({
  goalId,
  initial,
  accounts,
}: {
  goalId: string;
  initial: {
    linkMode: "manual" | "accounts" | "class";
    linkedAccountIds: string[];
    linkedClass: string | null;
    invert: boolean;
  };
  accounts: AccountOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="daybreak-button font-sans text-xs tracking-normal text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]"
      >
        Progress source
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Progress source"
        size="lg"
        description="Enter progress manually, or use your latest account statements."
      >
        <GoalLinksForm
          goalId={goalId}
          initial={initial}
          accounts={accounts}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
