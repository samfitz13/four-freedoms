"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { NewGoalForm, type AccountOption } from "./goals-forms";

export function NewGoalLauncher({
  currency,
  accounts,
}: {
  currency: string;
  accounts: AccountOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="daybreak-button daybreak-button-primary inline-flex min-h-11 items-center px-4 text-sm"
      >
        + New goal
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New goal"
        size="lg"
        description="Choose a target and how to track your progress."
      >
        <NewGoalForm currency={currency} accounts={accounts} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}
