/**
 * Drizzle client. Single connection pool, reused across the process.
 *
 * In prod (Vercel + PlanetScale Postgres) we run short-lived serverless
 * functions that can fan out to hundreds of concurrent instances during a
 * burst. PlanetScale pools connections at the edge, so each function
 * instance should hold at most one connection — `max: 1`. We also disable
 * prepared statements because PlanetScale's proxy doesn't persist them
 * across pooled connections.
 *
 * For local dev (`next dev` / `next start`) the pool is cached on
 * `globalThis` so HMR doesn't leak pools, and `max` is slightly higher so
 * parallel RSC work doesn't serialize on a single connection.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

type PostgresSql = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as {
  __ff_sql?: PostgresSql;
};

const sql: PostgresSql =
  globalForDb.__ff_sql ??
  postgres(env.DATABASE_URL, {
    prepare: false,
    max: env.NODE_ENV === "production" ? 1 : 4,
  });

if (env.NODE_ENV !== "production") globalForDb.__ff_sql = sql;

export const db = drizzle(sql, { schema });
export { schema };
