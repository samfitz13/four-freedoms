import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { WORKSPACE_TABS } from "./constants";
import { isFreedomKey, isWorkspaceTab, workspaceUrl } from "./routing";
import FreedomDetailPage from "./page";
import type { WorkspaceSearchParams } from "./types";

test("all 23 tabs have a valid path and cross-section tabs are rejected", () => {
  let count = 0;
  for (const [freedom, tabs] of Object.entries(WORKSPACE_TABS)) {
    assert.ok(isFreedomKey(freedom));
    for (const tab of tabs) {
      assert.equal(isWorkspaceTab(freedom, tab.key), true);
      assert.equal(workspaceUrl(freedom, tab.key), `/${freedom}/${tab.key}`);
      count++;
    }
  }
  assert.equal(count, 23);
  assert.equal(isFreedomKey("__proto__"), false);
  assert.equal(isFreedomKey("settings"), false);
  assert.equal(isWorkspaceTab("location", "goals"), false);
  assert.equal(isWorkspaceTab("financial", "travel"), false);
});

test("canonical paths remove only tab and preserve filters, repeated values, and encoding", () => {
  assert.equal(
    workspaceUrl("financial", "statements", {
      tab: "income",
      month: "2026-09-01",
      account: ["one", "two"],
      note: "room & time",
      empty: "",
      unset: undefined,
    }),
    "/financial/statements?month=2026-09-01&account=one&account=two&note=room+%26+time&empty=",
  );
});

test("legacy tab bookmarks permanently redirect while keeping view and date filters", async () => {
  for (const [freedom, tab, search, expected] of [
    ["financial", "goals", {}, "/financial/goals"],
    ["financial", "statements", { month: "2026-09-01" }, "/financial/statements?month=2026-09-01"],
    ["financial", "income", { year: "2025" }, "/financial/income?year=2025"],
    ["location", "travel", {}, "/location/travel"],
    ["time", "agenda", { view: "week" }, "/time/agenda?view=week"],
    ["health", "body", {}, "/health/body"],
  ] satisfies [string, string, WorkspaceSearchParams, string][]) {
    await assert.rejects(
      FreedomDetailPage({
        params: Promise.resolve({ freedom }),
        searchParams: Promise.resolve({ ...search, tab }),
      }),
      (error: unknown) =>
        error instanceof Error &&
        "digest" in error &&
        error.digest === `NEXT_REDIRECT;replace;${expected};308;`,
    );
  }
});

test("section roots and invalid legacy tabs use overview; invalid sections stay 404", async () => {
  for (const search of [{}, { tab: "unknown" }, { tab: ["goals", "accounts"] }]) {
    await assert.rejects(
      FreedomDetailPage({
        params: Promise.resolve({ freedom: "financial" }),
        searchParams: Promise.resolve(search),
      }),
      (error: unknown) =>
        error instanceof Error &&
        "digest" in error &&
        error.digest === "NEXT_REDIRECT;replace;/financial/overview;308;",
    );
  }
  await assert.rejects(
    FreedomDetailPage({
      params: Promise.resolve({ freedom: "unknown" }),
      searchParams: Promise.resolve({}),
    }),
    (error: unknown) =>
      error instanceof Error &&
      "digest" in error &&
      error.digest === "NEXT_HTTP_ERROR_FALLBACK;404",
  );
});

test("the auth gate preserves canonical and legacy return URLs with filters", () => {
  for (const path of [
    "/financial/goals",
    "/time/agenda?view=week",
    "/financial?tab=statements&month=2026-09-01",
  ]) {
    const response = proxy(new NextRequest(`http://localhost:3000${path}`));
    const location = new URL(response.headers.get("location") ?? "");
    assert.equal(location.pathname, "/login");
    assert.equal(location.searchParams.get("next"), path);
    assert.equal(Array.from(location.searchParams.keys()).length, 1);
  }
});
