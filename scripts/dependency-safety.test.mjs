import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const root = fileURLToPath(new URL("../", import.meta.url));
const eslint = new ESLint({ cwd: root });
const cases = [
  {
    name: "Factory rules remain enforced after unused compiler dependency removal",
    file: "lib/dependency-safety-probe.ts",
    source: "export const example = () => 1;",
    rule: "@factory/no-exported-function-expressions",
  },
  {
    name: "Next hooks rules still reject conditional hooks",
    file: "app/dependency-safety-probe.tsx",
    source: `import { useState } from "react";
export default function Probe({ enabled }: { enabled: boolean }) {
  if (enabled) useState(0);
  return null;
}`,
    rule: "react-hooks/rules-of-hooks",
  },
  {
    name: "Next compiler diagnostics still reject mutating component props",
    file: "app/dependency-safety-probe.tsx",
    source: `export default function Probe(props: { label: string }) {
  props.label = "changed";
  return <div>{props.label}</div>;
}`,
    rule: "react-hooks/immutability",
  },
];

for (const fixture of cases) {
  test(fixture.name, async () => {
    const [result] = await eslint.lintText(fixture.source, {
      filePath: path.join(root, fixture.file),
    });
    assert.ok(result);
    assert.ok(
      result.messages.some((message) => message.ruleId === fixture.rule && message.severity === 2),
      JSON.stringify(result.messages),
    );
  });
}
