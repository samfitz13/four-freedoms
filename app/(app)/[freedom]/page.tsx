import { notFound, permanentRedirect } from "next/navigation";
import { freedomMetas } from "@/lib/freedoms/constants";
import { isFreedomKey, isWorkspaceTab, workspaceUrl } from "./routing";
import type { WorkspaceSearchParams } from "./types";

export async function generateMetadata({ params }: { params: Promise<{ freedom: string }> }) {
  const { freedom } = await params;
  return isFreedomKey(freedom) ? { title: freedomMetas[freedom].label } : {};
}

/** Preserve old bookmarks while making section/tab the canonical route. */
export default async function FreedomDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ freedom: string }>;
  searchParams: Promise<WorkspaceSearchParams>;
}) {
  const { freedom } = await params;
  if (!isFreedomKey(freedom)) notFound();
  const search = await searchParams;
  const tab =
    typeof search.tab === "string" && isWorkspaceTab(freedom, search.tab) ? search.tab : "overview";
  permanentRedirect(workspaceUrl(freedom, tab, search));
}
