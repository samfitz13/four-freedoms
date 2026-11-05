import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const root = fileURLToPath(new URL("../", import.meta.url));
const boundaryRule = "import/no-restricted-paths";
const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: resolve(root, "eslint.config.mjs"),
});

// Lint in memory at representative layer paths. Imports resolve to actual
// repository files, but no application module, database or provider is executed.
const cases = [
  [
    "routes can compose UI and database readers",
    "app/boundary-probe.tsx",
    'import "@/components/ui/button"; import "@/lib/db/queries/financial";',
    0,
  ],
  [
    "domain components can consume shared domain types",
    "components/freedoms/boundary-probe.tsx",
    'export type { FreedomKey } from "@/lib/freedoms/types";',
    0,
  ],
  [
    "domain components can compose primitives",
    "components/freedoms/boundary-probe.tsx",
    'import "../ui/button";',
    0,
  ],
  ["libraries can use other libraries", "lib/boundary-probe.ts", 'import "./week";', 0],
  ["primitives can compose primitives", "components/ui/boundary-probe.tsx", 'import "./input";', 0],
  [
    "primitives can use the shared class-name utility",
    "components/ui/boundary-probe.tsx",
    'import "@/lib/utils";',
    0,
  ],
  [
    "relative imports retain the utility allowance",
    "components/ui/boundary-probe.tsx",
    'import "../../lib/utils";',
    0,
  ],
  [
    "external UI dependencies remain allowed",
    "components/ui/boundary-probe.tsx",
    'import "react";',
    0,
  ],
  [
    "libraries cannot import route modules by alias",
    "lib/boundary-probe.ts",
    'import "@/app/(app)/[freedom]/page";',
    1,
  ],
  [
    "libraries cannot import route modules relatively",
    "lib/boundary-probe.ts",
    'import "../app/(app)/[freedom]/page";',
    1,
  ],
  [
    "libraries cannot import components by alias",
    "lib/boundary-probe.ts",
    'import "@/components/ui/button";',
    1,
  ],
  [
    "normalized relative paths cannot bypass boundaries",
    "lib/boundary-probe.ts",
    'import "./../components/ui/button";',
    1,
  ],
  [
    "explicit extensions cannot bypass boundaries",
    "lib/boundary-probe.ts",
    'import "../components/ui/button.tsx";',
    1,
  ],
  [
    "named re-exports cannot reverse the layers",
    "lib/boundary-probe.ts",
    'export { Button } from "@/components/ui/button";',
    1,
  ],
  [
    "star re-exports cannot reverse the layers",
    "lib/boundary-probe.ts",
    'export * from "@/components/ui/button";',
    1,
  ],
  [
    "dynamic literal imports obey the layers",
    "lib/boundary-probe.ts",
    'void import("@/components/ui/button");',
    1,
  ],
  [
    "CommonJS literal imports obey the layers",
    "lib/boundary-probe.ts",
    'require("@/components/ui/button");',
    1,
  ],
  [
    "JavaScript files obey the same boundaries",
    "lib/boundary-probe.js",
    'import "@/components/ui/button";',
    1,
  ],
  [
    "ES module files obey the same boundaries",
    "lib/boundary-probe.mjs",
    'import "@/components/ui/button";',
    1,
  ],
  [
    "CommonJS files obey the same boundaries",
    "lib/boundary-probe.cjs",
    'require("@/components/ui/button");',
    1,
  ],
  [
    "components cannot import routes by alias",
    "components/freedoms/boundary-probe.tsx",
    'import "@/app/(app)/[freedom]/page";',
    1,
  ],
  [
    "components cannot import routes relatively",
    "components/freedoms/boundary-probe.tsx",
    'import "../../app/(app)/[freedom]/page";',
    1,
  ],
  [
    "primitives cannot depend on freedom widgets",
    "components/ui/boundary-probe.tsx",
    'import "../freedoms/freedom-card";',
    1,
  ],
  [
    "primitives cannot depend on database clients",
    "components/ui/boundary-probe.tsx",
    'import "@/lib/db/client";',
    1,
  ],
  [
    "primitives cannot depend on domain calculations",
    "components/ui/boundary-probe.tsx",
    'import "../../lib/freedoms/financial-summary";',
    1,
  ],
  [
    "type-only imports obey the same boundaries",
    "components/ui/boundary-probe.tsx",
    'import type { HouseholdScope } from "@/lib/db/types";',
    1,
  ],
];

for (const [name, filePath, source, expected] of cases) {
  const [result] = await eslint.lintText(source, { filePath: resolve(root, filePath) });
  assert.ok(result, `${name}: ESLint did not return a result`);
  assert.equal(result.fatalErrorCount, 0, `${name}: source could not be parsed`);
  assert.ok(
    !result.messages.some(
      (message) => message.ruleId === null || message.message.includes("Resolve error"),
    ),
    `${name}: file was ignored or module resolution failed: ${JSON.stringify(result.messages)}`,
  );
  const violations = result.messages.filter((message) => message.ruleId === boundaryRule);
  assert.equal(violations.length, expected, `${name}: ${JSON.stringify(result.messages)}`);
  assert.ok(
    violations.every((message) => message.severity === 2),
    `${name}: boundary violations must be errors, not warnings`,
  );
}

console.log(`Verified ${cases.length} module-boundary cases.`);
