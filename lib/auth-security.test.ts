import assert from "node:assert/strict";
import { test } from "node:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { magicLink } from "better-auth/plugins";

function fixture() {
  const records: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  const delivered: string[] = [];
  const auth = betterAuth({
    baseURL: "http://localhost:3000",
    secret: "synthetic-auth-regression-secret-not-for-deployment",
    database: memoryAdapter(records),
    telemetry: { enabled: false },
    plugins: [
      magicLink({
        expiresIn: 15 * 60,
        sendMagicLink: async ({ url }) => {
          delivered.push(url);
        },
      }),
    ],
  });
  async function issue() {
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "fixture@example.invalid", callbackURL: "/" }),
      }),
    );
    assert.equal(response.status, 200);
    const url = delivered[0];
    const pending = records.verification?.[0];
    assert.ok(url);
    assert.ok(pending);
    assert.match(String(pending.identifier), /^magic-link:/);
    return { url, pending };
  }
  return { auth, records, issue };
}

test("upgraded magic links create a verified session and refuse token reuse", async () => {
  const { auth, issue } = fixture();
  const { url } = await issue();
  const response = await auth.handler(new Request(url));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "http://localhost:3000/");
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
  assert.equal(session?.user.email, "fixture@example.invalid");
  assert.equal(session?.user.emailVerified, true);
  const replay = await auth.handler(new Request(url));
  assert.match(replay.headers.get("location") ?? "", /error=INVALID_TOKEN/);
  assert.equal(replay.headers.get("set-cookie"), null);
});

test("expired magic links cannot create sessions", async () => {
  const { auth, records, issue } = fixture();
  const { url, pending } = await issue();
  pending.expiresAt = new Date(Date.now() - 1000);
  const response = await auth.handler(new Request(url));
  assert.match(response.headers.get("location") ?? "", /error=INVALID_TOKEN/);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(records.session?.length, 0);
});

for (const namespace of ["auth-state:", ""]) {
  test(`verification namespace ${JSON.stringify(namespace)} cannot be redeemed as a magic link`, async () => {
    const { auth, records, issue } = fixture();
    const { url, pending } = await issue();
    pending.identifier = namespace + new URL(url).searchParams.get("token");
    const response = await auth.handler(new Request(url));
    assert.match(response.headers.get("location") ?? "", /error=INVALID_TOKEN/);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(records.session?.length, 0);
    assert.equal(records.user?.length, 0);
  });
}
