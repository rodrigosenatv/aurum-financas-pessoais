import { NextResponse } from "next/server";
import { TelegramHandler } from "@/lib/telegram/handlers";
import type { TelegramUpdate } from "@/lib/telegram/client";

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
      if (secretHeader !== webhookSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = (await request.json()) as TelegramUpdate;
    if (!body || !body.update_id) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const handler = new TelegramHandler();
    // Process update
    await handler.handleUpdate(body);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro no webhook do Telegram:", error);
    // Always return 200 to Telegram so it doesn't endlessly retry bad updates
    return NextResponse.json({ ok: false, error: String(error) }, { status: 200 });
  }
}
