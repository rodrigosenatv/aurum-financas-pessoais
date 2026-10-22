import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL não configurada em .env ou .env.local");
}

const isRemote =
  url.includes("supabase.com") ||
  url.includes("supabase.co") ||
  url.includes("neon.tech") ||
  (!url.includes("127.0.0.1") && !url.includes("localhost"));

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  },
});
