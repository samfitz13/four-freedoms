# Dependency security review

Inspected 2026-11-05 against [Dependabot PR #6](https://github.com/samfitz13/four-freedoms/pull/6),
head `babe42cacf1e42fedcb5e92955927ace5bee4aac`. This is a local application of
reviewed updates, not a merged PR or evidence of a production deployment.

## Reviewed changes

| Dependency  | Previous lock | Reviewed lock | Risk and verification                                                                                                          |
| ----------- | ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| better-auth | 1.6.5         | 1.7.7         | Critical magic-link account takeover; in-memory tests cover verified session creation, expiry, replay and namespace separation |
| csv-parse   | 6.2.1         | 7.0.2         | Major-version update; tests cover normalized CSV fields and duplicate prototype-header safety                                  |
| Next.js     | 16.2.4        | 16.4.1        | Audit reports critical/high fixes; validate types, lint, API fixtures and disconnected production build                        |
| Zod         | 4.3.6         | 4.6.6         | Audit reports collection-validation denial of service; financial/schema regressions cover current app contracts                |

The local lock retains current repository tooling absent from the older
Dependabot base. It is not copied wholesale from that branch. It also raises
the direct PostCSS minimum to 8.5.32 and overrides `concurrently>shell-quote` to
the compatible patched 1.x range, removing a remaining critical advisory.
Re-evaluate that override when updating concurrently; remove it when the
parent's dependency range no longer needs it.

The installed auth adapters/plugins resolve to the 1.7.7 family. No custom
better-auth verification-identifier override or OAuth Proxy is configured.
The app's separate Google Calendar OAuth state uses its own
`google-calendar-oauth:` namespace.

## Release requirements

The [Better Auth 1.7.7 release guidance](https://github.com/better-auth/better-auth/releases/tag/v1.7.7)
requires servers sharing verification storage to upgrade together and users
to request fresh Magic Links/restart pending OAuth or SAML sign-ins. It says
no database migration is required for this security fix. This does not assert
that unrelated future package upgrades never need migrations.

The [GitHub-reviewed CSV advisory](https://github.com/advisories/GHSA-8cw4-87c7-c6xx)
describes prototype replacement with duplicate `__proto__` headers when both
`columns` and `group_columns_by_name` are enabled. The app currently normalizes
headers through a `columns` callback and does not enable grouping; upgrading
still removes the vulnerable parser behavior.

## Audit boundary

`pnpm audit --json` before these edits reported **8 critical, 60 high,
26 moderate and 9 low** findings. The initial reviewed updates and scoped
shell-quote override reduced that to **0 critical, 25 high, 10 moderate and 5 low**.
The high-severity follow-up below now reports **0 critical, 0 high,
3 moderate and 3 low**.
These are package/advisory counts from pnpm, not confirmed exploitable app bugs.
The full audit still exits nonzero and must not be described as clean;
`pnpm audit --audit-level high` checks the requested high/critical threshold.

## High-severity follow-up

Version-bounded pnpm overrides lift vulnerable transitive copies to patched
versions within the same major release. They do not exclude advisory IDs or
filter out development dependencies.

| Package         | Vulnerable installed version | Patched lock version |
| --------------- | ---------------------------- | -------------------- |
| brace-expansion | 1.1.14 / 5.0.5               | 1.1.21 / 5.0.12      |
| js-yaml         | 4.1.1                        | 4.3.2                |
| fast-uri        | 3.1.0                        | 3.1.9                |
| browserslist    | 4.28.2                       | 4.29.5               |
| source-map-js   | 1.2.1                        | 1.2.2                |

The remaining high finding was Zod 3.25.76, required by
`eslint-plugin-react-compiler` through `@factory/eslint-plugin`. Neither parent
has a newer published stable release that fixes that dependency. Forcing Zod 4
into that old plugin would violate its declared API requirements.

Instead, the scoped override
`"@factory/eslint-plugin>eslint-plugin-react-compiler": "-"`
removes that unused dependency and its Zod 3/error-formatting packages.
The repository imports Factory's custom rules directly, not its legacy
frontend preset. That preset is already documented as incompatible with this
stack in `eslint.config.mjs`; do not enable it while this override is present.
The active Factory and Next.js configurations are unchanged.
`scripts/dependency-safety.test.mjs` verifies actual Factory rule violations,
conditional hooks and Next's compiler-backed immutability diagnostics still
produce errors. CI runs those regressions.

Re-evaluate these overrides when updating their parents, and remove them once
the parent dependency graph no longer requires the repair. Do not replace the
legacy compiler plugin with an unrelated package alias or disable lint rules.

Remaining moderate/low findings are esbuild (Drizzle tooling and tsx), Babel,
deepmerge, glob and minimatch. They remain visible in the full audit. Further
fixes need parent upgrades or compatibility work, not blind major overrides.

Tests exercise memory/disconnected adapters and synthetic files. They do not
prove production Drizzle concurrency, live mail delivery or authenticated
browser behavior. Run the [repository verification skill](../../.factory/skills/apply-repo-verification/SKILL.md)
and report actual outcomes before releasing.
