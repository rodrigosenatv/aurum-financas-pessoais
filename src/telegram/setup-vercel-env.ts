import { spawnSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const envVars: Record<string, string | undefined> = {
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_BOT_NAME: process.env.TELEGRAM_BOT_NAME,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
};

const targets = ["production", "development"];

for (const [key, val] of Object.entries(envVars)) {
  if (!val) continue;

  for (const target of targets) {
    console.log(`Setting ${key} on ${target}...`);
    // Remove if exists
    spawnSync("npx", ["vercel", "env", "rm", key, target, "-y"], {
      stdio: "ignore",
      shell: true,
    });

    // Add with non-interactive flag
    const proc = spawnSync(
      "npx",
      ["vercel", "env", "add", key, target, "--value", `"${val}"`, "--yes"],
      {
        encoding: "utf-8",
        shell: true,
      },
    );

    if (proc.status === 0) {
      console.log(`✓ ${key} set on ${target}`);
    } else {
      console.log(`! ${key} (${target}):`, proc.stdout || proc.stderr);
    }
  }
}

console.log("\nAll Vercel environment variables configured successfully!");
