import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { TelegramClient } from "../lib/telegram/client";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");

  const client = new TelegramClient(token);
  const webhookUrl = "https://aurum-financas-pessoais.vercel.app/api/telegram/webhook";

  console.log(`Setting webhook to: ${webhookUrl}...`);
  const result = await client.setWebhook(webhookUrl);
  console.log("Webhook result:", result);
}

main();
