import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { unitTestEnvironment, unitTestFiles } from "./run-unit-tests.mjs";

const launcher = fileURLToPath(new URL("./run-unit-tests.mjs", import.meta.url));
const root = fileURLToPath(new URL("../", import.meta.url));

function workspace(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "four-freedoms-isolation-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("unit workers receive only OS/tooling settings, never application or startup credentials", () => {
  const environment = {
    PATH: "/synthetic/bin",
    HOME: "/synthetic/home",
    NODE_V8_COVERAGE: "/synthetic/coverage",
    DATABASE_URL: "postgres://synthetic.invalid/unit",
    DATABASE_URL_KEYCHAIN_SERVICE: "synthetic-service",
    BETTER_AUTH_SECRET: "synthetic-auth-secret",
    RESEND_API_KEY: "synthetic-email-secret",
    GOOGLE_CLIENT_SECRET: "synthetic-oauth-secret",
    GITHUB_TOKEN: "synthetic-ci-token",
    UNKNOWN_PROVIDER_TOKEN: "synthetic-new-provider-token",
    SKIP_ENV_VALIDATION: "1",
    NODE_OPTIONS: "--import=synthetic-startup-hook",
    NODE_PATH: "/synthetic/modules",
    NODE_TEST_CONTEXT: "child-v8",
    NODE_ENV: "production",
    TZ: "Pacific/Honolulu",
  };
  const before = { ...environment };
  assert.deepEqual(unitTestEnvironment(environment), {
    PATH: "/synthetic/bin",
    HOME: "/synthetic/home",
    NODE_V8_COVERAGE: "/synthetic/coverage",
    NODE_ENV: "test",
    TZ: "UTC",
  });
  assert.deepEqual(environment, before);
});

test("test selection discovers actual unit files and refuses isolation-bypass flags", () => {
  const files = unitTestFiles([]);
  const paystub = unitTestFiles(["paystub"]);
  assert.equal(paystub.length, 1);
  assert.ok(files.includes(paystub[0]));
  assert.ok(files.every((file) => file.endsWith(".test.ts")));
  assert.ok(unitTestFiles(["financial"]).includes(paystub[0]));
  assert.throws(() => unitTestFiles(["--experimental-test-isolation=none"]), /not runner flags/);
  assert.throws(() => unitTestFiles(["package.json"]), /not runner flags/);
  assert.throws(() => unitTestFiles(["missing-unit.test.ts"]));
});

function listTests(selection) {
  return spawnSync(process.execPath, [launcher, "--list", ...selection], {
    env: unitTestEnvironment(process.env),
    encoding: "utf8",
    timeout: 10000,
  });
}

test("list-only discovery prints the actual default, suite and deduplicated file selections", () => {
  for (const selection of [[], ["paystub"], ["financial", "paystub"]]) {
    const result = listTests(selection);
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.deepEqual(
      result.stdout.trim().split("\n"),
      unitTestFiles(selection).map((file) => path.relative(root, file)),
    );
    assert.doesNotMatch(result.stdout, /TAP version|# pass|# fail/);
  }
});

test("list-only mode never imports test files or runs their side effects", (t) => {
  const directory = workspace(t);
  const marker = path.join(directory, "must-not-exist");
  const file = path.join(directory, "side-effect.test.mjs");
  writeFileSync(
    file,
    `import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "test code executed");
throw new Error("Listing must not import this module");
`,
  );
  const result = listTests([file, file]);
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), path.relative(root, file));
  assert.equal(existsSync(marker), false);
});

test("list-only discovery rejects missing files and execution flags", () => {
  for (const selection of [
    ["missing-unit.test.ts"],
    ["package.json"],
    ["--experimental-test-isolation=none"],
    ["--timings"],
  ]) {
    const result = listTests(selection);
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Select a suite/);
  }
});

test("local environment variants are ignored while the example stays trackable", () => {
  const ignored = [
    ".env",
    ".env.local",
    ".env.production",
    ".env.preview",
    ".env.development",
    ".env.test",
    ".env.production.local",
    ".env.example.backup",
    "lib/.env.preview",
  ];
  const result = spawnSync("git", ["check-ignore", "--no-index", "--stdin"], {
    cwd: root,
    input: [...ignored, ".env.example"].join("\n") + "\n",
    encoding: "utf8",
    timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split("\n"), ignored);
});

test("parallel files isolate globals, module caches and environment while using disposable fixtures", (t) => {
  const directory = path.join(workspace(t), "workspace (fixture) [literal]");
  mkdirSync(directory);
  writeFileSync(path.join(directory, "shared.mjs"), "export const state = { owner: null };\n");
  const files = ["first", "second"].map((owner, index) => {
    const file = path.join(directory, `${owner}.test.mjs`);
    const peer = index === 0 ? "second" : "first";
    writeFileSync(
      file,
      `
import assert from "node:assert/strict";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";
import { state } from "./shared.mjs";
test("isolated ${owner} worker", async () => {
  assert.equal(state.owner, null);
  assert.equal(globalThis.isolationOwner, undefined);
  assert.equal(process.env.ISOLATION_OWNER, undefined);
  assert.equal(process.env.DATABASE_URL, undefined);
  assert.equal(process.env.UNKNOWN_PROVIDER_TOKEN, undefined);
  assert.equal(process.env.NODE_OPTIONS, undefined);
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.TZ, "UTC");
  state.owner = "${owner}";
  globalThis.isolationOwner = "${owner}";
  process.env.ISOLATION_OWNER = "${owner}";
  const own = new URL("./${owner}.json", import.meta.url);
  const pending = new URL("./${owner}.json.tmp", import.meta.url);
  const peer = new URL("./${peer}.json", import.meta.url);
  writeFileSync(pending, JSON.stringify({ owner: "${owner}", pid: process.pid }));
  renameSync(pending, own);
  const deadline = Date.now() + 10000;
  while (!existsSync(peer) && Date.now() < deadline) await setTimeout(20);
  assert.ok(existsSync(peer), "the other file must execute concurrently");
  const other = JSON.parse(readFileSync(peer, "utf8"));
  assert.equal(other.owner, "${peer}");
  assert.notEqual(other.pid, process.pid, "each file must have its own process");
  assert.equal(state.owner, "${owner}");
  assert.equal(globalThis.isolationOwner, "${owner}");
  assert.equal(process.env.ISOLATION_OWNER, "${owner}");
  assert.equal(JSON.parse(readFileSync(own, "utf8")).owner, "${owner}");
});
`,
    );
    return file;
  });
  const result = spawnSync(process.execPath, [launcher, ...files], {
    env: {
      ...process.env,
      DATABASE_URL: "postgres://synthetic.invalid/never-connect",
      UNKNOWN_PROVIDER_TOKEN: "synthetic-provider-token",
      ISOLATION_OWNER: "synthetic-parent-state",
    },
    encoding: "utf8",
    timeout: 25000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /isolated first worker/);
  assert.match(result.stdout, /isolated second worker/);
});

test("the launcher propagates an actual assertion failure as a failing command", (t) => {
  const file = path.join(workspace(t), "failure.test.mjs");
  writeFileSync(
    file,
    `
import assert from "node:assert/strict";
import { test } from "node:test";
test("intentional launcher regression probe", () => assert.equal(1, 2));
`,
  );
  const result = spawnSync(process.execPath, [launcher, file], {
    env: unitTestEnvironment(process.env),
    encoding: "utf8",
    timeout: 15000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /intentional launcher regression probe/);
});
