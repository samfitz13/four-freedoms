import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { TIME_TABS } from "./constants";
import type { TimeTab } from "./types";
import { TimeTabShortcuts } from "./tab-shortcuts";

export function isTimeTab(value: string): value is TimeTab {
  return (TIME_TABS as readonly { key: string }[]).some((tab) => tab.key === value);
}

export function TimeTabNav({ active }: { active: TimeTab }) {
  return (
    <>
      <TimeTabShortcuts />
      <WorkspaceTabs
        label="Time"
        basePath="/time"
        tabs={TIME_TABS}
        active={active}
        shortcuts={true}
      />
    </>
  );
}
