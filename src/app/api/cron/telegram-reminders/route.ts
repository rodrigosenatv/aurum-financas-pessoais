import { NextResponse } from "next/server";
import { sendDailyDueReminders } from "@/lib/telegram/reminders";
import { safeCompare } from "@/lib/api";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const clientId = getClientIdentifier(request);
    const rate = checkRateLimit(`cron:${clientId}`, { max: 12, windowSeconds: 60 });
    if (!rate.allowed) {
      return NextResponse.json({ error: "Taxa de requisições excedida." }, { status: 429 });
    }

    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization") || "";

    if (cronSecret) {
      const expected = `Bearer ${cronSecret}`;
      if (!safeCompare(authHeader, expected)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === "production") {
      // Em produção, se o segredo não estiver configurado, bloqueia por padrão
      console.warn("CRON_SECRET não configurado em ambiente de produção.");
      return NextResponse.json({ error: "Serviço de cron não configurado." }, { status: 503 });
    }

    const result = await sendDailyDueReminders();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("Erro no cron de lembretes do Telegram:", error);
    return NextResponse.json({ error: "Não foi possível executar os lembretes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}

