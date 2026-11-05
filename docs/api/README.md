# HTTP API contracts

[`openapi.json`](openapi.json) describes the two application-owned calendar
route handlers, their session cookies, OAuth parameters, success shapes,
redirects and error behavior. Import it into an OpenAPI viewer or API client.
The server URL is relative to the application origin; no production hostname
or credential is embedded.

Both endpoints verify the server session and restrict work to its primary
household. A missing session redirects to sign-in rather than returning JSON 401. Browser clients must not treat a followed login response as success.
Google credentials are optional: sync returns zero when they are not configured.
Calendar sync makes real external calls and writes records; do not exercise it
against a real account during documentation validation.

The callback is used only in the Google connection flow initiated from Time.
Do not manufacture OAuth state or put tokens in examples. State is session-bound,
household-bound, expiring and single-use. Cancelling authorization also consumes it.

## Authentication and server actions

`app/api/auth/[...all]/route.ts` delegates GET and POST to better-auth. Its
session, magic-link and sign-out contracts are owned by the installed better-auth
version and configured plugins in `lib/auth.ts`; use the typed client in
`lib/auth-client.ts` instead of duplicating vendor payloads. Email/password auth
is disabled. Development sign-in uses the console magic-link fallback described
in the root README.

This is deliberately a calendar integration specification, not an exhaustive
schema for every vendor auth endpoint. Do not assume omitted endpoints are
unsupported. Next.js server actions are internal framework calls, not stable
REST APIs and are not described as public HTTP operations.

## Keeping contracts accurate

Run `pnpm test:unit scripts/api-contract.test.mjs` after changing a calendar
route or this specification. It validates OpenAPI syntax and local references,
checks the documented handler methods/paths, and compares response schemas
with synthetic values from the actual route handlers using disconnected
adapters. The documentation workflow runs these tests without a database or
provider account. Update this contract alongside changes to auth, redirects,
query parameters, responses or rate-limit behavior.
