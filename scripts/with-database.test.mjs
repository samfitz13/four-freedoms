import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const launcher = fileURLToPath(new URL("./with-database.mjs", import.meta.url));

function run(t, { files = {}, env = {}, args = [] } = {}) {
  const cwd = mkdtempSync(path.join(tmpdir(), "four-freedoms-database-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(path.join(cwd, name), contents);
  }
  const childEnv = { ...process.env };
  delete childEnv.DATABASE_URL;
  delete childEnv.DATABASE_URL_KEYCHAIN_SERVICE;
  return spawnSync(process.execPath, [launcher, ...args], {
    cwd,
    env: { ...childEnv, ...env },
    encoding: "utf8",
  });
}

const inspectDatabase = [
  process.execPath,
  "-e",
  "process.stdout.write(process.env.DATABASE_URL ?? 'unset')",
];

test("explicit DATABASE_URL overrides local files and Keychain configuration", (t) => {
  const result = run(t, {
    files: {
      ".env.local":
        "DATABASE_URL=postgres://local.invalid/test\nDATABASE_URL_KEYCHAIN_SERVICE=unused-test-service",
    },
    env: { DATABASE_URL: "postgres://explicit.invalid/test" },
    args: inspectDatabase,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "postgres://explicit.invalid/test");
});

test("loads .env.local before .env without dotenv log output", (t) => {
  const result = run(t, {
    files: {
      ".env.local": "DATABASE_URL=postgres://local.invalid/test",
      ".env": "DATABASE_URL=postgres://fallback.invalid/test",
    },
    args: inspectDatabase,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "postgres://local.invalid/test");
});

test("loads .env when .env.local is absent", (t) => {
  const result = run(t, {
    files: { ".env": "DATABASE_URL=postgres://fallback.invalid/test" },
    args: inspectDatabase,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "postgres://fallback.invalid/test");
});

test("passes through the child command's exit status", (t) => {
  const result = run(t, { args: [process.execPath, "-e", "process.exit(7)"] });
  assert.equal(result.status, 7);
});

test("refuses hosted schema pushes without logging credentials", (t) => {
  const result = run(t, {
    env: { DATABASE_URL: "postgres://test:synthetic-password@host.invalid/db" },
    args: ["drizzle-kit", "push"],
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Use db:migrate/);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-password|host\.invalid/);
});

test("reports missing commands without launching a child", (t) => {
  const result = run(t);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
});
