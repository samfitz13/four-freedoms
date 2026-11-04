"use client";

import { useSyncExternalStore } from "react";
import { Blend } from "lucide-react";

function getSnapshot() {
  const preference = document.documentElement.dataset.glass;
  return (
    preference === "solid" ||
    (!preference && window.matchMedia("(prefers-reduced-transparency: reduce)").matches)
  );
}

function serverSnapshot() {
  return false;
}

function subscribe(onChange: () => void) {
  const root = document.documentElement;
  const observer = new MutationObserver(onChange);
  const media = window.matchMedia("(prefers-reduced-transparency: reduce)");
  observer.observe(root, { attributes: true, attributeFilter: ["data-glass"] });
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

export function GlassToggle() {
  const solid = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  function toggle() {
    const next = solid ? "full" : "solid";
    document.documentElement.dataset.glass = next;
    try {
      localStorage.setItem("freedom-four-glass", next);
    } catch {
      /* Keep an in-memory preference. */
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={solid}
      className="daybreak-button daybreak-glass-toggle"
    >
      <Blend size={17} aria-hidden />
      <span>{solid ? "Restore glass" : "Reduce glass"}</span>
    </button>
  );
}
