import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { TelegramClient } from "../lib/telegram/client";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");

  const client = new TelegramClient(token);
  const webhookUrl =
    process.env.TELEGRAM_WEBHOOK_URL ||
    "https://aurum-financas-pessoais.vercel.app/api/telegram/webhook";
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;

  console.log(`Setting webhook to: ${webhookUrl}...`);
  if (secretToken) {
    console.log("Using secret_token for webhook security.");
  }
  const result = await client.setWebhook(webhookUrl, secretToken);
  console.log("Webhook result:", result);
}

main();
