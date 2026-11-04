import { notFound, permanentRedirect } from "next/navigation";
import FreedomWorkspace from "../workspace";
import { isFreedomKey, isWorkspaceTab, workspaceUrl } from "../routing";
import type { WorkspaceSearchParams } from "../types";

export { generateMetadata } from "../page";
export const dynamic = "force-dynamic";

export default async function FreedomTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ freedom: string; tab: string }>;
  searchParams: Promise<WorkspaceSearchParams>;
}) {
  const { freedom, tab } = await params;
  if (!isFreedomKey(freedom) || !isWorkspaceTab(freedom, tab)) notFound();
  const search = await searchParams;
  if (search.tab !== undefined) permanentRedirect(workspaceUrl(freedom, tab, search));
  return (
    <FreedomWorkspace params={Promise.resolve({ freedom, tab })} searchParams={searchParams} />
  );
}
