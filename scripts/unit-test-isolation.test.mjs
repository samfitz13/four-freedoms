import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { unitTestEnvironment, unitTestFiles } from "./run-unit-tests.mjs";

const launcher = fileURLToPath(new URL("./run-unit-tests.mjs", import.meta.url));

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
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
  const peer = new URL("./${peer}.json", import.meta.url);
  writeFileSync(own, JSON.stringify({ owner: "${owner}", pid: process.pid }));
  const deadline = Date.now() + 10000;
  while (!existsSync(peer) && Date.now() < deadline) await setTimeout(20);
  assert.ok(existsSync(peer), "the other file must execute concurrently");
  const other = JSON.parse(readFileSync(peer, "utf8"));
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
