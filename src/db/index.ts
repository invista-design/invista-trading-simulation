import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DbOrTx = DB | Tx;

const globalForDb = globalThis as unknown as { pool?: Pool; db?: DB };

export function connectionString(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
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
