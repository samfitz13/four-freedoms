import { FREEDOM_KEYS } from "@/lib/freedoms/constants";
import type { FreedomKey } from "@/lib/freedoms/types";
import { WORKSPACE_TABS } from "./constants";
import type { WorkspaceSearchParams } from "./types";

export function isFreedomKey(value: string): value is FreedomKey {
  return FREEDOM_KEYS.some((key) => key === value);
}

export function isWorkspaceTab(freedom: FreedomKey, tab: string): boolean {
  return WORKSPACE_TABS[freedom].some((entry) => entry.key === tab);
}

export function workspaceUrl(
  freedom: FreedomKey,
  tab: string,
  search: WorkspaceSearchParams = {},
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (key === "tab" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  const suffix = query.toString();
  return `/${freedom}/${tab}${suffix ? `?${suffix}` : ""}`;
}
