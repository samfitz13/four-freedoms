# Maintainability and technical debt

Run `pnpm check:maintainability` before handing off source changes. CI runs the
same gate and retains its JSON report for 14 days. No application modules,
environment files, database connections or providers execute during analysis.

## Limits

- ESLint classic cyclomatic complexity: **20 per function**, including
  short-circuit expressions, optional chaining and default parameters.
- Authored JS/TS source: **500 physical lines**, including comments and blanks,
  and **128 KiB** per file. An empty file has zero lines; a final newline does
  not count as an extra line.
- All tracked and non-ignored untracked repository files: **5 MiB** per file.
  This also covers binaries, documentation, migrations and lockfiles.

Authored source includes root JS/TS configuration files and code under `app/`,
`components/`, `lib/`, `scripts/` and `.devcontainer/`, including tests and QA
fixtures. Generated migrations are not function/line analyzed. ESLint's existing
configuration and parser remain the source of truth; no new lint ignores or
rule-disable comments are introduced.

## Existing debt, not hidden exceptions

The initial measurement found 25 functions above 20 and 12 source files above
500 lines. [`debt.json`](debt.json) records each measured hotspot with its
GitHub owner, priority, current budget and an actionable refactoring plan.
These are still reported, not claimed to be within the default thresholds.
The gate rejects new hotspots and any growth in existing ones.

When a hotspot improves but still exceeds the default, lower its recorded
budget to the new measured value. When it is gone or within the default, mark
the entry `closed`. Stale entries fail CI, preventing debt records from silently
turning into permanent allowances. Renaming a function requires reviewing its
register identity; repeated anonymous labels in one file fail rather than sharing
a budget. The gate compares the register with the PR's base branch (or the
previous commit on main pushes), rejecting increased budgets and new/reopened
legacy allowances. Locally it compares with `origin/main`, so fetch that branch
before running it. Rename legacy functions after bringing them within the limit.
There is deliberately no baseline-regeneration command.

Refactor a hotspot in a focused change with the relevant behavioral tests.
Separate presentation, validation and calculations without changing household,
auth, money or calendar semantics. Do not split code solely to move its line count.

## Tracking new work

Code comments may use `TODO(DEBT-001): concrete explanation` (also `FIXME`,
`HACK` or `XXX`). Every marker must reference an **open** register entry with an
owner, priority, real source path, summary and remediation plan. For work unrelated
to a complexity/line budget, use kind `maintenance` without a budget.

Only parsed comments are checked: words in strings, URLs, fixtures or regexes are
not debt markers. Closed or unknown IDs and bare markers fail CI. Review the
open register when planning maintenance; close completed work and keep its history.

The metrics report contains paths, function labels, counts and debt metadata, not
source text or environment values. It is ignored locally. This is a maintainability
gate, not a proof of correctness or a cognitive-complexity measurement.

## CI summaries and test performance

The workflow summary shows complex-function, oversized-source and open-debt
counts, plus gate errors. The retained JSON provides the individual measured
hotspots, owners and plans. These counts track debt, not an assertion that
existing hotspots meet the default limits.

`pnpm test:timings` uses the same isolated unit runner and failure propagation
as `pnpm test:unit`. It accepts the same file/suite selections and writes
`reports/tests/timings.json` with elapsed time and per-test status/duration.
CI runs the financial suite and maintainability/reporting regressions, retains
timings for 30 days (also on test failure), and lists the ten slowest results
in the workflow summary. Compare matching tests across runs before investigating
regressions; nested/file durations overlap and are not additive. There are no
retries, skipped failures or arbitrary performance thresholds.

Reports omit assertion details, console output and environment values, but test
names and file paths are included. Use synthetic test names. A killed worker
may not produce a timing artifact; its CI run still fails.
