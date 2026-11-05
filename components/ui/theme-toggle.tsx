"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

function isDark() {
  const root = document.documentElement;
  return (
    root.classList.contains("dark") ||
    (!root.classList.contains("light") && window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

function serverSnapshot() {
  return false;
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean } = {}) {
  const dark = useSyncExternalStore(subscribe, isDark, serverSnapshot);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);
    try {
      localStorage.setItem("freedom-four-theme", next);
    } catch {
      // Keep the choice for this page when browser storage is unavailable.
    }
  }

  return (
    <button
      type="button"
      className={`daybreak-button ${showLabel ? "daybreak-glass-toggle" : "daybreak-icon-button"}`}
      onClick={toggle}
      aria-label={showLabel ? undefined : `Switch to ${dark ? "light" : "dark"} mode`}
      aria-pressed={showLabel ? dark : undefined}
    >
      {dark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
      {showLabel && <span>Dark mode</span>}
    </button>
  );
}
