import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { HEALTH_TABS } from "./constants";
import type { HealthTab } from "./types";

export function isHealthTab(value: string): value is HealthTab {
  return (HEALTH_TABS as readonly { key: string }[]).some((tab) => tab.key === value);
}

export function HealthTabNav({ active }: { active: HealthTab }) {
  return (
    <>
      <WorkspaceTabs
        label="Health"
        basePath="/health"
        tabs={HEALTH_TABS}
        active={active}
        shortcuts={false}
      />
    </>
  );
}
