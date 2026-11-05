# Operations and recovery

## Inferred brief

For the repository owner, `@samfitz13`, responding to a failed deployment,
database incident, undelivered sign-in email or broken Google Calendar sync.
These are manual recovery procedures, not authorization to modify production.
Sources are the application code and read-only hosting metadata. A backup
subscription, recovery target and alerting service must not be assumed.

## Runbook

### Current boundaries

Last inspected: 2026-11-05. Production runs on Vercel with Supabase Postgres 17.
PlanetScale instructions elsewhere describe an alternative provider.

- **Preview isolation is deferred.** Vercel's production, preview and development
  scopes currently share `DATABASE_URL` and `BETTER_AUTH_SECRET`. Do not use
  previews for migrations, test writes, real email or calendar synchronization.
  A successful preview build does not establish safe database isolation.
- **Hosted error tracking is deferred.** There is no configured Sentry service,
  paging integration or recovery automation in this change.
- Never paste connection strings, cookies, magic links, email bodies, tokens,
  calendar event details, household records or database dumps into incidents.
- Get explicit owner approval before rollback/promotion, environment changes,
  restoring data, disabling access or invalidating sessions.

Record the UTC incident window, affected deployment's Git SHA, last known healthy
SHA, symptoms and sanitized error reference. Assign the owner before recovery.
When escalating to Vercel, Supabase, Resend or Google support, share only the
minimum sanitized metadata. Record the recovery decision and verification.

### Reading application errors

`lib/logger.ts` emits single-line JSON through `console.error`. Server records
appear in Vercel runtime logs; browser boundary records stay in the browser
console and are not uploaded to a tracking service.

| Event                   | Meaning                        |
| ----------------------- | ------------------------------ |
| `server.request.failed` | Next.js request error hook ran |
| `app.render.failed`     | React error boundary rendered  |
| `auth.operation.failed` | better-auth reported an error  |

Records include timestamp, level, runtime, a bounded built-in error name and,
when available, a numeric Next.js digest. The digest is an **error reference**,
not a unique request ID. Search the matching deployment and UTC window for it.
Only explicitly allowed static API route templates and router kind survive
request-context redaction. A validated UUID request ID or HTTP status is retained
only when a caller explicitly supplies it; the hook does not manufacture them.
Email failures use `EMAIL_NOT_CONFIGURED` or `EMAIL_DELIVERY_FAILED`.

Messages, causes, stacks, arbitrary context, full request paths, headers and
payloads are omitted, not merely masked by key names. Do not reintroduce them to
debug an incident. Reproduce with synthetic fixtures instead. This policy covers
the app's logger and auth logger, not every framework/provider/platform log.
The deliberate **development-only email console fallback contains sign-in
links**. Keep it local, use synthetic accounts and never forward that console
to shared logs.

### Failed deployment

**Signal:** failed build, failed route, repeated errors after a release, or an
unhealthy custom domain.

1. In Vercel, identify the deployment, target environment, exact Git SHA and
   whether failure occurred during install, build, routing or runtime.
   Inspect build logs separately from runtime logs. A `READY` state proves
   build completion, not successful sign-in or database access.
2. Compare the lockfile, Node version, environment-variable **names/scopes** and
   migration changes with the last healthy deployment. Do not display values.
   Check the database procedure below before retrying a runtime DB error.
3. For a code-only regression with compatible schema and credentials, obtain
   approval and use Vercel's supported rollback/promotion controls to restore the
   last healthy, patched production deployment. Do not force-push Git history.
4. App rollback does not undo migrations, external writes or environment changes.
   If compatibility is uncertain, stop writes using an approved provider access
   control and agree on a forward fix or coordinated recovery first. This app
   has no built-in maintenance-mode switch.
5. Do not roll back to better-auth versions affected by the critical Magic Link
   advisory just to recover availability. Prefer a forward fix. Servers sharing
   verification storage must upgrade together, and pending links/sign-ins must
   restart. See [dependency review](dependency-review.md).

**Verify:** the domain serves the intended SHA; the owner can request and use a
fresh sign-in link; one approved, non-destructive household read works; logs stop
showing the incident error. Any live smoke test needs approval and a designated
account. Reconcile the recovery with `main` so the next deploy cannot undo it.

### Database availability, migration failure or data loss

**Signal:** connection/TLS errors, migration failure, missing records or incorrect
household results.

1. Distinguish provider outage, credentials/pool configuration, schema mismatch
   and data corruption. Check Supabase health and connection metadata without
   dumping tables. Verify the correct project, session-pooler endpoint, database,
   TLS and intended environment. Retain `prepare: false` and production `max: 1`.
2. For a failed migration, stop automatic retries. Review the committed SQL,
   Drizzle journal and provider migration state. Do not hand-edit history,
   delete journal entries, run `db:push` remotely or replay a partially applied
   change without a reviewed forward-repair plan.
3. For suspected data loss, obtain approval to stop writes. Preserve the current
   state using an approved private backup when available. In Supabase, verify
   the **actual** available backups/PITR, retention, timestamps and plan limits.
   No recovery-point or recovery-time guarantee has been established here.
4. Choose a recovery point before the incident. Prefer restoring to a separate,
   restricted recovery database when the provider supports it. Restoring over
   production can discard later writes, so obtain explicit approval and a
   reconciliation plan first. Production data must not be restored into preview.
5. Validate schema/journal consistency, tenant ownership and expected counts
   privately. If newer application code requires migrations, review them against
   the restored state before running `pnpm db:migrate` with securely supplied,
   explicitly verified recovery-database credentials. A migration is not a
   data-repair tool.
6. Restored sessions and verification records may revive revoked access or old
   links. Agree on and perform reviewed invalidation before reopening access.
   This repository does not supply a blanket cleanup script.
7. Switch production credentials only after approval and verification. Redeploy
   so new serverless instances use the intended database, then reconcile writes
   after the chosen recovery point. Keep the previous database restricted for
   the agreed recovery window.

**Important:** `BETTER_AUTH_SECRET` also derives the encryption key for stored
Google Calendar tokens (`lib/crypto.ts`). Preserve the matching secret when
recovering a database. Rotating it invalidates auth state and makes existing
calendar tokens unreadable; plan secure token migration or calendar reconnection.
Do not rotate it as an unexplained database fix.

**Verify:** approved household reads succeed, tenant boundaries remain intact,
new writes land only in the intended database, sign-in works, and calendar
credentials can decrypt or have been deliberately reconnected. Escalate to the
owner/provider if backup availability or data integrity cannot be established.

### Magic-link email

**Signal:** no email, rejected/expired link, failed auth request.

1. Check runtime auth errors and the Resend dashboard for the incident window.
   `EMAIL_NOT_CONFIGURED` means no `RESEND_API_KEY` outside development.
   `EMAIL_DELIVERY_FAILED` means the send request failed or was rejected.
   Recipient-level investigation belongs in Resend, not copied application logs.
2. Verify environment scope, verified sender domain, `EMAIL_FROM`, key
   permissions and Resend service health. Check delivery/bounce status and
   provider-required DNS records. Do not print the API key.
3. Check that `BETTER_AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, the custom domain and
   the user's destination agree. `trustedOrigins` comes from the public site URL.
   Do not broaden trusted origins or disable validation as a workaround.
4. Correct a confirmed configuration problem with approval and redeploy.
   Production never falls back to printing links. Request a **new** link;
   links expire after 15 minutes and are single use. Email scanners or a prior
   click may consume one. Never reuse or paste an old link.
5. After the better-auth upgrade, restart pending sign-ins. Coordinate all
   deployments sharing verification storage. Do not rewrite verification rows
   to make old links work.

**Verify:** a designated, approved test recipient receives and can use one new
link; replay fails; no sign-in link or recipient is in structured logs.

### Google Calendar sync

**Signal:** connection error, stale events, failed manual sync or decryption error.

1. Check the deployment/window and static calendar-route errors.
   Verify `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI`
   are present in the intended environment. No configured provider produces a
   successful no-op sync response, not proof that events synchronized.
2. The redirect URI must exactly match the deployed callback and Google's
   registered URI. Start a new connection from the app after cancellation or
   failure. State is session/household-bound, expires after 10 minutes and is
   consumed once. Never bypass state checks or replay callback URLs.
3. Check Google provider health, API enablement, consent configuration and
   granted read-only calendar scopes. For revoked/expired refresh credentials,
   reconnect through the app to obtain consent again.
4. Manual sync ignores disabled accounts and requests within 60 seconds of the
   previous successful sync. Wait before retrying. `lastSyncedAt` advances only
   after the account sync completes.
5. HTTP 410 for a saved Google sync token already triggers an automatic fresh
   sync, fetching roughly the previous 90 days and next year. Do not delete
   app events or repeatedly clear database sync state to force recovery.
6. If decryption fails after a secret change, follow the database key warning
   above. Reconnect deliberately if the correct key cannot be recovered.
   Disconnecting disables credentials; the optional **purge** action deletes
   imported Google events, so leave it off unless deletion was approved.

**Verify:** an approved account sync advances `lastSyncedAt` and displays expected
events without duplicate imports or access to another household. This requires
approved live verification; fixture tests alone cannot establish it.

## Evidence and review notes

- Sources: `lib/auth.ts`, `lib/email.ts`, `lib/logger.ts`, `instrumentation.ts`,
  `lib/crypto.ts`, `lib/calendar/google.ts`, `lib/calendar/oauth-state.ts`,
  calendar routes/actions, and the setup instructions in the root README.
- Read-only Vercel scope metadata and Supabase project metadata established the
  current shared-credential risk and provider on the inspection date. Recheck
  these before a future incident; this document does not enforce them.
- Recovery has not been drilled against live services. Backups, retention, paid
  recovery features, alert routing and authenticated end-to-end behavior remain
  unverified. No provider writes or production data copies were used to author
  or test these instructions.
