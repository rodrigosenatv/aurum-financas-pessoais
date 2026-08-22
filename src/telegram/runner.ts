import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { TelegramClient } from "../lib/telegram/client";
import { TelegramHandler } from "../lib/telegram/handlers";

async function run() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("\n❌ [Aurum Telegram Bot] ERRO: TELEGRAM_BOT_TOKEN não encontrada em .env ou .env.local!\n");
    console.log("👉 Adicione sua chave no arquivo .env.local:");
    console.log('   TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"');
    console.log('   TELEGRAM_BOT_NAME="SeuBotName"');
    console.log('   GEMINI_API_KEY="AIzaSy..." (opcional para áudio e fotos de recibos)\n');
    process.exit(1);
  }

  const client = new TelegramClient(token);
  const handler = new TelegramHandler(client);

  try {
    const me = await client.getMe();
    console.log(`\n======================================================`);
    console.log(`🤖 Aurum Telegram Bot iniciado com sucesso!`);
    console.log(`👤 Bot: @${me.username} (${me.first_name})`);
    console.log(`📡 Modo: Long-Polling (Desenvolvimento / Standalone)`);
    console.log(`💬 Pronto para receber mensagens, áudios e comprovantes!`);
    console.log(`======================================================\n`);

    // Remove webhook if active so polling works
    await client.deleteWebhook(false).catch(() => {});

    let offset = 0;
    let isRunning = true;

    process.on("SIGINT", () => {
      console.log("\n🛑 Encerrando Bot do Telegram...");
      isRunning = false;
      process.exit(0);
    });

    while (isRunning) {
      try {
        const updates = await client.getUpdates(offset, 50, 25);
        for (const update of updates) {
          offset = update.update_id + 1;
          await handler.handleUpdate(update);
        }
      } catch (err: any) {
        if (err?.message?.includes("ETIMEDOUT") || err?.message?.includes("ECONNRESET")) {
          // Normal network timeout on polling, continue
          continue;
        }
        console.error("Erro no loop de polling:", err?.message || err);
        // Wait 2s before retry
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  } catch (error) {
    console.error("Falha ao inicializar o Bot do Telegram:", error);
    process.exit(1);
  }
}

run();
