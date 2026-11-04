# Atlas portfolio snapshot

Imports holdings into an **existing local USD brokerage account**. Find the
result under **Financial → Accounts → Portfolio snapshot**.

This does not create accounts, import transactions, change statements, or
feed net-worth/performance/FI calculations. Atlas's separate money-market
estimate (`outsideCash`) is deliberately ignored. All other accounts remain
untouched.

From this repository, preview an import:

```sh
pnpm exec tsx scripts/import-atlas-portfolio.ts \
  --file /absolute/path/to/atlas/data.json \
  --household EXISTING_HOUSEHOLD_ID \
  --account EXISTING_BROKERAGE_ACCOUNT_ID \
  --prepared-on YYYY-MM-DD \
  --cash-as-of YYYY-MM-DD
```

After reviewing the preview, repeat with `--apply`. The command loads
`.env.local`, refuses remote databases, validates account ownership/type and
USD currency, and inserts in one transaction. A content-derived source key
makes a repeat import a no-op. Older snapshots remain immutable; the Accounts
screen shows the most recently prepared snapshot per active account.

Apply the generated `0024` migration with `pnpm db:migrate` before using this
feature. Do not run migration commands against an unverified database target.
Personal source JSON and account identifiers belong outside version control.

## Evidence and limitations

- The source preparation date is not the screenshot's price timestamp. Quote
  time stays unknown; this is not a month-end statement or live market feed.
- Broker cash is reconstructed through the explicit `--cash-as-of` date,
  including BUPXX as cash. No standalone current cash statement was verified.
- Gain uses rounded screenshot average costs. It is approximate unrealized
  gain, not verified tax basis or total return.
- This adapter supports the six known Atlas ETFs only. Unknown securities
  fail validation instead of receiving an assumed asset classification.
- Issuer sources, dates, expense ratios, fund roles/risks, and partial company,
  issuer, and country lists are retained. They are mixed-date research, not a
  complete overlap analysis or individualized investment advice.

## Checks

```sh
pnpm exec tsx --test lib/financial/portfolio/atlas.test.ts
pnpm typecheck
pnpm lint
pnpm build
```
