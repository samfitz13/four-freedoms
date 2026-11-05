# freedom-four

**Four freedoms. One instrument.**

A personal instrument for Financial, Location, Time, and Health freedom.
Measure. Reflect. Compound.

Working name. Private beta.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack) · TypeScript strict
- **UI:** Daybreak design system · Tailwind CSS v4 · locally owned, shadcn-style components with Radix primitives · Manrope
- **DB:** Postgres 17 (local Docker) / **PlanetScale Postgres** in prod
- **ORM:** Drizzle ORM + drizzle-kit (schema-as-TS)
- **Auth:** [better-auth](https://www.better-auth.com) — magic link, DB-backed sessions
- **Email:** Resend (dev falls back to console log if `RESEND_API_KEY` is unset)
- **Tooling:** pnpm · ESLint · Prettier · Husky + lint-staged · commitlint

## Getting started

Requires Node 22, pnpm 9, and Docker.

```bash
pnpm install
cp .env.example .env.local          # fill in BETTER_AUTH_SECRET (openssl rand -base64 48)
pnpm db:up                          # start local Postgres in Docker
pnpm db:migrate                     # apply Drizzle migrations
pnpm dev                            # http://localhost:3000
```

In development, magic-link emails are logged to the server console when
`RESEND_API_KEY` is unset. Click the printed URL to sign in. Outside development,
email delivery fails without the key and never logs sign-in links.

## Scripts

| Command                 | Description                                                         |
| ----------------------- | ------------------------------------------------------------------- |
| `pnpm dev`              | Next.js in development (Turbopack)                                  |
| `pnpm dev:host`         | Next.js bound to 0.0.0.0 (LAN)                                      |
| `pnpm build`            | Production build                                                    |
| `pnpm start`            | Serve production build                                              |
| `pnpm lint`             | ESLint                                                              |
| `pnpm lint:fix`         | ESLint --fix                                                        |
| `pnpm typecheck`        | TypeScript, no emit                                                 |
| `pnpm check:boundaries` | Verify module-boundary lint rules against allowed/forbidden imports |
| `pnpm check:duplicates` | Detect copied blocks and reject new duplication                     |
| `pnpm test:paystub`     | Unit tests for paystub tax totals and take-home pay                 |
| `pnpm test:security`    | Isolated authorization, OAuth and email regression tests            |
| `pnpm format`           | Prettier write                                                      |
| `pnpm format:check`     | Prettier check                                                      |
| `pnpm db:up`            | Start local Postgres (docker compose)                               |
| `pnpm db:down`          | Stop local Postgres                                                 |
| `pnpm db:logs`          | Follow Postgres logs                                                |
| `pnpm db:generate`      | Generate migration SQL from schema diff                             |
| `pnpm db:migrate`       | Apply pending migrations                                            |
| `pnpm db:push`          | Push schema without writing a migration (dev iteration)             |
| `pnpm db:studio`        | Open Drizzle Studio                                                 |
| `pnpm tunnel`           | Expose localhost:3000 via Cloudflare quick tunnel                   |
| `pnpm share`            | Run `dev` + `tunnel` together (public `*.trycloudflare.com` URL)    |

Security regression tests execute the actual server actions and readers against
disconnected adapters. They do not access a live database, email provider or Google account.

### Unit tests

TypeScript unit tests use `node:test` with `tsx` and live beside the code as
`*.test.ts`. `pnpm test:paystub` runs only `lib/freedoms/paystub-math.test.ts`,
covering federal and multi-state withholding, optional leave/disability/local
taxes, individual employee deductions, other income, fractional amounts and
input preservation. It exercises the actual calculation functions without a
database, environment secrets or external services.

The **Paystub unit tests** workflow runs the same focused command on pull
requests and pushes to main. To run another existing unit file directly, use
`pnpm exec tsx --test <path-to-file.test.ts>`. This does not run the browser QA
or security regression harnesses.

### Module boundaries

`pnpm lint` enforces the dependency direction with `import/no-restricted-paths`
from the existing Next.js ESLint preset:

| Layer                  | Allowed local dependencies                                  |
| ---------------------- | ----------------------------------------------------------- |
| `app/`                 | Components and libraries                                    |
| `components/freedoms/` | Shared UI primitives, other domain components and libraries |
| `components/ui/`       | Other UI primitives and `lib/utils.ts`                      |
| `lib/`                 | Other libraries, never routes or components                 |

UI primitives receive domain data and callbacks through props. Keep domain
formatting, authentication and database access in callers rather than pulling
them into a reusable control. External packages remain available to each layer;
these rules do not replace Next.js server/client checks.

Rules resolve actual paths through `tsconfig.json`, so `@/` aliases and relative
imports have the same restrictions. Type-only imports, re-exports and literal
`import()`/`require()` calls are checked too; computed module paths are not
statically resolved.

Run `pnpm check:boundaries` to verify the rules themselves against in-memory
positive and negative cases. It does not execute application modules or need
database credentials. The **Module boundaries** workflow runs this regression
check and repository-wide lint on PRs and pushes to main.

### Duplicate-code checks

Run `pnpm check:duplicates` before submitting changes. The pinned jscpd detector
scans TypeScript, JavaScript and CSS throughout `app/`, `components/`, `lib/`
and `scripts/`, including tests. Blocks must span at least 10 lines and
100 tokens, so small framework conventions do not dominate the findings.
No source directories or clone pairs are excluded.

`.jscpd-baseline.json` records existing duplicate blocks as technical debt.
The check still reports those blocks, but exits nonzero for **any new clone**
or an empty scan. This is a fingerprint baseline, not a percentage budget that
allows duplication to grow with the codebase. Prefer extracting shared behavior
when a new clone is reported; do not add ignore markers or relax the thresholds.

The **Duplicate code** GitHub Actions workflow runs the same command on pull
requests and pushes to main. Its `duplication-report` artifact retains the JSON
report for 14 days. Locally, findings are printed with file locations and saved to
`reports/duplication/jscpd-report.json`; generated reports are not committed.

When a deliberate refactor changes or removes existing clones, review the report
and regenerate the baseline with:

```bash
pnpm exec jscpd --config .jscpd.json --baseline .jscpd-baseline.json --update-baseline
pnpm check:duplicates
```

Review the baseline diff alongside the refactor. Do not regenerate it merely to
accept newly copied code; additions require an explicit rationale in the PR.

## Environment variables

See `.env.example` for the full list. Minimum for local dev:

| Var                    | Purpose                                            |
| ---------------------- | -------------------------------------------------- |
| `DATABASE_URL`         | Postgres connection (defaults to local docker)     |
| `BETTER_AUTH_SECRET`   | 32+ byte random secret — `openssl rand -base64 48` |
| `NEXT_PUBLIC_SITE_URL` | Used for auth callback construction                |
| `RESEND_API_KEY`       | Required for delivery outside development.         |
| `EMAIL_FROM`           | `"freedom-four <noreply@…>"` format                |

## Sharing the dev server with another machine

Use the built-in Cloudflare quick tunnel (requires `cloudflared` on `$PATH`):

```bash
pnpm share
```

This prints a public `https://<random>.trycloudflare.com` URL that proxies to
`http://localhost:3000`. Ephemeral, no account needed.

## Layout

```
app/
  (marketing)            # public landing
  (auth)/login           # magic-link sign-in
  (app)/                 # protected app group (dashboard, [freedom], settings)
  api/auth/[...all]      # better-auth catch-all route handler
components/              # UI primitives, freedom widgets
lib/
  auth.ts                # better-auth server config
  auth-client.ts         # better-auth browser client
  auth-server.ts         # getSession / requireUser helpers
  db/
    client.ts            # Drizzle client (postgres.js driver, cached pool)
    schema.ts            # Drizzle schema (auth + app tables)
  env.ts                 # Zod-validated env
  email.ts               # Resend wrapper with dev fallback
  freedoms/              # Per-freedom modules (shared interface)
drizzle/                 # Generated SQL migrations
docker/compose.dev.yml   # Local Postgres
proxy.ts                 # Next 16 proxy (session-gate for protected routes)
```

Workspace tabs use `/section/tab`, for example `/financial/goals`,
`/location/travel`, and `/time/agenda?view=week`. Section roots redirect to
`/section/overview`. Existing `?tab=` bookmarks permanently redirect to the
matching path and retain filters such as `month`, `year`, and `view`.

## Deploy

Target: **Vercel** for the app, **Supabase or PlanetScale Postgres** for the database,
and **Resend** for magic-link email.

### Supabase Postgres

Use the project's **Connect → Session pooler** connection string on port 5432,
with database `postgres`, user `postgres.<project-ref>`, and `sslmode=require`.
The IPv4-compatible session pooler works for both migrations and the app.
Keep prepared statements disabled and the production pool at one connection,
as configured in `lib/db/client.ts`. This app uses better-auth, not Supabase Auth.

On macOS, store the full connection string in Keychain and set only its service
name as `DATABASE_URL_KEYCHAIN_SERVICE` in `.env.local`. The `pnpm` app and
database commands resolve it at launch; an explicitly exported `DATABASE_URL`
takes precedence. On Vercel, set `DATABASE_URL` as a sensitive production
environment variable. Do not share the production database with preview
deployments; provision a separate database before configuring Preview.

Run `pnpm db:migrate` to initialize the database. `pnpm db:push` refuses remote
databases. Supabase's Data API must not expose the app's public-schema tables:
disable that API or revoke its roles' table access, since household isolation
is enforced by the server-side query layer rather than Supabase RLS.

### 1. Database — PlanetScale Postgres

Create a PlanetScale Postgres database (not the legacy MySQL product — this
app targets Postgres 17). In the PlanetScale dashboard:

1. **Create database** → Postgres. Pick the region closest to your Vercel
   deployment region for the lowest latency.
2. **Create a branch** named `main`, then a password for it. PlanetScale
   issues connection strings of the form
   `postgres://user:pass@<host>.connect.psdb.cloud/freedom_four?sslmode=require`.
3. Copy the connection string — this is your `DATABASE_URL`. PlanetScale
   pools connections at the edge, so no separate pooler URL is needed.

Apply migrations from your machine:

```bash
DATABASE_URL="<planetscale connection string>" pnpm drizzle-kit migrate
```

> Branching: PlanetScale supports dev/preview branches with their own
> connection strings. You can wire those into Vercel preview deployments so
> each PR gets an isolated database — add a second `DATABASE_URL` to the
> Preview environment only.

### 2. Resend

Create an API key and verify a sending domain. The magic-link "from" address
must be under a verified domain.

### 3. Vercel

Import the repo. Set environment variables in the project settings:

| Var                    | Value                                     |
| ---------------------- | ----------------------------------------- |
| `DATABASE_URL`         | Supabase or PlanetScale connection string |
| `BETTER_AUTH_SECRET`   | `openssl rand -base64 48`                 |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>`                   |
| `RESEND_API_KEY`       | From step 2                               |
| `EMAIL_FROM`           | `"freedom-four <noreply@yourdomain.com>"` |

Framework preset: **Next.js**. Build command: `pnpm build`. Install command:
`pnpm install --frozen-lockfile`. Output: default.

Because `lib/db/client.ts` uses `postgres.js` with a cached `globalThis`
pool, serverless cold starts reuse a single connection per instance — which
pairs well with PlanetScale's edge pooling. Keep `max: 1` on the
`postgres()` call in production to stay well inside connection budgets.

### 4. Custom domain

Point an A/CNAME record at Vercel, add it in Project → Domains, then update
`NEXT_PUBLIC_SITE_URL` to match. Magic-link callbacks are built from this URL.

## Roadmap

1. ✅ Scaffold (Next 16, Tailwind v4, tooling)
2. ✅ Auth + household bootstrap (better-auth + Drizzle + Postgres)
3. ✅ Typed Financial workspace (accounts, statements, income, transactions, FI goals)
4. ✅ Daybreak dashboard + per-freedom pages
5. ✅ Theme polish, landing copy, deploy recipe
6. ✅ Typed Location workspace (places, stays, satisfaction)
7. ✅ Typed Time workspace (agenda, habits, pursuits, time logs)
8. ✅ Typed Health workspace (sleep, training, energy)
9. Integrations: Strava/Apple Health (health)
10. Household (multi-user) surfaces
11. Export / archive
12. PostHog + Sentry
