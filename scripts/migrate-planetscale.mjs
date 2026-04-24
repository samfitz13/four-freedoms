// Apply Drizzle migrations on PlanetScale Postgres.
//
// drizzle-orm's migrator issues `CREATE SCHEMA IF NOT EXISTS "<schema>"`
// unconditionally, which PlanetScale Postgres denies (error 42501) — even for
// `public`. This script reproduces the migrator's behavior while skipping the
// schema-creation step: it creates the ledger table in `public`, reads the
// journal + SQL files from `drizzle/`, computes the same hash Drizzle uses,
// and applies any new migrations inside a transaction per file.

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = path.resolve("drizzle");
const LEDGER_TABLE = "__drizzle_migrations";
const BREAKPOINT = "--> statement-breakpoint";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { max: 1 });

  try {
    const journal = JSON.parse(
      await readFile(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8"),
    );

    // Ledger table (matches drizzle/postgres-js/migrator shape).
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "public"."${LEDGER_TABLE}" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const applied = await sql.unsafe(
      `SELECT hash, created_at FROM "public"."${LEDGER_TABLE}" ORDER BY created_at ASC`,
    );
    const appliedHashes = new Set(applied.map((r) => r.hash));

    let newlyApplied = 0;
    for (const entry of journal.entries) {
      const sqlPath = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
      const raw = await readFile(sqlPath, "utf8");
      const hash = createHash("sha256").update(raw).digest("hex");

      if (appliedHashes.has(hash)) {
        console.log(`skip  ${entry.tag} (already applied)`);
        continue;
      }

      const statements = raw
        .split(BREAKPOINT)
        .map((s) => s.trim())
        .filter(Boolean);

      console.log(`apply ${entry.tag} (${statements.length} statements)`);

      await sql.begin(async (tx) => {
        for (const stmt of statements) {
          await tx.unsafe(stmt);
        }
        await tx.unsafe(
          `INSERT INTO "public"."${LEDGER_TABLE}" (hash, created_at) VALUES ($1, $2)`,
          [hash, entry.when],
        );
      });

      newlyApplied++;
    }

    console.log(
      newlyApplied === 0
        ? "Nothing to migrate. Database is up to date."
        : `Applied ${newlyApplied} migration(s).`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("migrate-planetscale failed:", err.message);
  if (err.cause) console.error("cause:", err.cause.message ?? err.cause);
  process.exit(1);
});
