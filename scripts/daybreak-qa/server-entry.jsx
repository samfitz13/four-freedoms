import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AppLayout from "../../app/(app)/layout";
import Workspace from "../../app/(app)/[freedom]/[tab]/page";
import Dashboard from "../../app/(app)/dashboard/page";
import Relations from "../../app/(app)/relations/page";
import Review from "../../app/(app)/review/this-week/page";
import Settings from "../../app/(app)/settings/page";
import ImportPage from "../../app/(app)/[freedom]/import/page";
import Landing from "../../app/page";
import Login from "../../app/(auth)/login/page";
import NotFound from "../../app/not-found";
import ErrorPage from "../../app/error";

async function resolve(node) {
  if (Array.isArray(node))
    return Promise.all(
      node.map(async (child, index) => {
        const resolved = await resolve(child);
        return React.isValidElement(resolved)
          ? React.cloneElement(resolved, { key: child?.key ?? index })
          : resolved;
      }),
    );
  if (!React.isValidElement(node)) return node;
  if (typeof node.type === "function" && !node.type.__qaClient)
    return resolve(await node.type(node.props));
  if (node.props.children !== undefined)
    return React.cloneElement(node, {}, await resolve(node.props.children));
  return node;
}

export async function renderPage(path, empty = false) {
  globalThis.__qaPath = path;
  globalThis.__qaEmpty = empty;
  const url = new URL(path, "https://fixture.test");
  const common = {
    params: Promise.resolve({
      freedom: url.pathname.split("/")[1],
      tab: url.pathname.split("/")[2],
    }),
    searchParams: Promise.resolve(Object.fromEntries(url.searchParams)),
    error: new Error("Synthetic rendering failure"),
    reset: () => {},
  };
  const routes = {
    "/dashboard": Dashboard,
    "/relations": Relations,
    "/review/this-week": Review,
    "/settings": Settings,
    "/financial/import": ImportPage,
    "/": Landing,
    "/login": Login,
    "/not-found": NotFound,
    "/error": ErrorPage,
  };
  const component = routes[url.pathname] ?? Workspace;
  const page = await resolve(React.createElement(component, common));
  const root = ["/", "/login", "/not-found", "/error"].includes(url.pathname)
    ? page
    : await resolve(React.createElement(AppLayout, {}, page));
  return renderToStaticMarkup(
    <>
      <div className="daybreak-scene" aria-hidden />
      {root}
    </>,
  );
}
