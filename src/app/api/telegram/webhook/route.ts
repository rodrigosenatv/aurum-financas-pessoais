import { NextResponse } from "next/server";
import { TelegramHandler } from "@/lib/telegram/handlers";
import type { TelegramUpdate } from "@/lib/telegram/client";
import { safeCompare } from "@/lib/api";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const clientId = getClientIdentifier(request);
    const rate = checkRateLimit(`tg-webhook:${clientId}`, { max: 120, windowSeconds: 60 });
    if (!rate.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");

    if (webhookSecret) {
      if (!safeCompare(secretHeader, webhookSecret)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === "production") {
      console.warn("TELEGRAM_WEBHOOK_SECRET não configurado em ambiente de produção.");
      return NextResponse.json({ error: "Webhook secret não configurado." }, { status: 503 });
    }

    const body = (await request.json().catch(() => null)) as TelegramUpdate | null;
    if (!body || typeof body.update_id !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const handler = new TelegramHandler();
    await handler.handleUpdate(body);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro no webhook do Telegram:", error);
    // Retorna 200 genérico para evitar reenvios infinitos do Telegram sem vazar detalhes de erro
    return NextResponse.json({ ok: false, error: "Internal processing error" }, { status: 200 });
  }
}

