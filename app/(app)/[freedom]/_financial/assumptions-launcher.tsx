"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { FiGoalForm, type DerivedFiDefaults } from "./goals-forms";
import type { FiGoalAssumptions } from "@/lib/freedoms/types";
import type { FiPlanFormInputs } from "@/lib/freedoms/types";

export function AssumptionsLauncher({
  defaults,
  derived,
  currency,
  hasGoal,
  view,
  birthDate,
}: {
  defaults: FiGoalAssumptions;
  derived?: DerivedFiDefaults;
  currency: string;
  hasGoal: boolean;
  view?: FiPlanFormInputs;
  birthDate?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const label = hasGoal ? "Adjust assumptions" : "Set FI target";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className="daybreak-button inline-flex min-h-11 items-center justify-center gap-2 px-3 text-xs"
      >
        <SlidersIcon />
        {label}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="FI assumptions"
        size="lg"
        description="Choose the spending and saving assumptions for your plan."
      >
        <FiGoalForm
          defaults={defaults}
          derived={derived}
          currency={currency}
          onSuccess={() => setOpen(false)}
          view={view}
          birthDate={birthDate}
        />
      </Modal>
    </>
  );
}

function SlidersIcon() {
  // Editorial sliders glyph — three horizontal rules with offset handles.
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="2" y1="4" x2="14" y2="4" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <line x1="2" y1="12" x2="14" y2="12" />
      <circle cx="6" cy="4" r="1.5" fill="var(--color-paper)" />
      <circle cx="11" cy="8" r="1.5" fill="var(--color-paper)" />
      <circle cx="5" cy="12" r="1.5" fill="var(--color-paper)" />
    </svg>
  );
}
