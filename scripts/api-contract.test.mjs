import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import SwaggerParser from "@apidevtools/swagger-parser";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const esbuild = require(require.resolve("esbuild", { paths: [require.resolve("tsx")] }));

async function handlers(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "api-contract-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const outfile = path.join(directory, "handlers.cjs");
  const fixture = path.join(root, "scripts/api-contract-fixtures.mjs");
  await esbuild.build({
    stdin: {
      contents: `export {GET as callback} from "./app/api/time/calendar/callback/route";
        export {POST as sync} from "./app/api/time/calendar/sync/route";
        export {state} from "./scripts/api-contract-fixtures.mjs";`,
      resolveDir: root,
    },
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    plugins: [
      {
        name: "disconnected-api-contract",
        setup(build) {
          build.onResolve({ filter: /^(?:@\/lib\/|drizzle-orm$|next\/)/ }, () => ({
            path: fixture,
          }));
        },
      },
    ],
  });
  return require(outfile);
}

function assertResponse(body, schema) {
  assert.deepEqual(Object.keys(body).sort(), [...schema.required].sort());
  for (const [key, rule] of Object.entries(schema.properties)) {
    if (rule.enum) assert.ok(rule.enum.includes(body[key]));
    if (rule.type === "integer") {
      assert.ok(Number.isInteger(body[key]));
      assert.ok(body[key] >= rule.minimum);
    } else {
      assert.equal(typeof body[key], rule.type);
    }
  }
}

test("OpenAPI is valid, resolves only local references and describes existing route methods", async () => {
  const spec = await SwaggerParser.validate(path.join(root, "docs/api/openapi.json"), {
    resolve: { external: false },
  });
  for (const [route, methods] of Object.entries(spec.paths)) {
    const source = readFileSync(path.join(root, "app", route, "route.ts"), "utf8");
    for (const method of Object.keys(methods)) {
      assert.match(source, new RegExp(`export async function ${method.toUpperCase()}\\(`));
    }
  }
  assert.equal(Object.keys(spec.paths).length, 2);
});

test("sync responses match the contract and skip disabled, recent and foreign accounts", async (t) => {
  const app = await handlers(t);
  const spec = await SwaggerParser.validate(path.join(root, "docs/api/openapi.json"), {
    resolve: { external: false },
  });
  const schema =
    spec.paths["/api/time/calendar/sync"].post.responses["200"].content["application/json"].schema;
  app.state.configured = false;
  const disabledResponse = await app.sync();
  assert.equal(disabledResponse.status, 200);
  assertResponse(await disabledResponse.json(), schema);
  assert.deepEqual(app.state.syncs, []);
  app.state.configured = true;
  app.state.accounts = [
    { id: "eligible", householdId: "synthetic-household", lastSyncedAt: new Date(0) },
    { id: "disabled", householdId: "synthetic-household", disabledAt: new Date() },
    { id: "recent", householdId: "synthetic-household", lastSyncedAt: new Date() },
    { id: "foreign", householdId: "other-household" },
  ];
  const response = await app.sync();
  const body = await response.json();
  assert.equal(response.status, 200);
  assertResponse(body, schema);
  assert.equal(body.synced, 1);
  assert.deepEqual(app.state.syncs, ["eligible"]);
});

test("callback error shape matches the contract and valid cancellation avoids exchange", async (t) => {
  const app = await handlers(t);
  const spec = await SwaggerParser.validate(path.join(root, "docs/api/openapi.json"), {
    resolve: { external: false },
  });
  const schema =
    spec.paths["/api/time/calendar/callback"].get.responses["400"].content["application/json"]
      .schema;
  app.state.returnPath = null;
  const response = await app.callback(
    new Request("https://app.example/api/time/calendar/callback?code=synthetic"),
  );
  assert.equal(response.status, 400);
  assertResponse(await response.json(), schema);
  assert.deepEqual(app.state.exchanges, []);
  app.state.returnPath = "/time/agenda";
  await assert.rejects(
    app.callback(new Request("https://app.example/api/time/calendar/callback?error=access_denied")),
    { destination: "/time/agenda" },
  );
  assert.deepEqual(app.state.exchanges, []);
});

test("unauthenticated handlers redirect and callback exchanges only for the current household", async (t) => {
  const app = await handlers(t);
  app.state.authenticated = false;
  await assert.rejects(app.sync(), { destination: "/login?next=%2F" });
  await assert.rejects(
    app.callback(new Request("https://app.example/api/time/calendar/callback")),
    { destination: "/login?next=%2Ftime%2Fagenda" },
  );
  app.state.authenticated = true;
  app.state.accounts = [{ id: "own", householdId: "synthetic-household" }];
  await assert.rejects(
    app.callback(new Request("https://app.example/api/time/calendar/callback?code=synthetic")),
    { destination: "/time/agenda" },
  );
  assert.deepEqual(app.state.exchanges, [
    { householdId: "synthetic-household", code: "synthetic" },
  ]);
  assert.deepEqual(app.state.syncs, ["own"]);
});
