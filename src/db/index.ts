import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DbOrTx = DB | Tx;

const globalForDb = globalThis as unknown as { pool?: Pool; db?: DB };

/**
 * Pooled Postgres connection string. Accepts the standard names and, if the database was connected
 * with a custom prefix (for example STORAGE_DATABASE_URL), any variable ending in DATABASE_URL.
 */
export function connectionString(): string {
  const env = process.env;
  const prefixed = Object.keys(env)
    .filter((k) => /(^|_)DATABASE_URL$/.test(k) && /^postgres(ql)?:\/\//.test(env[k] ?? ""))
    .sort()
    .map((k) => env[k]);
  const url = env.DATABASE_URL || env.POSTGRES_URL || prefixed[0];
  if (!url) throw new Error("DATABASE_URL is not set. Connect a Neon database to this Vercel project.");
  return url;
}

export function getDb(): DB {
  if (!globalForDb.db) {
    globalForDb.pool = new Pool({ connectionString: connectionString(), max: Number(process.env.DB_POOL_MAX ?? 5), idleTimeoutMillis: 10_000 });
    globalForDb.db = drizzle(globalForDb.pool, { schema });
  }
  return globalForDb.db;
}

export { schema };
