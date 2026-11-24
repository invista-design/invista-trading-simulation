// Applies database migrations. Runs automatically on every Vercel build (see "vercel-build" in package.json).
// Migrations only add or alter structure; existing competition data is kept across redeployments.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A direct (unpooled) connection is preferred for migrations; the app itself uses the pooled DATABASE_URL.
const env = process.env;
const isPg = (v) => /^postgres(ql)?:\/\//.test(v ?? "");
// Also accept names with a custom prefix, such as STORAGE_DATABASE_URL_UNPOOLED or STORAGE_DATABASE_URL.
const byPattern = (re) => Object.keys(env).filter((k) => re.test(k) && isPg(env[k])).sort().map((k) => env[k])[0];
const url =
  env.DATABASE_URL_UNPOOLED ||
  env.POSTGRES_URL_NON_POOLING ||
  byPattern(/(^|_)DATABASE_URL_UNPOOLED$/) ||
  env.DATABASE_URL ||
  env.POSTGRES_URL ||
  byPattern(/(^|_)DATABASE_URL$/);
if (!url) {
  // The first deployment can run before a database is connected. Build the site anyway; /setup explains what is missing.
  console.warn("WARNING: DATABASE_URL is not set, so database migrations were skipped. In Vercel, open the project, go to the Storage tab, connect a Neon database to this project, then redeploy.");
  process.exit(0);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: path.join(here, "..", "drizzle") });
  console.log("Database migrations applied.");
} finally {
  await pool.end();
}
