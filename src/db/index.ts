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
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  });

// Previne crash do processo em caso de queda de conexão ociosa com o PostgreSQL
pool.on("error", (err) => {
  console.error("Erro inesperado no pool PostgreSQL do Aurum:", err);
});

if (process.env.NODE_ENV !== "production") {
  globalForDb.__aurumPostgresqlPool = pool;
}

export const db = drizzle(pool);

