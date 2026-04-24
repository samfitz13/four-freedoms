import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "postgres://freedom:freedom@127.0.0.1:5432/freedom_four";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  migrations: {
    // PlanetScale Postgres restricts CREATE SCHEMA on the default database,
    // so keep the migration ledger inside `public`.
    schema: "public",
    table: "__drizzle_migrations",
  },
  strict: true,
  verbose: true,
});
