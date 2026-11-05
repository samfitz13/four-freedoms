import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { validateAgentDocs } from "./check-agent-docs.mjs";

function fixture(t, extra = "") {
  const root = mkdtempSync(path.join(tmpdir(), "agent-docs-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      packageManager: "pnpm@9.15.9",
      scripts: {
        build: "next build",
        lint: "eslint .",
        typecheck: "tsc --noEmit",
        "check:docs": "node scripts/check-agent-docs.mjs",
      },
    }),
  );
  writeFileSync(path.join(root, ".nvmrc"), "22\n");
  writeFileSync(path.join(root, ".env.example"), "DATABASE_URL=\n");
  writeFileSync(path.join(root, "README.md"), "# Setup\n");
  writeFileSync(
    path.join(root, "AGENTS.md"),
    [
      "| Node | 22 |",
      "| Package manager | **pnpm 9** |",
      ...["build", "lint", "typecheck", "check:docs"].map((name) => `| \`pnpm ${name}\` | Check |`),
      "| `DATABASE_URL` | Database |",
      "[Setup](README.md)",
      "[External](https://example.invalid/setup)",
      extra,
    ].join("\n"),
  );
  return root;
}

test("accepts registered commands, matching versions, known env names and local links", (t) => {
  assert.deepEqual(validateAgentDocs(fixture(t)), []);
});
test("normalizes a root with trailing native path separators", (t) => {
  assert.deepEqual(validateAgentDocs(fixture(t) + path.sep), []);
});
test("detects stale commands without executing their shell content", (t) => {
  const errors = validateAgentDocs(fixture(t, "| `pnpm retired:command` | Old command |"));
  assert.ok(errors.some((error) => error.includes("retired:command")));
});
test("detects broken and escaping local links", (t) => {
  const errors = validateAgentDocs(fixture(t, "[Missing](missing.md)\n[Escape](../outside.md)"));
  assert.equal(errors.length, 2);
});
test("detects env drift and mismatched Node and pnpm versions", (t) => {
  const root = fixture(t, "| `UNKNOWN_SECRET` | Missing |");
  writeFileSync(path.join(root, ".nvmrc"), "24\n");
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ packageManager: "pnpm@10.0.0", scripts: {} }),
  );
  const errors = validateAgentDocs(root);
  for (const expected of [
    "Node version",
    "pnpm version",
    "UNKNOWN_SECRET",
    "missing package script",
  ]) {
    assert.ok(errors.some((error) => error.includes(expected)));
  }
});
test("requires a command table and essential validation commands", (t) => {
  const root = fixture(t);
  writeFileSync(path.join(root, "AGENTS.md"), "# Empty guide\n");
  assert.ok(validateAgentDocs(root).some((error) => error.includes("pnpm build")));
});
