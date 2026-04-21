# freedom-four

**Four freedoms. One instrument.**

A personal instrument for Financial, Location, Time, and Health freedom.
Measure. Reflect. Compound.

Working name. Private beta.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack) · TypeScript strict
- **UI:** Tailwind CSS v4 + custom editorial theme (serif display, ink/paper neutrals, per-freedom accents)
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

No `RESEND_API_KEY`? Magic-link emails are logged to the server console —
click the printed URL to sign in.

## Scripts

| Command             | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm dev`          | Next.js in development (Turbopack)                               |
| `pnpm dev:host`     | Next.js bound to 0.0.0.0 (LAN)                                   |
| `pnpm build`        | Production build                                                 |
| `pnpm start`        | Serve production build                                           |
| `pnpm lint`         | ESLint                                                           |
| `pnpm lint:fix`     | ESLint --fix                                                     |
| `pnpm typecheck`    | TypeScript, no emit                                              |
| `pnpm format`       | Prettier write                                                   |
| `pnpm format:check` | Prettier check                                                   |
| `pnpm db:up`        | Start local Postgres (docker compose)                            |
| `pnpm db:down`      | Stop local Postgres                                              |
| `pnpm db:logs`      | Follow Postgres logs                                             |
| `pnpm db:generate`  | Generate migration SQL from schema diff                          |
| `pnpm db:migrate`   | Apply pending migrations                                         |
| `pnpm db:push`      | Push schema without writing a migration (dev iteration)          |
| `pnpm db:studio`    | Open Drizzle Studio                                              |
| `pnpm tunnel`       | Expose localhost:3000 via Cloudflare quick tunnel                |
| `pnpm share`        | Run `dev` + `tunnel` together (public `*.trycloudflare.com` URL) |

## Environment variables

See `.env.example` for the full list. Minimum for local dev:

| Var                    | Purpose                                            |
| ---------------------- | -------------------------------------------------- |
| `DATABASE_URL`         | Postgres connection (defaults to local docker)     |
| `BETTER_AUTH_SECRET`   | 32+ byte random secret — `openssl rand -base64 48` |
| `NEXT_PUBLIC_SITE_URL` | Used for auth callback construction                |
| `RESEND_API_KEY`       | Optional. Dev falls back to console log if unset.  |
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
  (app)/                 # protected app group (dashboard, review, settings)
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

## Deploy

Target: **Vercel** for the app, **PlanetScale Postgres** for the database,
and **Resend** for magic-link email.

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
| `DATABASE_URL`         | PlanetScale connection string from step 1 |
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
3. ✅ Data model: freedom_settings, entries, goals, weekly_reviews
4. ✅ Freedom abstraction + unified dashboard
5. ✅ Daily check-in + entry logging
6. ✅ Weekly review flow
7. ✅ Theme polish, landing copy, deploy recipe
8. Integrations: Plaid (financial), Strava/Apple Health (health)
9. Goals + goal-linked entries
10. Household (multi-user) surfaces
11. Export / archive
12. PostHog + Sentry
