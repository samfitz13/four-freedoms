// Runs actual actions, readers, OAuth state and email transport without live services.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { beforeEach, test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const esbuild = require(require.resolve("esbuild", { paths: [require.resolve("tsx")] }));
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "security-regression-")), "test.cjs");
const fixture = path.join(root, "scripts/security-fixtures.mjs");
await esbuild.build({
  stdin: {
    contents: `
      export {startStay} from "./app/(app)/[freedom]/_location/actions";
      export {logVisit} from "./app/(app)/[freedom]/_location/community-actions";
      export {mergePursuits} from "./app/(app)/[freedom]/_time/pursuits-actions";
      export {connectGoogle} from "./app/(app)/[freedom]/_time/calendar-sync-actions";
      export {GET as calendarCallback} from "./app/api/time/calendar/callback/route";
      export * from "./lib/calendar/oauth-state";
      export {sendEmail} from "./lib/email";
      export * from "./lib/db/queries/location";
      export {listTimeLogEntries, listTimeEvents} from "./lib/db/queries/time";
      export {computeTimeAllocation} from "./lib/freedoms/time-allocation";
      export {syncConnectionVisitToEvent, syncTripToEvent} from "./lib/correspondences/sync";
      export {state, env, db} from "./scripts/security-fixtures.mjs";
    `,
    resolveDir: root,
  },
  bundle: true,
  outfile: out,
  platform: "node",
  format: "cjs",
  plugins: [
    {
      name: "disconnected-security-fixtures",
      setup(build) {
        build.onResolve({ filter: /^server-only$/ }, () => ({ path: "empty", namespace: "empty" }));
        build.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "" }));
        build.onResolve(
          {
            filter:
              /^(?:drizzle-orm|resend|next\/(?:cache|navigation|server)|@\/lib\/(?:db\/(?:client|schema|scope|queries\/financial)|auth-server|env|freedoms\/time-seed|correspondences\/time-health))$/,
          },
          () => ({ path: fixture }),
        );
        build.onResolve({ filter: /^@\/lib\/calendar\/google$/ }, (args) =>
          args.importer.includes("/app/") ? { path: fixture } : undefined,
        );
        build.onResolve({ filter: /^@\// }, (args) => ({
          path: path.join(root, args.path.slice(2) + ".ts"),
        }));
      },
    },
  ],
  logLevel: "silent",
});
const app = require(out);
const { state, env } = app;
const today = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  state.tables = {
    places: [
      { id: "own-place", householdId: "household", name: "Own place", country: "Own country" },
      {
        id: "foreign-place",
        householdId: "other",
        name: "Private place",
        country: "Private country",
      },
    ],
    connections: [{ id: "own-connection", householdId: "household", name: "Own connection" }],
    timePursuits: [
      { id: "from", householdId: "household", name: "Own source", kind: "work" },
      { id: "to", householdId: "household", name: "Own target", kind: "play" },
      { id: "foreign", householdId: "other", name: "Private pursuit", kind: "care" },
    ],
  };
  state.writes = [];
  state.exchanges = [];
  state.transactions = 0;
  state.authenticated = true;
  env.NODE_ENV = "development";
  delete env.RESEND_API_KEY;
});

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

for (const placeId of ["foreign-place", "missing-place"]) {
  test(`startStay rejects ${placeId} before closing or creating stays`, async () => {
    await assert.rejects(app.startStay(form({ placeId })), /Place not found/);
    assert.deepEqual(state.writes, []);
  });
  test(`logVisit rejects ${placeId} before writes or synchronization`, async () => {
    await assert.rejects(
      app.logVisit(form({ connectionId: "own-connection", placeId })),
      /Place not found/,
    );
    assert.equal(state.transactions, 0);
    assert.deepEqual(state.writes, []);
  });
}
test("startStay accepts an owned place", async () => {
  await app.startStay(form({ placeId: "own-place" }));
  assert.equal(state.tables.stays[0].placeId, "own-place");
});
for (const placeId of ["own-place", ""]) {
  test(`logVisit accepts ${placeId || "no place"} and synchronizes the visit`, async () => {
    await app.logVisit(form({ connectionId: "own-connection", placeId }));
    assert.equal(state.tables.connectionVisits[0].placeId, placeId || null);
    assert.equal(state.tables.timeEvents[0].location, placeId ? "Own place" : null);
  });
}

for (const [fromId, toId] of [
  ["from", "foreign"],
  ["foreign", "to"],
  ["from", "missing"],
  ["missing", "to"],
  ["from", "from"],
]) {
  test(`mergePursuits rejects ${fromId} -> ${toId} without mutations`, async () => {
    const result = await app.mergePursuits(null, form({ fromId, toId }));
    assert.equal(result.ok, false);
    assert.equal(state.transactions, 0);
    assert.deepEqual(state.writes, []);
  });
}
test("mergePursuits accepts two owned pursuits and leaves foreign logs untouched", async () => {
  state.tables.timeLogEntries = [
    { householdId: "household", pursuitId: "from" },
    { householdId: "other", pursuitId: "from" },
  ];
  assert.equal((await app.mergePursuits(null, form({ fromId: "from", toId: "to" }))).ok, true);
  assert.equal(state.tables.timeLogEntries[0].pursuitId, "to");
  assert.equal(state.tables.timeLogEntries[1].pursuitId, "from");
  assert.ok(state.tables.timePursuits[0].archivedAt instanceof Date);
});

test("place readers hide legacy cross-household references", async () => {
  state.tables.stays = [
    { id: "bad", householdId: "household", placeId: "foreign-place", kind: "trip", endedOn: null },
    { id: "good", householdId: "household", placeId: "own-place", kind: "trip", endedOn: null },
  ];
  for (const read of [app.listStays, app.listTripStays]) {
    assert.deepEqual(
      (await read("household")).map((row) => row.id),
      ["good"],
    );
  }
  assert.equal((await app.currentStay("household")).placeName, "Own place");
  state.tables.connectionVisits = [
    {
      id: "visit",
      householdId: "household",
      connectionId: "own-connection",
      placeId: "foreign-place",
    },
  ];
  assert.equal((await app.listConnectionVisits("household"))[0].placeName, null);
  await app.syncConnectionVisitToEvent(app.db, "household", "visit");
  assert.equal(state.tables.timeEvents[0].location, null);
});

test("pursuit readers hide legacy cross-household references", async () => {
  state.tables.timeLogEntries = [
    { householdId: "household", pursuitId: "foreign", recordedOn: today, hours: "1" },
    { householdId: "household", pursuitId: "to", recordedOn: today, hours: "2" },
  ];
  assert.deepEqual(
    (await app.listTimeLogEntries("household")).map((row) => row.pursuitId),
    ["to"],
  );
  assert.deepEqual(
    (await app.computeTimeAllocation("household")).map((row) => row.pursuitId),
    ["to"],
  );
  state.tables.timeEvents = [
    { householdId: "household", pursuitId: "foreign", startsAt: new Date(), endsAt: new Date() },
  ];
  const events = await app.listTimeEvents("household", new Date(0), new Date("2100-01-01"));
  assert.equal(events[0].pursuitName, null);
});

test("other location readers omit foreign place details without hiding optional records", async () => {
  const references = [
    { id: "bad", householdId: "household", placeId: "foreign-place" },
    { id: "good", householdId: "household", placeId: "own-place" },
  ];
  state.tables.residences = references;
  assert.deepEqual(
    (await app.listResidences("household")).map((row) => row.id),
    ["good"],
  );
  state.tables.properties = references.map((record) => ({ ...record, accountId: "account" }));
  state.tables.financialAccounts = [
    { id: "account", householdId: "household", name: "Own account" },
  ];
  assert.deepEqual(
    (await app.listProperties("household")).map((row) => row.id),
    ["good"],
  );
  state.tables.locationSatisfactions = references.map((record) => ({
    ...record,
    recordedOn: today,
  }));
  const satisfactions = await app.listRecentSatisfactions("household");
  assert.deepEqual(
    satisfactions.map((row) => row.placeName),
    [null, "Own place"],
  );
  state.tables.connections = references.map((record) => ({ ...record, archivedAt: null }));
  assert.deepEqual(
    (await app.listConnections("household")).map((row) => row.placeName),
    [null, "Own place"],
  );
});

test("trip synchronization does not copy foreign stays or place names", async () => {
  state.tables.trips = [
    {
      id: "trip",
      householdId: "household",
      name: "Own trip",
      startsOn: today,
      endsOn: today,
      archivedAt: null,
    },
  ];
  state.tables.stays = [
    { tripId: "trip", householdId: "other", placeId: "own-place" },
    { tripId: "trip", householdId: "household", placeId: "foreign-place" },
  ];
  await app.syncTripToEvent(app.db, "household", "trip");
  assert.equal(state.tables.timeEvents[0].location, null);
  assert.equal(state.tables.timeEvents[0].title, "Own trip");
});

test("OAuth state is unpredictable, session/household-bound and single use", async () => {
  const first = await app.createCalendarOAuthState(
    "session",
    "household",
    "/time/agenda?view=week",
  );
  const second = await app.createCalendarOAuthState("session", "household", "/time/agenda");
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.equal(await app.consumeCalendarOAuthState("other-session", "household", first), null);
  assert.equal(await app.consumeCalendarOAuthState("session", "other-household", first), null);
  const results = await Promise.all([
    app.consumeCalendarOAuthState("session", "household", first),
    app.consumeCalendarOAuthState("session", "household", first),
  ]);
  assert.deepEqual(results.sort(), ["/time/agenda?view=week", null].sort());
});
test("OAuth state rejects expiry, missing input and malformed tokens", async () => {
  const stateToken = await app.createCalendarOAuthState("session", "household", "/time/agenda");
  state.tables.verifications[0].expiresAt = new Date(0);
  for (const token of [stateToken, null, "", "/time/agenda", "x".repeat(1000)]) {
    assert.equal(await app.consumeCalendarOAuthState("session", "household", token), null);
  }
});
for (const destination of [
  "//attacker.example",
  "/\\attacker.example",
  "https://attacker.example",
  "/\n/attacker.example",
  "/safe/..//attacker.example",
  "/%2e%2e//attacker.example",
]) {
  test(`OAuth state refuses external return destination ${JSON.stringify(destination)}`, async () => {
    const token = await app.createCalendarOAuthState("session", "household", destination);
    assert.equal(
      await app.consumeCalendarOAuthState("session", "household", token),
      "/time/agenda",
    );
  });
}
test("connectGoogle authenticates and sends an opaque state, not the return path", async () => {
  state.authenticated = false;
  await assert.rejects(app.connectGoogle(form({})), /Unauthenticated/);
  assert.deepEqual(state.writes, []);
  state.authenticated = true;
  await assert.rejects(
    app.connectGoogle(form({ redirectUrl: "/time/agenda?view=week" })),
    (error) => {
      const url = new URL(error.destination);
      assert.equal(url.origin, "https://accounts.google.com");
      assert.match(url.searchParams.get("state"), /^[A-Za-z0-9_-]{43}$/);
      return true;
    },
  );
});
test("calendar callback rejects missing or foreign-session state before code exchange", async () => {
  const foreign = await app.createCalendarOAuthState("other-session", "household", "/time/agenda");
  for (const suffix of ["", "&state=%2F%2Fattacker.example", `&state=${foreign}`]) {
    const response = await app.calendarCallback(
      new Request(`https://app.example/api/time/calendar/callback?code=synthetic-code${suffix}`),
    );
    assert.equal(response.status, 400);
  }
  assert.deepEqual(state.exchanges, []);
});
test("calendar callback consumes valid state and rejects replay", async () => {
  const token = await app.createCalendarOAuthState(
    "test-session",
    "household",
    "/time/agenda?view=week",
  );
  const request = new Request(
    `https://app.example/api/time/calendar/callback?code=synthetic-code&state=${token}`,
  );
  await assert.rejects(app.calendarCallback(request), { destination: "/time/agenda?view=week" });
  assert.deepEqual(state.exchanges, [{ householdId: "household", code: "synthetic-code" }]);
  assert.equal((await app.calendarCallback(request)).status, 400);
  assert.equal(state.exchanges.length, 1);
});
test("calendar cancellation consumes state without exchanging a code", async () => {
  const token = await app.createCalendarOAuthState("test-session", "household", "/time/agenda");
  await assert.rejects(
    app.calendarCallback(
      new Request(
        `https://app.example/api/time/calendar/callback?error=access_denied&state=${token}`,
      ),
    ),
    { destination: "/time/agenda" },
  );
  assert.deepEqual(state.exchanges, []);
  assert.equal(await app.consumeCalendarOAuthState("test-session", "household", token), null);
});

for (const mode of ["production", "test"]) {
  test(`email fails without logging sign-in links in ${mode}`, async (t) => {
    env.NODE_ENV = mode;
    const log = t.mock.method(console, "log", () => {});
    await assert.rejects(
      app.sendEmail({ to: "test@example.invalid", subject: "Sign in", html: "synthetic-token" }),
      /Email delivery is not configured/,
    );
    assert.equal(log.mock.callCount(), 0);
  });
}
test("email retains the development fallback and configured delivery", async (t) => {
  const log = t.mock.method(console, "log", () => {});
  const message = { to: "test@example.invalid", subject: "Sign in", html: "synthetic-token" };
  assert.deepEqual(await app.sendEmail(message), { id: "dev" });
  assert.ok(log.mock.callCount() > 0);
  log.mock.resetCalls();
  env.NODE_ENV = "production";
  env.RESEND_API_KEY = "synthetic-mail-key";
  assert.deepEqual(await app.sendEmail(message), { id: "sent" });
  assert.equal(log.mock.callCount(), 0);
});
