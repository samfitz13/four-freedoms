import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import factoryPlugin from "@factory/eslint-plugin";
import { fileURLToPath } from "node:url";

// Next does not register its import plugin for .cjs files. Reuse the exact
// plugin object globally so every source format gets the same boundary checks.
const importPlugin = nextCoreWebVitals.find((config) => config.plugins?.import)?.plugins.import;
if (!importPlugin) {
  throw new Error("Next.js ESLint preset must provide the import plugin for module boundaries.");
}

/**
 * Lint config.
 *
 * Guardrails:
 *   1. Factory's custom rules are enforced (file organization, etc.).
 *   2. NO global `ignores` / `ignorePatterns` / `.eslintignore`. The whole
 *      repo is linted. See AGENTS.md §8. Per-file-pattern rule overrides
 *      below are NOT ignores — the files are still linted under every other
 *      rule. They exist only to reconcile two non-negotiables:
 *        a) Next.js App Router's filesystem routing contract, and
 *        b) Drizzle's inferred-type colocation convention for schema.ts.
 *
 * Note: `plugin:@factory/frontend` can't be loaded on this stack (missing
 * peer `eslint-plugin-jest`, circular refs in `@eslint-react`, and rules
 * like `react/forbid-dom-props` are incompatible with Tailwind). We wire the
 * `@factory` plugin directly and enable each custom rule that fits.
 */

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  // Resolve real files, not import-string patterns, so aliases and relative
  // paths obey the same layering. The import plugin comes from Next's preset.
  {
    plugins: {
      import: importPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: fileURLToPath(new URL("./tsconfig.json", import.meta.url)),
        },
      },
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          basePath: fileURLToPath(new URL(".", import.meta.url)),
          zones: [
            {
              target: "./lib",
              from: ["./app", "./components"],
              message: "Libraries must not depend on route or presentation modules.",
            },
            {
              target: "./components",
              from: "./app",
              message:
                "Pass route data and actions through props instead of importing app modules.",
            },
            {
              target: "./components/ui",
              from: "./components/freedoms",
              message: "UI primitives must not depend on freedom-specific components.",
            },
            {
              target: "./components/ui",
              from: "./lib",
              except: ["utils.ts"],
              message: "UI primitives may use lib/utils, but receive domain data through props.",
            },
          ],
        },
      ],
    },
  },
  {
    plugins: {
      "@factory": factoryPlugin,
    },
    rules: {
      "@factory/enum-file-organization": "error",
      "@factory/types-file-organization": "error",
      "@factory/constants-file-organization": "error",
      "@factory/errors-file-organization": "error",
      // Disabled: fundamentally incompatible with Next.js App Router, which
      // requires lowercase filesystem-reserved filenames (page.tsx,
      // layout.tsx, route.ts, error.tsx, not-found.tsx, etc.). The rule's
      // `ignoredFiles` only takes exact basenames and we'd end up
      // whitelisting half the rule away.
      "@factory/filename-match-export": "off",
      "@factory/no-exported-function-expressions": "error",
      "@factory/no-exported-string-union-types": "error",
      "@factory/no-dynamic-styled-components": "error",
      "@factory/no-log-exception-with-throw": "error",
    },
  },
  // Drizzle colocates inferred types with the schema by convention. Moving
  // them into a sibling types.ts creates a circular import back into
  // schema.ts, so we allow type exports specifically here.
  {
    files: ["lib/db/schema.ts"],
    rules: {
      "@factory/types-file-organization": "off",
    },
  },
  // Framework-contract const exports. These files export `const X = ...`
  // shapes that the framework requires at the exact path + name:
  //   - Next.js App Router: `metadata`, `dynamic`, `revalidate`, `viewport`,
  //     `generateStaticParams`, etc. in route files.
  //   - Next.js middleware: `export const config = { matcher: [...] }`.
  //   - better-auth: destructured client exports per their public API.
  // Moving them violates the framework contract, not a style preference.
  {
    files: [
      "app/**/page.{ts,tsx}",
      "app/**/layout.{ts,tsx}",
      "app/**/loading.{ts,tsx}",
      "app/**/error.{ts,tsx}",
      "app/**/not-found.{ts,tsx}",
      "app/**/template.{ts,tsx}",
      "app/**/default.{ts,tsx}",
      "app/**/route.{ts,tsx}",
      "proxy.ts",
      "lib/auth-client.ts",
    ],
    rules: {
      "@factory/constants-file-organization": "off",
    },
  },
  prettier,
];

export default eslintConfig;
