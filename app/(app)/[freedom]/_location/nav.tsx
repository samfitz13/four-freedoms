import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { LOCATION_TABS } from "./constants";
import type { LocationTab } from "./types";
import { LocationTabShortcuts } from "./tab-shortcuts";

export function isLocationTab(value: string): value is LocationTab {
  return (LOCATION_TABS as readonly { key: string }[]).some((tab) => tab.key === value);
}

export function LocationTabNav({ active }: { active: LocationTab }) {
  return (
    <>
      <LocationTabShortcuts />
      <WorkspaceTabs
        label="Location"
        basePath="/location"
        tabs={LOCATION_TABS}
        active={active}
        shortcuts={true}
      />
    </>
  );
}
