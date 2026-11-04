"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FINANCIAL_TABS } from "./constants";

/**
 * Keyboard shortcuts for the financial tab bar:
 *   1–N  → jump to each financial tab in order
 * Ignored while focus is on a form field so typing "1" into an amount input
 * still types a digit.
 */
export function FinancialTabShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("dialog, [role=dialog], [role=menu], [popover]")) return;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
      }
      const idx = Number(e.key) - 1;
      if (!Number.isInteger(idx) || idx < 0 || idx >= FINANCIAL_TABS.length) return;
      const tab = FINANCIAL_TABS[idx]!;
      e.preventDefault();
      router.replace(`/financial/${tab.key}`, { scroll: false });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
