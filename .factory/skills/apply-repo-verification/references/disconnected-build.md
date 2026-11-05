# Disconnected production build

Run from the repository root. The build wrapper loads local environment files
and can read a macOS Keychain database credential. Explicit process overrides
take precedence, so supply synthetic values and clear provider settings in the
same command. Never print or copy the contents of local environment files.

```sh
DATABASE_URL=postgres://fixture:fixture@127.0.0.1:5432/freedom_four_test \
DATABASE_URL_KEYCHAIN_SERVICE='' \
BETTER_AUTH_SECRET=synthetic-verification-secret-not-for-deployment \
BETTER_AUTH_URL=http://localhost:3000 \
NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
RESEND_API_KEY='' \
GOOGLE_CLIENT_ID='' \
GOOGLE_CLIENT_SECRET='' \
GOOGLE_REDIRECT_URI='' \
pnpm build
```

No database needs to be running. Do not start or seed one to make a build pass.
If the build attempts a live connection or requires another provider, stop and
inspect the configuration instead of supplying credentials. A successful build
does not prove authentication or real integrations work.

If `pnpm` or the pinned Node version is unavailable, report the environment
blocker. Do not install a new runtime or change versions as part of verification.
If dependencies are absent/out of sync, follow `AGENTS.md`'s frozen-install rule;
never regenerate the lockfile to bypass installation failures.
