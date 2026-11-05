---
name: apply-repo-verification
description: >-
  Verify four-freedoms changes with isolated tests and a synthetic build. Use when choosing regression checks or validating a local handoff. NOT for deployment, migrations, or readiness audits.
metadata:
  version: "1.0.0"
---

# Verify a four-freedoms change

Produce evidence that matches the affected behavior, without touching real
household data or external providers. This workflow verifies changes; it does
not implement fixes, commit, push, open a PR, or deploy.

## 1. Establish scope

- Read root `AGENTS.md` and any instructions nearer the affected files.
  Those instructions and `package.json` are authoritative, not this checklist.
- Confirm the repository root, working-tree status, and intended change using
  `git status --short`, `git diff --stat`, and `git diff --cached --stat`.
  Inspect the changed files and their colocated tests. Include relevant untracked
  files without reading `.env` contents or generated/user-data artifacts.
- If a branch comparison is requested, use its agreed base. If no change/base is
  apparent, ask what to verify rather than guessing or scanning every test.
- Preserve existing edits. Never reset, clean, overwrite fixtures, lower coverage
  thresholds, add lint ignores, or raise debt/duplication budgets to turn a check green.

## 2. Choose the smallest relevant regression set

Run commands from the repository root. Quote paths containing parentheses or
brackets, for example:

```sh
pnpm test:unit 'app/(app)/[freedom]/routing.test.ts'
```

Use registered package scripts instead of invoking TypeScript tests directly:

| Changed behavior                                               | Additional verification                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Paystub taxes or take-home pay                                 | `pnpm test:paystub`                                                             |
| FI calculations/settings, portfolio validation, or chart model | `pnpm test:coverage`                                                            |
| Server actions, scoped readers, OAuth or email                 | `pnpm test:security` and relevant colocated tests                               |
| Unit launcher, worker or environment policy                    | `pnpm test:isolation`                                                           |
| API contracts/routes                                           | `pnpm test:unit scripts/api-contract.test.mjs`                                  |
| Agent documentation/configuration                              | `pnpm check:docs` and `pnpm test:unit scripts/check-agent-docs.test.mjs`        |
| Devcontainer setup                                             | `pnpm test:unit scripts/devcontainer-setup.test.mjs`                            |
| Maintainability policy or reports                              | `pnpm test:unit scripts/maintainability.test.mjs scripts/ci-reporting.test.mjs` |
| Module-boundary configuration                                  | `pnpm check:boundaries`                                                         |
| UI presentation or interactions                                | Select relevant fixture checks from `scripts/daybreak-qa/README.md`             |

Multiple rows can apply. For source changes, also run
`pnpm check:maintainability` and `pnpm check:duplicates`. Check registration before
running commands if the manifest has changed. Do not substitute live smoke/import,
seed, migration or calendar-sync scripts for disconnected regressions.

For timing investigations, use `pnpm test:timings <suite-or-test-paths>` with
the same selection. Reports under `reports/` remain local artifacts; nested
timings overlap and are not a standalone regression verdict.

## 3. Run required gates

Always run `pnpm typecheck` and `pnpm lint`. When routes, components, configuration
or feature work require a production build, follow
[the disconnected build procedure](references/disconnected-build.md).
Never run a plain build against an inherited provider/database environment.

Use bounded command timeouts and preserve exit statuses. If a check fails,
inspect the failure and report it. Do not silently retry, autofix source during
a verification-only request, or mark a failed gate complete. A pre-existing
failure needs evidence from the agreed base, not an assumption.

## 4. Hand off evidence

Report the revision/scope, exact commands and outcomes, skipped checks with
reasons, and remaining blockers. Distinguish fixture/component verification
from authenticated end-to-end behavior. No disconnected check proves live
database writes, provider integration, or deployment readiness.

When maintaining this skill, use `evals/trigger-tests.yaml` as routing cases and
smoke-test the documentation row above. Keep new instructions grounded in the
current manifest and source rather than copying application logic here.
