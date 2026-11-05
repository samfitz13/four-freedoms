# Container development

Requires Docker and a Dev Containers client (VS Code Dev Containers or the
devcontainer CLI). Reopen the repository in the container. Node 22 and pnpm
9.15.9 are installed in the image. Postgres 17 starts with a readiness check;
dependencies and database data live in separate named volumes.

Creation installs the frozen lockfile and applies migrations. It creates a
mode-0600 `.env.local` with a random auth secret only if that file does not
already exist. Existing files are never overwritten. The container forces
the local Postgres connection and localhost auth URLs, clears Keychain
configuration and disables Resend and Google credentials, even when the mounted
checkout contains a host environment file. Do not use production secrets here.

After creation, run `pnpm dev` in the container terminal. Open the forwarded
localhost:3000 page, request a magic link at `/login` using a synthetic address,
and follow the link printed in the terminal. Visit Financial and add a synthetic
account to exercise a database-backed interaction. Development emails stay local.
Do not share terminal logs containing sign-in links.

Run `pnpm typecheck`, `pnpm lint`, `pnpm test:paystub` and `pnpm build`
inside the container. Use `pnpm db:migrate` after schema changes. `pnpm db:up`
is for host Docker development and is unnecessary inside this container;
Postgres is already running beside it.

Closing the container stops both services without deleting their volumes.
Rebuild after changing the Dockerfile. The dependency volume avoids replacing
the host's `node_modules`. Port 5432 is not published to the host. The app shares
Postgres's network namespace so the existing local-only `db:push` guard remains
effective; no guard is relaxed.

For terminal-based clients: `devcontainer up --workspace-folder .`, then
`devcontainer exec --workspace-folder . pnpm dev`. Configure port forwarding
in that client. The repository's main README remains the host setup path.
