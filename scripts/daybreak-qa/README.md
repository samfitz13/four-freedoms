# Daybreak verification

These checks render the actual application components with synthetic query
results and disconnected action adapters. They never connect to a database,
load credentials, seed records, or attach to an existing browser session.

## Run

From the repository root, with dependencies already installed:

```sh
pnpm build
node scripts/daybreak-qa/build.mjs
python3 scripts/daybreak-qa/check.py screenshots/daybreak-rollout-OUTPUT
python3 scripts/daybreak-qa/ui-primitives.py screenshots/daybreak-rollout-OUTPUT
python3 scripts/daybreak-qa/wealth.py screenshots/daybreak-rollout-OUTPUT
python3 scripts/daybreak-qa/contrast.py screenshots/daybreak-rollout-OUTPUT
python3 scripts/daybreak-qa/habits.py screenshots/daybreak-rollout-OUTPUT
python3 scripts/daybreak-qa/financial-overview.py screenshots/daybreak-rollout-OUTPUT
python3 scripts/daybreak-qa/goals.py screenshots/daybreak-rollout-OUTPUT
python3 scripts/daybreak-qa/charts.py screenshots/daybreak-rollout-OUTPUT
python3 scripts/daybreak-qa/scenarios.py screenshots/daybreak-rollout-OUTPUT
python3 scripts/daybreak-qa/fi-retirement.py screenshots/daybreak-rollout-OUTPUT
node scripts/daybreak-qa/fi-adapter-check.mjs
node scripts/daybreak-qa/archive-check.mjs
python3 scripts/daybreak-qa/settings.py screenshots/daybreak-rollout-OUTPUT
python3 scripts/daybreak-qa/travel.py screenshots/daybreak-rollout-OUTPUT
pnpm exec tsx 'app/(app)/[freedom]/_time/habit-view.test.ts'
pnpm exec tsx 'app/(app)/[freedom]/_location/travel-view.test.ts'
pnpm exec tsx 'app/(app)/[freedom]/routing.test.ts'
pnpm exec tsx --test lib/financial/portfolio/atlas.test.ts
pnpm exec tsx --test components/freedoms/financial/fi-chart-model.test.ts
pnpm exec tsx --test lib/freedoms/fi-contributions.test.ts
pnpm exec tsx --test lib/freedoms/fi-scenarios.test.ts
pnpm exec tsx --test lib/freedoms/fi-plan.test.ts
pnpm exec tsx --test lib/profile/birth-date.test.ts
pnpm exec tsx --test lib/freedoms/wealth.test.ts
pnpm typecheck
pnpm lint
```

Replace `OUTPUT` with the directory printed by the fixture builder. The Python
checks require Playwright with headless Chromium and Pillow. The builder uses
the existing esbuild dependency provided through tsx; it installs nothing.
Executable server bundles go to an OS temporary directory. Browser bundles,
fonts, and imagery are embedded in isolated fixtures.

## Coverage

- 54 rendered variants: all 23 workspace tabs, extra week/month agenda views,
  dashboard, Patterns, weekly review, Settings, import, landing, login,
  not-found, error, nine representative empty states, four financial
  attention states (clear, empty, review, and missing data), and FI plans with
  no statements, a manual contribution override, age labels, or an unreached target within
  the 50-year horizon, retirement, missing allocation, and a short retirement horizon.
- Workspace fixtures render `/section/tab` pages. Routing tests check all
  23 tab definitions, legacy permanent redirects, invalid section handling,
  preserved query filters, and sign-in return paths.
- Layouts at 320, 390, 768, and 1440px, in light and dark mode. Blade target
  sizes, contained overflow, and 200% desktop text resizing.
- Actual appearance controls and startup script, including stored preferences
  after reload; blade keyboard navigation; dialog focus and dismissal; menu
  positioning and keyboard behavior; date and money serialization.
- `ui-primitives.py` verifies the Radix adapters at 320, 390, and 1440px in
  both themes: route-link semantics, slotted buttons, non-submitting button
  defaults, portaled menu submission with native validation, typeahead,
  menu-to-dialog focus restoration, nested overlays, and outside dismissal.
  It also checks shared select/textarea serialization, explicit field labels,
  and local Escape handling for in-flow calendars and delete confirmations.
- `wealth.py` checks the year-to-date label and categorical allocation palette
  at 320–1440px in both themes, with visible names, percentages, slice boundaries,
  and sampled color separation. YTD unit tests verify the previous-December
  baseline, January and UTC rollover, decreases, zero balances, missing data,
  unordered points, and future-month exclusion.
- Actual account form with native required validation, mocked server error,
  pending and success states. Confirm/cancel deletion runs only a mock action.
  All four health entry forms are checked for switching and fit.
- `contrast.py` samples HTML text over rendered surfaces at 390 and 1440px in
  both themes. It converts computed OKLCH colors through canvas, accounts for
  opacity, and excludes hidden, clipped, disabled, and decorative content.
- `habits.py` checks populated and empty habit screens at 320, 390, 768,
  1024, and 1440px in both themes, including expanded history and forms.
  It exercises check-in payloads, pending locks, errors/retry, keyboard focus,
  read-only linked habits, creation/editing, and archive confirmation with
  mocked actions. Legacy sources and unavailable pursuits stay intact when
  editing. Habit date tests cover UTC boundaries, duplicate check-ins, future
  dates, and days before a habit starts.
- `financial-overview.py` verifies attention visibility, a full-width notes
  layout when attention is hidden, compact borderless metrics, preserved
  values, and responsive/text-resize behavior in both themes.
- `goals.py` checks compact FI metrics, manual and linked milestones, achieved
  goals, savings rates, expanded controls, and responsive layouts in both
  themes. It exercises goal types, account selection, assumption overrides,
  validation, error retention, pending saves, serialization, and dialog focus
  with mocked actions. It does not claim server data refresh or database writes.
  Automatic FI contributions use recorded investment contributions over the
  past 12 completed calendar months, including employer matches. Only months
  with all included accounts are averaged; coverage is labeled. No recent history leaves the forecast
  unavailable until statements or a manual override are supplied. The override
  switch preserves its amount when toggled and on validation errors.
- `charts.py` exercises the actual responsive FI chart at 320–1440px in both
  themes: direct keyboard and touch inspection without a separate range slider,
  full/near-term views, goal selection,
  shared target months, undated and out-of-range goals, missing history,
  unreached and already-met thresholds, one-point plans, forced colors, print,
  and 200% desktop text. Model tests cover calendar dates, missing months,
  negative balances, real compounding, and the 50-year horizon. Goal annotations
  do not alter projected balances. Forecasts now start at the latest recorded
  statement, rather than the earliest; historical balances remain nominal.
- `scenarios.py` checks base, downside, and upside comparisons at
  320–1440px in both themes, with keyboard/touch controls, 200% desktop text,
  forced colors, and print. Available scenarios appear simultaneously on shared
  axes, with matching line keys, return rates, and FI dates. Inspection shows
  each scenario's balance at the same month; higher returns produce higher
  balances and earlier crossings. Comparisons preserve goal annotations and
  never save assumptions. Short/missing history never disables a planning line.
  Solid, distinct scenario colors and matching endpoint shapes share the full
  selected horizon, continuing past the first FI crossing. Forced colors uses
  pattern fallbacks. Age labels use the signed-in user's birth date; missing
  birth dates retain calendar labels. Date tests cover birthdays and leap days.
  Already-met and unreached targets retain honest labels. Retirement fixtures
  check depletion markers, cumulative shortfalls, and deterministic shock ordering.
- `fi-retirement.py` exercises actual portfolio presets, account allocation,
  explicit snapshot consent (unknown quote dates, reconstructed cash, and
  mismatched dates), age/month timing, and input retention after failed saves.
  It covers 320, 390, and 1440px, both themes, 200% text resizing, and forced colors.
  `fi-adapter-check.mjs` executes the actual Goals and Overview server functions
  and shared adapter with disconnected reads, asserting identical inputs/results.
  Neither test connects to a database or authenticates.
- FI model tests cover classification, statement-only balances, complete
  account/month coverage, currency blocking, expenses and inflation, zero
  contributions, retirement boundaries, delayed income, depletion, persistent
  shortfalls, first crossings, shock ordering, and legacy manual parsing.
  Historical returns remain retrospective diagnostics only.
- `settings.py` verifies the birth-date form, future-date validation, clearing,
  error retention, and pending/success states using mocked actions. Appearance
  controls live in Settings rather than the app header; theme and glass choices
  survive reload. The generated birth-date migration is not applied by QA.
- `travel.py` checks the actual Travel workspace at 320–1440px in both themes,
  with upcoming and past trips, destination search, year filters, itinerary
  disclosures, saved budgets and notes, empty states, and 200% desktop text.
  Creation, editing, error retention, pending saves, date serialization, and
  archive confirmation use disconnected actions. The date and history tests
  cover UTC boundaries, overlapping stays, future visits, archived trips, and
  missing budgets. These checks do not verify database writes or calendar sync.

The scripts produce `coverage.json`, `layout-results.json`, `results.json`,
`contrast-results.json`, `habit-results.json`, `goal-results.json`, `chart-results.json`,
`scenario-results.json`,
`settings-results.json`, `ui-primitives-results.json`,
`travel-results.json`, and representative screenshots in the output folder.
`--interactions-only` skips the layout loop for focused debugging.

## Limits

`archive-check.mjs` exercises the actual archive action, financial readers,
FI saving, and archived-account input guards against an in-memory ORM adapter.
It checks unchanged history, last-known balances without inserted statements,
read-only FI account coverage, and blocked manual and CSV input. It does not
connect to Postgres or establish authenticated end-to-end behavior.

This is component-level verification, not authenticated end-to-end testing.
Next routing, authentication, data adapters, and third-party integrations are
mocked. Some record lists intentionally use empty data; the fixtures do not
cover every populated ledger, grant, property, or calendar combination.

Contrast sampling is not a WCAG certification. It does not certify SVG chart
marks, every transient state, screen-reader output, or every background pixel.
Browser automation uses isolated Chromium, not a cross-browser matrix.
Production dialogs and menus use Radix primitives with portaled surfaces.

No fixture data belongs in production. No action here verifies or authorizes
real financial imports, record deletion, account changes, or deployment.
