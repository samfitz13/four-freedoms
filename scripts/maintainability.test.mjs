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
  baselineRef,
  createMaintainabilityLinter,
  checkMaintainability,
  lintMetrics,
  sourceLineMetrics,
} from "./check-maintainability.mjs";
import { qualitySummary } from "./ci-reporting.mjs";

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
    assert.deepEqual(sourceLineMetrics("lib/probe.ts", Buffer.from(atLimit)), []);
    const aboveLimit = atLimit + "// last line";
    assert.equal(sourceLineMetrics("lib/probe.ts", Buffer.from(aboveLimit))[0].value, 501);
  }
  assert.deepEqual(sourceLineMetrics("lib/empty.ts", Buffer.from("")), []);
});

test("line metrics cover development-container source but not assets", () => {
  assert.deepEqual(sourceLineMetrics("public/small.bin", Buffer.alloc(10)), []);
  assert.equal(
    sourceLineMetrics(".devcontainer/setup.mjs", Buffer.from("\n".repeat(501))).length,
    1,
  );
});

test("push baseline uses the pre-push SHA, with explicit bootstrap and missing-event handling", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "maintainability-event-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const event = path.join(directory, "event.json");
  const environment = { GITHUB_EVENT_NAME: "push", GITHUB_EVENT_PATH: event };
  const before = "a".repeat(40);
  writeFileSync(event, JSON.stringify({ before }));
  assert.equal(baselineRef(environment), before);
  assert.equal(baselineRef({ ...environment, GITHUB_BASE_REF: "main" }), "origin/main");
  assert.equal(baselineRef({}), "origin/main");
  writeFileSync(event, JSON.stringify({ before: "0".repeat(40) }));
  assert.equal(baselineRef(environment), null);
  writeFileSync(event, "{}");
  assert.throws(() => baselineRef(environment), /pre-push/);
});

test("invalid registers still yield serializable reports and a quality summary", async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "maintainability-invalid-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, "docs/maintenance"), { recursive: true });
  for (const register of [null, { version: 1, entries: {} }]) {
    writeFileSync(path.join(directory, "docs/maintenance/debt.json"), JSON.stringify(register));
    const report = await checkMaintainability(directory, () =>
      assert.fail("must stop at validation"),
    );
    assert.match(report.errors.join("\n"), /entries array/);
    assert.deepEqual(report.debts, []);
    assert.match(
      qualitySummary({ limits: maintainabilityLimits(), ...report }),
      /Gate errors \| 1/,
    );
    assert.doesNotThrow(() => JSON.stringify(report));
  }
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
  for (const extension of ["cts", "mts"]) {
    const moduleFile = path.join(directory, `lib/probe.${extension}`);
    writeFileSync(moduleFile, `export function probe(n: number) { ${branches} return -1; }`);
    const complex = await checkMaintainability(directory, () => null);
    assert.match(complex.errors.join("\n"), /new complexity violation/);
    writeFileSync(moduleFile, "// synthetic\n".repeat(501));
    const long = await checkMaintainability(directory, () => null);
    assert.match(long.errors.join("\n"), /new lines violation/);
    writeFileSync(moduleFile, "//" + "x".repeat(maintainabilityLimits().sourceBytes));
    const giant = await checkMaintainability(directory, () => null);
    assert.match(giant.errors.join("\n"), /128 KiB/);
    rmSync(moduleFile);
  }
  mkdirSync(path.join(directory, "public"));
  const asset = path.join(directory, "public/large.bin");
  writeFileSync(asset, Buffer.alloc(maintainabilityLimits().assetBytes + 1));
  const largeAsset = await checkMaintainability(directory, () => null);
  assert.match(largeAsset.errors.join("\n"), /5 MiB/);
  rmSync(asset);
  const empty = await checkMaintainability(directory, () => null);
  assert.match(empty.errors.join("\n"), /refusing an empty check/);
});
