import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { FINANCIAL_TABS } from "./constants";
import type { FinancialTab } from "./types";
import { FinancialTabShortcuts } from "./tab-shortcuts";

export function isFinancialTab(value: string): value is FinancialTab {
  return (FINANCIAL_TABS as readonly { key: string }[]).some((tab) => tab.key === value);
}

export function FinancialTabNav({ active }: { active: FinancialTab }) {
  return (
    <>
      <FinancialTabShortcuts />
      <WorkspaceTabs
        label="Financial"
        basePath="/financial"
        tabs={FINANCIAL_TABS}
        active={active}
        shortcuts={true}
      />
    </>
  );
}
