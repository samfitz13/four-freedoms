"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TIME_TABS } from "./constants";

export function TimeTabShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("dialog, [role=dialog], [role=menu], [popover]")) return;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
      }
      const idx = Number(event.key) - 1;
      if (!Number.isInteger(idx) || idx < 0 || idx >= TIME_TABS.length) return;
      event.preventDefault();
      router.replace(`/time/${TIME_TABS[idx]!.key}`, { scroll: false });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
