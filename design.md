# Daybreak

Four freedoms. A little more room.

Daybreak is the app-wide design language for Freedom-four. Audience,
personality, and principles live in `.impeccable.md`. This guide describes
implementation. Earlier ceramic and editorial styling is retired; standalone
concepts remain references, not production routes or data sources.

## Foundations

Use semantic tokens in `app/globals.css`:

| Role           | Light              | Dark                |
| -------------- | ------------------ | ------------------- |
| Ground         | Warm ivory and oat | Warm charcoal       |
| Shell          | Translucent cream  | Smoked glass        |
| Panels         | Readable ivory     | Warm brown charcoal |
| Primary text   | Brown ink          | Warm ivory          |
| Secondary text | Deep taupe         | Light warm gray     |
| Accent         | Coral and copper   | Apricot and copper  |

`--glass-shell`, `--glass-panel`, `--glass-control`, `--glass-stroke`, and
`--glass-rim` define material. `--glass-primary` and `--glass-primary-ink` are a
paired button treatment. `--control-border` keeps input edges distinguishable.
Freedom color tokens provide accents, not the sole identity of a destination.

The backdrop is local: `public/daybreak/backdrop.webp`. It is decoration,
never a carrier of information. Use one fixed scene and one main shell, not
many overlapping blur layers. Keep text and charts sharp.

Manrope supplies display and interface type through `next/font`; JetBrains
Mono is reserved for code and identifiers. The production app does not fetch
fonts from Google in the browser. Use sentence case, fluid headings, tabular
numbers, and right-aligned financial columns. Avoid tiny uppercase eyebrows.

## Layout and navigation

`app/(app)/layout.tsx` owns the protected shell. `app-nav.tsx` owns five blades:
Home, Financial, Location, Time, Health. Patterns, weekly review, Settings,
and sign out remain separate utility actions.

Desktop uses a left rail. Mobile presents all five blades above the workspace;
the narrowest screens wrap the blades rather than shrinking their labels.
Use `aria-current`, visible focus, and an active shape, not color alone.
Arrow navigation runs only from a focused blade.

`WorkspaceTabs` uses `/section/tab` URLs, such as `/financial/goals` and
`/location/travel`. Section roots and legacy `?tab=` URLs redirect to those
paths, preserving other query parameters. Month, year, and calendar view
remain query filters. Tabs wrap instead of hiding destinations. Existing
numeric shortcuts remain scoped away from typing and overlays.

Home uses unequal card widths and domain-specific primary measurements.
Scores remain explicitly labeled scores. Unknown measurements keep their
empty-state action; never fill the home screen with sample values.

## Shared primitives

| Primitive                           | Use                                                   |
| ----------------------------------- | ----------------------------------------------------- |
| `daybreak-panel`                    | A major section, chart, or grouped record set         |
| `daybreak-inset`                    | Subordinate controls or a small contextual group      |
| `daybreak-button`                   | Capsule action with a comfortable target              |
| `daybreak-button-primary`           | The main action, paired foreground/background         |
| `daybreak-field`                    | Inputs and selects with clear edges                   |
| `daybreak-table`                    | Dense information with contained horizontal scrolling |
| `daybreak-tabs` / `daybreak-tab`    | Workspace and local view selection                    |
| `daybreak-popover`                  | Calendar and menu surfaces                            |
| `daybreak-public` / `daybreak-auth` | Public, login, and recovery pages                     |

Prefer whitespace and separators inside a panel rather than more panels.
Retain dense tables, ledger grids, form validation, and detail disclosures.
Do not convert each record to a large decorative card.

Components in `components/ui/` follow shadcn's locally owned component model,
with Radix Dialog, Dropdown Menu, and Slot providing interaction behavior.
`components.json` configures the component aliases; keep Daybreak tokens and
classes when adding components rather than importing a stock theme.
Use `Button`, `Input`, `NativeSelect`, `Textarea`, and `Label` for new controls.
`Field` pairs a single control with an explicit label and generated ID;
custom controls such as `DateInput` must pass that ID to their actual input.
Keep hidden inputs native. Keep calendar day targets compact.
`NativeSelect` preserves browser selection and native form validation.
`Button` defaults to
`type="button"`; opt into `type="submit"` for form actions. `TabNav` and
`TabNavLink` keep route tabs as links rather than in-page ARIA tabs.

`Modal` adapts the Radix dialog with explicit labeling, keyboard focus
containment, Escape dismissal, and focus restoration for existing launchers.
`RowMenu` uses portaled Radix dropdown menus to escape table clipping. Its
submit items explicitly submit the trigger's form with native validation;
do not rely on DOM ancestry across a portal. Date input
calendars expand in flow; money inputs preserve the raw submitted amount when
switching between editing and formatted display.

Inline delete requires confirmation. Its Escape handling stays local, so it
cannot consume a later dialog's Escape key. Preserve disabled, pending,
validation-error, success, and empty states when adding controls.

## Accessibility and appearance

- Target WCAG 2.2 AA against the rendered glass, not just token swatches.
  Do not lower text opacity to communicate missing or secondary data.
- Keep visible focus independent of utility classes. Aim for 44px targets
  and readable mobile labels; compact calendar grids are a practical exception.
- Honor system theme until a choice is stored in `freedom-four-theme`.
  Store Reduce glass in `freedom-four-glass` as `solid` or `full`.
- In the signed-in app, appearance controls live in Settings, not the shell header.
- Restore preferences before first paint. If storage is unavailable, the
  current session and system preferences still work.
- Reduced transparency uses opaque surfaces. Unsupported blur has an opaque
  fallback. Reduced motion removes nonessential transitions and animation.
- Forced colors removes the backdrop and retains boundaries and selection.
  Print removes navigation, photography, blur, and shadows and uses light ink.
- Support 320px layouts and 200% text resizing without hiding actions.

## Charts and data

Reuse the existing SVG chart components. Keep truthful scales, direct labels,
and precise values. No decorative 3D geometry, glows, embossed marks, or fake
points. Color alone must not identify a series. Missing data differs from zero.
Wealth uses dedicated `--color-allocation-*` categorical tokens, not the similar
warm navigation accents. Keep chart colors aligned with their legends and retain
slice boundaries and accessible share labels. Its year-to-date change compares
the current year's latest available month with the prior December; a missing
baseline stays unavailable rather than turning into zero or all-time growth.

Do not alter account, statement, portfolio, scoring, or household semantics
to suit a layout. Investment snapshots remain separate from the statement
ledger. Data access stays server-side and authentication gates stay intact.

## Verification

Run `pnpm typecheck`, `pnpm lint`, and `pnpm build` before handoff. Run the
portfolio regression tests when changing financial presentation or inputs.

`scripts/daybreak-qa/` renders actual components with synthetic query and
action adapters. It covers all 23 tabs, supporting pages, representative empty
states, responsive layouts, appearance, keyboard controls, form states, and
sampled rendered contrast. Instructions and limitations are in its README.

Save screenshots only under `screenshots/`. Fixture checks do not establish
authenticated end-to-end behavior, third-party integration behavior, every
possible record combination, or a complete accessibility certification.
