import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import factoryPlugin from "@factory/eslint-plugin";

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
