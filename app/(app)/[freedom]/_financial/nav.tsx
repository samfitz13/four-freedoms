import Link from "next/link";

import { FINANCIAL_TABS } from "./constants";
import type { FinancialTab } from "./types";

export function isFinancialTab(v: string): v is FinancialTab {
  return (FINANCIAL_TABS as readonly { key: string }[]).some((t) => t.key === v);
}

export function FinancialTabNav({ active }: { active: FinancialTab }) {
  return (
    <nav
      aria-label="Financial sections"
      className="flex items-center gap-1 border-b border-[color:var(--color-border)]"
    >
      {FINANCIAL_TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={`/financial?tab=${t.key}`}
            aria-current={isActive ? "page" : undefined}
            className={[
              "-mb-px border-b-2 px-3 py-2 font-mono text-[11px] tracking-[0.18em] uppercase transition-colors",
              isActive
                ? "border-[color:var(--color-foreground)] text-[color:var(--color-foreground)]"
                : "border-transparent text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-foreground)]",
            ].join(" ")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
