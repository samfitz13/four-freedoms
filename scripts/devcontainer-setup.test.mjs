import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const setup = fileURLToPath(new URL("../.devcontainer/setup.mjs", import.meta.url));

function directory(t) {
  const root = mkdtempSync(path.join(tmpdir(), "devcontainer-setup-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("setup creates private random development auth secrets without printing them", (t) => {
  const secrets = [];
  for (let index = 0; index < 2; index++) {
    const root = directory(t);
    const result = spawnSync(process.execPath, [setup], {
      cwd: root,
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 0);
    const file = path.join(root, ".env.local");
    const content = readFileSync(file, "utf8");
    const secret = content.match(/^BETTER_AUTH_SECRET=(.+)$/m)?.[1];
    assert.ok(secret);
    assert.equal(Buffer.from(secret, "base64").length, 48);
    assert.ok(!result.stdout.includes(secret));
    assert.ok(!result.stderr.includes(secret));
    if (process.platform !== "win32") assert.equal(statSync(file).mode & 0o777, 0o600);
    secrets.push(secret);
  }
  assert.notEqual(secrets[0], secrets[1]);
});

test("setup never overwrites an existing environment file", (t) => {
  const root = directory(t);
  const file = path.join(root, ".env.local");
  const original = "BETTER_AUTH_SECRET=synthetic-existing-development-value\n";
  writeFileSync(file, original, { mode: 0o600 });
  const result = spawnSync(process.execPath, [setup], {
    cwd: root,
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(result.status, 0);
  assert.equal(readFileSync(file, "utf8"), original);
  assert.match(result.stdout, /Preserved existing/);
});

test("container toolchain matches the repository and isolates provider configuration", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const config = JSON.parse(
    readFileSync(path.join(root, ".devcontainer/devcontainer.json"), "utf8"),
  );
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const nodeMajor = readFileSync(path.join(root, ".nvmrc"), "utf8").trim();
  const dockerfile = readFileSync(path.join(root, ".devcontainer/Dockerfile"), "utf8");
  assert.ok(dockerfile.includes(`javascript-node:1-${nodeMajor}-bookworm`));
  assert.ok(dockerfile.includes(`corepack prepare ${manifest.packageManager} --activate`));
  assert.equal(new URL(config.remoteEnv.DATABASE_URL).hostname, "127.0.0.1");
  for (const name of [
    "DATABASE_URL_KEYCHAIN_SERVICE",
    "RESEND_API_KEY",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  ]) {
    assert.equal(config.remoteEnv[name], "");
  }
  assert.equal(config.remoteEnv.NEXT_PUBLIC_SITE_URL, "http://localhost:3000");
  assert.equal(config.remoteUser, "node");
  assert.match(config.postCreateCommand, /pnpm install --frozen-lockfile && pnpm db:migrate$/);
});

test("setup rejects unusable existing secrets without changing files or leaking values", (t) => {
  for (const original of [
    "NEXT_PUBLIC_SITE_URL=http://localhost:3000\n",
    "BETTER_AUTH_SECRET=\n",
    "BETTER_AUTH_SECRET=synthetic-short\n",
    'BETTER_AUTH_SECRET=""\n',
  ]) {
    const root = directory(t);
    const file = path.join(root, ".env.local");
    writeFileSync(file, original, { mode: 0o600 });
    const result = spawnSync(process.execPath, [setup], {
      cwd: root,
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.equal(readFileSync(file, "utf8"), original);
    assert.match(result.stderr, /at least 32 characters/);
    assert.ok(!result.stdout.includes("Preserved existing"));
    assert.ok(!result.stderr.includes("synthetic-short"));
  }
});

test("setup accepts a quoted valid secret without altering it", (t) => {
  const root = directory(t);
  const file = path.join(root, ".env.local");
  const original = 'BETTER_AUTH_SECRET="synthetic-valid-local-development-secret"\n';
  writeFileSync(file, original, { mode: 0o600 });
  const result = spawnSync(process.execPath, [setup], {
    cwd: root,
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(result.status, 0);
  assert.equal(readFileSync(file, "utf8"), original);
});
