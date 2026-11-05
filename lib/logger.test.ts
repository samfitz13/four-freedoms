import assert from "node:assert/strict";
import { test } from "node:test";
import { onRequestError } from "../instrumentation";
import { errorMetadata, logAuthError, logError, redactedLogContext } from "./logger";

test("logging allows only bounded operational context, never arbitrary data", () => {
  assert.deepEqual(
    redactedLogContext({
      status: 503,
      requestId: "00000000-0000-4000-8000-000000000001",
      routePath: "/api/time/calendar/sync",
      routerKind: "App Router",
      DATABASE_URL: "postgres://fixture:secret@database.invalid/private",
      Authorization: "Bearer fixture-secret",
      email: "fixture@example.invalid",
      body: { refresh_token: "fixture-secret" },
      url: "https://example.invalid/?token=fixture-secret",
    }),
    {
      status: 503,
      requestId: "00000000-0000-4000-8000-000000000001",
      route: "/api/time/calendar/sync",
      routerKind: "App Router",
    },
  );
});

test("invalid identifiers, dynamic paths, nested payloads and unbounded statuses are discarded", () => {
  for (const context of [
    null,
    "fixture-secret",
    { requestId: "fixture@example.invalid", routePath: "/users/private-id", routerKind: "secret" },
    { status: Infinity },
    { status: 600 },
    { status: 99 },
    { status: 200.5 },
    { status: "200", headers: { cookie: "fixture-secret" } },
    { nested: { status: 200 } },
  ])
    assert.deepEqual(redactedLogContext(context), {});
});

test("error metadata never serializes messages, stacks, causes, provider objects or custom names", () => {
  const error = Object.assign(new TypeError("fixture-secret fixture@example.invalid"), {
    digest: "123456",
    cause: { access_token: "fixture-secret" },
    toJSON() {
      throw new Error("Never serialize arbitrary errors");
    },
  });
  assert.deepEqual(errorMetadata(error), { name: "TypeError", digest: "123456" });
  error.name = "fixture-secret";
  error.digest = "fixture@example.invalid";
  assert.deepEqual(errorMetadata(error), { name: "Error" });
  assert.deepEqual(errorMetadata({ message: "fixture-secret", digest: "123" }), { name: "Error" });
  assert.deepEqual(errorMetadata("fixture-secret"), { name: "Error" });
});

test("error events are single-line JSON with safe correlation metadata", (t) => {
  const output: string[] = [];
  t.mock.method(console, "error", (line: string) => output.push(line));
  logError(
    "server.request.failed",
    Object.assign(new Error("fixture-secret\nprivate"), { digest: "456" }),
    {
      status: 500,
      requestId: "00000000-0000-4000-8000-000000000001",
      token: "fixture-secret",
    },
  );
  assert.equal(output.length, 1);
  const line = output[0];
  assert.ok(line);
  assert.doesNotMatch(line, /fixture-secret|private|\n/);
  const entry = JSON.parse(line);
  assert.equal(entry.level, "error");
  assert.equal(entry.event, "server.request.failed");
  assert.equal(entry.runtime, "server");
  assert.equal(entry.status, 500);
  assert.equal(entry.requestId, "00000000-0000-4000-8000-000000000001");
  assert.deepEqual(entry.error, { name: "Error", digest: "456" });
  assert.ok(Number.isFinite(Date.parse(entry.timestamp)));
});

test("the Next request hook retains static route context but discards request payloads", (t) => {
  const output: string[] = [];
  t.mock.method(console, "error", (line: string) => output.push(line));
  onRequestError(
    Object.assign(new Error("fixture-secret"), { digest: "789" }),
    {
      path: "/private?token=fixture-secret",
      method: "GET",
      headers: { authorization: "fixture-secret" },
    },
    {
      routerKind: "App Router",
      routePath: "/api/time/calendar/sync",
      routeType: "route",
      revalidateReason: undefined,
    },
  );
  const line = output[0];
  assert.ok(line);
  const entry = JSON.parse(line);
  assert.equal(entry.event, "server.request.failed");
  assert.equal(entry.route, "/api/time/calendar/sync");
  assert.equal(entry.routerKind, "App Router");
  assert.equal(entry.error.digest, "789");
  assert.doesNotMatch(line, /fixture-secret|private|authorization/);
});

test("auth error reporting keeps safe email failure codes, not provider details", (t) => {
  const output: string[] = [];
  t.mock.method(console, "error", (line: string) => output.push(line));
  logAuthError("info", "fixture-secret");
  logAuthError(
    "error",
    "fixture-secret",
    { token: "fixture-secret" },
    Object.assign(new Error("fixture@example.invalid"), { code: "EMAIL_DELIVERY_FAILED" }),
  );
  assert.equal(output.length, 1);
  const line = output[0];
  assert.ok(line);
  assert.equal(JSON.parse(line).event, "auth.operation.failed");
  assert.equal(JSON.parse(line).error.code, "EMAIL_DELIVERY_FAILED");
  assert.doesNotMatch(line, /fixture-secret|fixture@example/);
  assert.deepEqual(errorMetadata(Object.assign(new Error(), { code: "fixture-secret" })), {
    name: "Error",
  });
});
