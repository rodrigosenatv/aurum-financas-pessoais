import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { TelegramClient } from "@/lib/telegram/client";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

function generatePairCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "AUR-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function GET() {
  try {
    const user = await requireUser();
    const [row] = await db
      .select({
        telegramChatId: users.telegramChatId,
        telegramUsername: users.telegramUsername,
        telegramPairCode: users.telegramPairCode,
        telegramPairExpires: users.telegramPairExpires,
        telegramNotifyDueBills: users.telegramNotifyDueBills,
        telegramNotifyBudgetLimit: users.telegramNotifyBudgetLimit,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const botUsername = process.env.TELEGRAM_BOT_NAME || null;
    const botConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);

    const isCodeActive =
      row?.telegramPairCode &&
      row?.telegramPairExpires &&
      new Date(row.telegramPairExpires) > new Date();

    return NextResponse.json({
      connected: Boolean(row?.telegramChatId),
      chatId: row?.telegramChatId,
      username: row?.telegramUsername,
      pairCode: isCodeActive ? row.telegramPairCode : null,
      pairExpires: isCodeActive ? row.telegramPairExpires : null,
      notifyDueBills: row?.telegramNotifyDueBills ?? true,
      notifyBudgetLimit: row?.telegramNotifyBudgetLimit ?? true,
      botUsername,
      botConfigured,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as {
      action?: "generate_code" | "disconnect" | "update_settings" | "test_message";
      notifyDueBills?: boolean;
      notifyBudgetLimit?: boolean;
    };

    const action = body.action || "generate_code";

    if (action === "generate_code") {
      const code = generatePairCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await db
        .update(users)
        .set({
          telegramPairCode: code,
          telegramPairExpires: expiresAt,
        })
        .where(eq(users.id, user.id));

      const botUsername = process.env.TELEGRAM_BOT_NAME || null;

      return NextResponse.json({
        pairCode: code,
        pairExpires: expiresAt,
        botUsername,
        deepLink: botUsername ? `https://t.me/${botUsername}?start=${code}` : null,
      });
    }

    if (action === "disconnect") {
      await db
        .update(users)
        .set({
          telegramChatId: null,
          telegramUsername: null,
          telegramPairCode: null,
          telegramPairExpires: null,
        })
        .where(eq(users.id, user.id));

      return NextResponse.json({ success: true, connected: false });
    }

    if (action === "update_settings") {
      await db
        .update(users)
        .set({
          telegramNotifyDueBills: body.notifyDueBills ?? true,
          telegramNotifyBudgetLimit: body.notifyBudgetLimit ?? true,
        })
        .where(eq(users.id, user.id));

      return NextResponse.json({ success: true });
    }

    if (action === "test_message") {
      const [row] = await db
        .select({ telegramChatId: users.telegramChatId, name: users.name })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      if (!row?.telegramChatId) {
        return NextResponse.json({ error: "Telegram não está conectado." }, { status: 400 });
      }

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN não configurada." }, { status: 400 });
      }

      const client = new TelegramClient(botToken);
      await client.sendMessage(
        row.telegramChatId,
        `🔔 <b>Teste de Notificação Aurum!</b>\n\nOlá, <b>${row.name}</b>! A comunicação entre o Aurum e seu Telegram está funcionando perfeitamente! 🚀`,
        { parse_mode: "HTML" },
      );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    return apiError(error);
  }
}
