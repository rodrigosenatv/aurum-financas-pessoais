import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

config({ path: ".env.local" });
config({ path: ".env" });

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

const globalForDb = globalThis as typeof globalThis & {
  __aurumPostgresqlPool?: Pool;
};

const isRemote =
  databaseUrl.includes("supabase.com") ||
  databaseUrl.includes("supabase.co") ||
  (!databaseUrl.includes("127.0.0.1") && !databaseUrl.includes("localhost"));

export const pool =
  globalForDb.__aurumPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__aurumPostgresqlPool = pool;
}

export const db = drizzle(pool);
