import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { test } from "node:test";
import {
  checkDebtChanges,
  checkMetricBudgets,
  maintainabilityLimits,
  validateDebtRegister,
} from "./maintainability-policy.mjs";
import {
  createMaintainabilityLinter,
  checkMaintainability,
  lintMetrics,
  sourceSizeMetrics,
} from "./check-maintainability.mjs";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const entry = {
  id: "DEBT-001",
  kind: "complexity",
  path: "lib/probe.ts",
  symbol: "Function 'legacy'",
  budget: 24,
  owner: "samfitz13",
  priority: "P2",
  status: "open",
  summary: "Legacy validation has too many independent branches.",
  plan: "Extract named validation helpers and keep behavioral regressions.",
};
const metric = { kind: "complexity", path: entry.path, symbol: entry.symbol, value: 24 };
const linter = createMaintainabilityLinter([entry]);

async function analyze(source) {
  return lintMetrics(await linter.lintText(source, { filePath: path.join(root, entry.path) }));
}

test("register requires unique IDs, owners, actionable plans and safe source paths", () => {
  assert.deepEqual(validateDebtRegister({ version: 1, entries: [entry] }), []);
  for (const change of [
    { owner: "" },
    { plan: "later" },
    { priority: "none" },
    { path: "../outside.ts" },
    { path: "/tmp/outside.ts" },
    { budget: 20 },
    { symbol: "" },
  ]) {
    assert.ok(validateDebtRegister({ version: 1, entries: [{ ...entry, ...change }] }).length);
  }
  assert.ok(validateDebtRegister({ version: 1, entries: [entry, entry] }).length);
  assert.ok(validateDebtRegister({ version: 1, entries: [null] }).length);
  assert.ok(validateDebtRegister({ entries: [] }).length);
});

test("new violations and growth fail; measured legacy budgets remain visible", () => {
  assert.deepEqual(checkMetricBudgets([metric], [entry]), []);
  assert.match(checkMetricBudgets([metric], []).join("\n"), /new complexity violation/);
  assert.match(checkMetricBudgets([{ ...metric, value: 25 }], [entry]).join("\n"), /grew/);
  assert.match(
    checkMetricBudgets([{ kind: "lines", path: "lib/new.ts", value: 501 }], []).join("\n"),
    /new lines violation/,
  );
});

test("improvements must tighten budgets; resolved and renamed debt cannot stay open", () => {
  assert.match(checkMetricBudgets([{ ...metric, value: 23 }], [entry]).join("\n"), /lower/);
  assert.deepEqual(checkMetricBudgets([{ ...metric, value: 23 }], [{ ...entry, budget: 23 }]), []);
  assert.match(checkMetricBudgets([], [entry]).join("\n"), /close/);
  assert.deepEqual(checkMetricBudgets([], [{ ...entry, status: "closed" }]), []);
  assert.ok(checkMetricBudgets([{ ...metric, symbol: "Function 'renamed'" }], [entry]).length);
});

test("two anonymous functions cannot reuse one legacy allowance", () => {
  assert.match(checkMetricBudgets([metric, metric], [entry]).join("\n"), /ambiguous/);
});

test("base comparison prevents budget inflation and new or reopened legacy exceptions", () => {
  const previous = { entries: [entry] };
  assert.deepEqual(checkDebtChanges({ entries: [{ ...entry, budget: 23 }] }, previous), []);
  assert.match(
    checkDebtChanges({ entries: [{ ...entry, budget: 25 }] }, previous).join("\n"),
    /increase/,
  );
  assert.ok(checkDebtChanges({ entries: [entry] }, { entries: [] }).length);
  assert.ok(
    checkDebtChanges({ entries: [entry] }, { entries: [{ ...entry, status: "closed" }] }).length,
  );
  assert.deepEqual(
    checkDebtChanges({ entries: [{ ...entry, kind: "maintenance", id: "DEBT-002" }] }, previous),
    [],
  );
  assert.deepEqual(checkDebtChanges({ entries: [entry] }, null), []);
});

test("physical line limits include blanks/comments and handle CRLF/final newlines", () => {
  for (const newline of ["\n", "\r\n"]) {
    const atLimit = Array(500).fill("// synthetic").join(newline) + newline;
    assert.deepEqual(sourceSizeMetrics("lib/probe.ts", Buffer.from(atLimit)).metrics, []);
    const aboveLimit = atLimit + "// last line";
    assert.equal(sourceSizeMetrics("lib/probe.ts", Buffer.from(aboveLimit)).metrics[0].value, 501);
  }
  assert.deepEqual(sourceSizeMetrics("lib/empty.ts", Buffer.from("")).metrics, []);
});

test("byte gates catch giant single-line source and oversized non-source assets", () => {
  assert.ok(
    sourceSizeMetrics("lib/probe.ts", Buffer.alloc(maintainabilityLimits().sourceBytes + 1)).errors
      .length,
  );
  assert.ok(
    sourceSizeMetrics("public/large.bin", Buffer.alloc(maintainabilityLimits().assetBytes + 1))
      .errors.length,
  );
  assert.deepEqual(sourceSizeMetrics("public/small.bin", Buffer.alloc(10)).errors, []);
  assert.equal(
    sourceSizeMetrics(".devcontainer/setup.mjs", Buffer.from("\n".repeat(501))).metrics.length,
    1,
  );
});

test("real ESLint classic complexity accounts for branches and optional chaining", async () => {
  const branches = Array.from({ length: 20 }, (_, index) => `if (n === ${index}) return n;`).join(
    "\n",
  );
  const result = await analyze(`export function probe(n: number) { ${branches} return -1; }`);
  assert.deepEqual(result.errors, []);
  assert.equal(result.metrics[0].value, 21);
  const optional = "?.next".repeat(20);
  const chained = await analyze(
    `export function probe(value: object) { return value${optional}; }`,
  );
  assert.equal(chained.metrics[0].value, 21);
  const simple = await analyze("export function probe(n: number) { return n; }");
  assert.deepEqual(simple.metrics, []);
});

test("parsed comments require tracked open debt IDs and explanations", async () => {
  for (const comment of [
    "TODO: later",
    "FIXME(DEBT-999): repair validation",
    "HACK(DEBT-001):",
    "TODO(DEBT-001): later",
  ]) {
    const result = await analyze(`// ${comment}\nexport function probe() { return 1; }`);
    assert.equal(result.errors.length, 1);
  }
  const valid = await analyze(
    "// TODO(DEBT-001): extract validation helpers\nexport function probe() { return 1; }",
  );
  assert.deepEqual(valid.errors, []);
  const closedLinter = createMaintainabilityLinter([{ ...entry, status: "closed" }]);
  const closed = lintMetrics(
    await closedLinter.lintText("// FIXME(DEBT-001): repair validation", {
      filePath: path.join(root, entry.path),
    }),
  );
  assert.match(closed.errors.join("\n"), /unknown or closed/);
});

test("strings and regexes do not create false debt markers; parse failures never pass", async () => {
  const strings = await analyze('export function probe() { return "TODO: synthetic"; }');
  assert.deepEqual(strings.errors, []);
  const regex = await analyze("export function probe() { return /TODO|FIXME/; }");
  assert.deepEqual(regex.errors, []);
  const malformed = await analyze("export function probe( {");
  assert.match(malformed.errors.join("\n"), /could not be analyzed/);
});

test("repository scan includes new source and fails actual violations without executing modules", async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "maintainability-scan-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet"], { cwd: directory });
  mkdirSync(path.join(directory, "lib"));
  mkdirSync(path.join(directory, "app"));
  mkdirSync(path.join(directory, "docs/maintenance"), { recursive: true });
  writeFileSync(
    path.join(directory, "docs/maintenance/debt.json"),
    JSON.stringify({ version: 1, entries: [] }),
  );
  const branches = Array.from({ length: 20 }, (_, index) => `if (n === ${index}) return n;`).join(
    "\n",
  );
  const file = path.join(directory, "lib/probe.ts");
  writeFileSync(file, `export function probe(n: number) { ${branches} return -1; }`);
  const failing = await checkMaintainability(directory, () => null);
  assert.equal(failing.sourceFiles, 1);
  assert.match(failing.errors.join("\n"), /new complexity violation/);
  writeFileSync(
    file,
    'throw new Error("must never execute"); export function probe(n: number) { return n; }',
  );
  const passing = await checkMaintainability(directory, () => null);
  assert.deepEqual(passing.errors, []);
  writeFileSync(file, "export function invalid( {");
  const invalid = await checkMaintainability(directory, () => null);
  assert.match(invalid.errors.join("\n"), /could not be analyzed/);
  writeFileSync(file, `// TODO: untracked work\nexport function probe() { return 1; }`);
  const marker = await checkMaintainability(directory, () => null);
  assert.match(marker.errors.join("\n"), /Debt markers require/);
  writeFileSync(file, "// synthetic\n".repeat(501));
  const oversized = await checkMaintainability(directory, () => null);
  assert.match(oversized.errors.join("\n"), /new lines violation/);
  rmSync(file);
  const empty = await checkMaintainability(directory, () => null);
  assert.match(empty.errors.join("\n"), /refusing an empty check/);
});
