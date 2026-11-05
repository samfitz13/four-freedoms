import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const loadPackage = createRequire(path.join(root, "package.json"));
const esbuild = loadPackage(
  loadPackage.resolve("esbuild", { paths: [loadPackage.resolve("tsx")] }),
);
const ts = loadPackage("typescript");
const out = fs.mkdtempSync(path.join(root, "screenshots/daybreak-rollout-"));
const imports = new Map();

function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(dir, entry.name))
        : /\.(tsx?|jsx?|mjs)$/.test(entry.name)
          ? [path.join(dir, entry.name)]
          : [],
    );
}
for (const file of ["app", "components", "lib", "scripts/daybreak-qa"].flatMap((dir) =>
  walk(path.join(root, dir)),
)) {
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node) || !node.importClause || node.importClause.isTypeOnly)
      continue;
    const key = node.moduleSpecifier.text;
    const names = imports.get(key) ?? new Set();
    if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
      for (const spec of node.importClause.namedBindings.elements)
        if (!spec.isTypeOnly) names.add(spec.propertyName?.text ?? spec.name.text);
    }
    imports.set(key, names);
  }
}

const plugin = {
  name: "isolated-daybreak-fixtures",
  setup(build) {
    build.onResolve({ filter: /^server-only$/ }, () => ({ path: "empty", namespace: "qa" }));
    build.onResolve({ filter: /^next\/(link|navigation|cache)$/ }, (args) => ({
      path: args.path,
      namespace: "qa",
    }));
    build.onResolve({ filter: /actions(?:\.tsx?)?$/ }, (args) => ({
      path: args.path,
      namespace: "mock",
    }));
    build.onResolve(
      { filter: /^@\/lib\/(?:db\/|auth-server|auth-client|correspondences|env)/ },
      (args) => ({ path: args.path, namespace: "mock" }),
    );
    build.onResolve(
      {
        filter:
          /^@\/lib\/freedoms\/(?:.+-summary|fi-plan-server|financial-overview|financial-derived|financial-settings|financial-statements|time-seed|time-habits|time-agenda|location-community|location-residence)$/,
      },
      (args) => ({ path: args.path, namespace: "mock" }),
    );
    build.onResolve({ filter: /^@\// }, (args) => {
      const base = path.join(root, args.path.slice(2));
      const file = [base, base + ".ts", base + ".tsx", base + "/index.ts"].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      );
      if (!file) throw new Error(`Unresolved fixture import: ${args.path}`);
      return { path: file };
    });
    build.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({
      contents:
        `import { qaValue } from ${JSON.stringify(path.join(here, "fixtures.mjs"))};\n` +
        [...(imports.get(args.path) ?? [])]
          .map(
            (name) =>
              `export const ${name} = qaValue(${JSON.stringify(name)}, ${args.path.endsWith("/schema")});`,
          )
          .join("\n"),
      resolveDir: root,
      loader: "js",
    }));
    build.onLoad({ filter: /.*/, namespace: "qa" }, (args) => {
      const contents =
        args.path === "next/link"
          ? `import React from 'react';export default function Link({href,children,replace:replaceRoute,scroll,prefetch,...props}){return React.createElement('a',{...props,href,onClick:(event)=>{props.onClick?.(event);if(typeof window!=='undefined'&&!event.defaultPrevented&&!event.metaKey&&!event.ctrlKey){event.preventDefault();globalThis.__qaPath=href;window.dispatchEvent(new Event('qa:navigate'));}}},children)}`
          : args.path === "next/navigation"
            ? `import {useSyncExternalStore} from 'react';function subscribe(fn){if(typeof window==='undefined')return()=>{};window.addEventListener('qa:navigate',fn);return()=>window.removeEventListener('qa:navigate',fn)}export function usePathname(){return useSyncExternalStore(subscribe,()=>globalThis.__qaPath?.split('?')[0]??'/dashboard',()=>globalThis.__qaPath?.split('?')[0]??'/dashboard')}export function useRouter(){return{push:(p)=>{globalThis.__qaPath=p;window.dispatchEvent(new Event('qa:navigate'))},replace:(p)=>{globalThis.__qaPath=p;window.dispatchEvent(new Event('qa:navigate'))},refresh:()=>{}}}export function notFound(){throw Error('Not found')}export function redirect(p){throw Error('Redirect '+p)}export function permanentRedirect(p){throw Error('Redirect '+p)}`
            : args.path === "next/cache"
              ? "export function revalidatePath(){};export function unstable_cache(fn){return fn}"
              : "";
      return { contents, loader: "js", resolveDir: root };
    });
    build.onLoad({ filter: /\.(tsx|jsx)$/ }, (args) => {
      let source = fs.readFileSync(args.path, "utf8");
      if (/^[\s]*["']use client["']/.test(source)) {
        const names = [...source.matchAll(/export\s+(?:default\s+)?function\s+(\w+)/g)].map(
          (match) => match[1],
        );
        source +=
          "\n" +
          names
            .map((name) => `Object.defineProperty(${name}, '__qaClient', {value:true});`)
            .join("\n");
      }
      return {
        contents: source,
        loader: args.path.endsWith("tsx") ? "tsx" : "jsx",
        resolveDir: path.dirname(args.path),
      };
    });
  },
};

// Executable build products belong in a temporary directory, not the source tree.
const compiled = fs.mkdtempSync(path.join(os.tmpdir(), "daybreak-render-"));
const serverBundle = path.join(compiled, "server.cjs");
await esbuild.build({
  entryPoints: [path.join(here, "server-entry.jsx")],
  outfile: serverBundle,
  bundle: true,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  plugins: [plugin],
  logLevel: "silent",
});
const { renderPage } = loadPackage(serverBundle);
let css = fs
  .readdirSync(path.join(root, ".next/static/chunks"))
  .filter((file) => file.endsWith(".css"))
  .map((file) => {
    const filename = path.join(root, ".next/static/chunks", file);
    return fs.readFileSync(filename, "utf8").replace(/url\(([^)]+)\)/g, (match, quoted) => {
      const url = quoted.replace(/["']/g, "");
      const asset =
        url === "/daybreak/backdrop.webp"
          ? path.join(root, "public", url)
          : path.resolve(path.dirname(filename), url);
      if (!fs.existsSync(asset)) return match;
      const mime = asset.endsWith("woff2") ? "font/woff2" : "image/webp";
      return `url(data:${mime};base64,${fs.readFileSync(asset).toString("base64")})`;
    });
  })
  .join("\n");
css +=
  '\n:root {--font-manrope: "Manrope", sans-serif; --font-jetbrains-mono: "JetBrains Mono", monospace;}';
fs.writeFileSync(path.join(out, "app.css"), css);
const layout = ts.createSourceFile(
  "layout.tsx",
  fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
let startup = "";
function findStartup(node) {
  if (
    ts.isNoSubstitutionTemplateLiteral(node) &&
    node.text.includes('localStorage.getItem("freedom-four-theme")')
  )
    startup = node.text;
  ts.forEachChild(node, findStartup);
}
findStartup(layout);
if (!startup) throw new Error("Missing actual appearance startup script");
const routes = [
  "/dashboard",
  ...Object.entries({
    financial: ["overview", "wealth", "accounts", "cashflow", "income", "statements", "goals"],
    location: ["overview", "home", "properties", "travel", "community", "places", "log"],
    time: ["overview", "agenda", "habits", "pursuits", "log"],
    health: ["overview", "training", "body", "log"],
  }).flatMap(([domain, tabs]) => tabs.map((tab) => `/${domain}/${tab}`)),
  "/time/agenda?view=week",
  "/time/agenda?view=month",
  "/relations",
  "/review/this-week",
  "/settings",
  "/financial/import",
  "/",
  "/login",
  "/not-found",
  "/error",
  ...["clear", "empty", "review", "missing"].map(
    (state) => `/financial/overview?qa-attention=${state}`,
  ),
  ...[
    "horizon",
    "no-statements",
    "manual",
    "age",
    "retirement",
    "missing-allocation",
    "short-retirement",
  ].map((state) => `/financial/goals?qa-goals=${state}`),
];
const results = [];
const variants = [
  ...routes.map((route) => ({ route, empty: false })),
  ...[
    "/dashboard",
    "/financial/overview",
    "/financial/accounts",
    "/financial/goals",
    "/location/overview",
    "/location/travel",
    "/time/overview",
    "/time/habits",
    "/health/overview",
  ].map((route) => ({ route, empty: true })),
];
for (const { route, empty } of variants) {
  const file =
    (route === "/"
      ? "landing"
      : route
          .slice(1)
          .replace(/^(financial|location|time|health)\/(?!import(?:[/?]|$))([^/?]+)/, "$1-tab-$2")
          .replaceAll(/[/?=&]/g, "-")) + (empty ? "-empty" : "");
  try {
    const html = await renderPage(route, empty);
    fs.writeFileSync(
      path.join(out, file + ".html"),
      `<!doctype html><html lang="en" class="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="app.css"><title>Daybreak isolated fixture</title></head><body>${html}</body></html>`,
    );
    results.push({ route, empty, file: file + ".html", status: "rendered" });
  } catch (error) {
    results.push({
      route,
      status: "failed",
      error: error.message,
      stack: error.stack.split("\n").slice(1, 3),
    });
  }
}
for (const name of [
  "lab",
  "habit-lab",
  "goal-lab",
  "chart-lab",
  "scenario-lab",
  "settings-lab",
  "travel-lab",
]) {
  const lab = await esbuild.build({
    entryPoints: [path.join(here, `${name}.jsx`)],
    write: false,
    bundle: true,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    plugins: [plugin],
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  const script = lab.outputFiles[0].text.replaceAll("</script", "<\\/script");
  fs.writeFileSync(
    path.join(out, `${name}.html`),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>${startup}</script><link rel="stylesheet" href="app.css"><title>Daybreak interaction fixture</title></head><body><div id="root"></div><script>${script}</script></body></html>`,
  );
}
fs.writeFileSync(path.join(out, "coverage.json"), JSON.stringify(results, null, 2));
console.log(
  JSON.stringify(
    {
      out,
      rendered: results.filter((result) => result.status === "rendered").length,
      failures: results.filter((result) => result.status === "failed"),
    },
    null,
    2,
  ),
);
if (results.some((result) => result.status === "failed")) process.exitCode = 1;
