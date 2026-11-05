import { FINANCIAL_TABS } from "./_financial/constants";
import { LOCATION_TABS } from "./_location/constants";
import { TIME_TABS } from "./_time/constants";
import { HEALTH_TABS } from "./_health/constants";

export const WORKSPACE_TABS = {
  financial: FINANCIAL_TABS,
  location: LOCATION_TABS,
  time: TIME_TABS,
  health: HEALTH_TABS,
} as const;
