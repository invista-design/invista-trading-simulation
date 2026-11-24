// Applies database migrations. Runs automatically on every Vercel build (see "vercel-build" in package.json).
// Migrations only add or alter structure; existing competition data is kept across redeployments.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A direct (unpooled) connection is preferred for migrations; the app itself uses the pooled DATABASE_URL.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL;
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
