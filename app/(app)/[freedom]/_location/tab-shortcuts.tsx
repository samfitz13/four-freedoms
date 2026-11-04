"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LOCATION_TABS } from "./constants";

const INPUT_SELECTOR = "input, textarea, select, [contenteditable='true']";

export function LocationTabShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (
        target?.closest(INPUT_SELECTOR) ||
        target?.closest("dialog, [role=dialog], [role=menu], [popover]")
      )
        return;
      const index = Number(event.key) - 1;
      const tab = LOCATION_TABS[index];
      if (!tab) return;
      event.preventDefault();
      router.replace(`/location/${tab.key}`, { scroll: false });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
