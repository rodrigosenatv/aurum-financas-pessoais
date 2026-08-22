import { db } from "@/db";
import { budgets, categories, transactions, users } from "@/db/schema";
import { and, eq, isNotNull, like, lte, sql } from "drizzle-orm";
import { TelegramClient } from "./client";

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function sendDailyDueReminders(): Promise<{ notifiedUsers: number; totalBills: number }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { notifiedUsers: 0, totalBills: 0 };

  const client = new TelegramClient(botToken);
  const today = getTodayIso();

  // Find all users with connected telegram and notifications enabled
  const targetUsers = await db
    .select({
      id: users.id,
      name: users.name,
      telegramChatId: users.telegramChatId,
    })
    .from(users)
    .where(and(isNotNull(users.telegramChatId), eq(users.telegramNotifyDueBills, true)));

  let notifiedUsers = 0;
  let totalBills = 0;

  for (const user of targetUsers) {
    if (!user.telegramChatId) continue;

    // Fetch unpaid expenses due today or overdue
    const pendingBills = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        amountCents: transactions.amountCents,
        date: transactions.date,
        categoryName: categories.name,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.type, "expense"),
          eq(transactions.isPaid, false),
          lte(transactions.date, today),
        ),
      )
      .orderBy(transactions.date);

    if (pendingBills.length === 0) continue;

    const overdue = pendingBills.filter((b) => b.date < today);
    const dueToday = pendingBills.filter((b) => b.date === today);

    let message = `🔔 <b>Lembrete de Vencimentos — Aurum</b>\n`;
    message += `Olá, <b>${user.name}</b>! Você tem contas pendentes de atenção:\n\n`;

    if (dueToday.length > 0) {
      message += `🟡 <b>Vence(m) Hoje (${today}):</b>\n`;
      for (const bill of dueToday) {
        message += `• <b>${bill.description}</b>: <code>${money(bill.amountCents)}</code> (${bill.categoryName})\n`;
      }
      message += `\n`;
    }

    if (overdue.length > 0) {
      message += `🔴 <b>Em Atraso:</b>\n`;
      for (const bill of overdue) {
        const [y, m, d] = bill.date.split("-");
        message += `• <b>${bill.description}</b> (venceu ${d}/${m}): <code>${money(bill.amountCents)}</code>\n`;
      }
      message += `\n`;
    }

    message += `💡 <i>Clique no botão abaixo para marcar como pago ou use o comando /contas.</i>`;

    const inlineKeyboard = pendingBills.slice(0, 5).map((bill) => [
      {
        text: `✅ Pagar: ${bill.description.slice(0, 18)} (${money(bill.amountCents)})`,
        callback_data: `pay_${bill.id}`,
      },
    ]);

    try {
      await client.sendMessage(user.telegramChatId, message, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
      notifiedUsers++;
      totalBills += pendingBills.length;
    } catch (err) {
      console.error(`Falha ao enviar lembrete para usuário ${user.id}:`, err);
    }
  }

  return { notifiedUsers, totalBills };
}

export async function checkBudgetAlert(userId: number, categoryId: number): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const [user] = await db
    .select({
      telegramChatId: users.telegramChatId,
      telegramNotifyBudgetLimit: users.telegramNotifyBudgetLimit,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.telegramChatId || !user.telegramNotifyBudgetLimit) return;

  // Check budget for this category
  const [budgetRow] = await db
    .select({
      amountCents: budgets.amountCents,
      categoryName: categories.name,
    })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(and(eq(budgets.userId, userId), eq(budgets.categoryId, categoryId)))
    .limit(1);

  if (!budgetRow || budgetRow.amountCents <= 0) return;

  // Sum monthly expenses for this category
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [spentRow] = await db
    .select({
      totalSpent: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)::integer`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.categoryId, categoryId),
        eq(transactions.type, "expense"),
        like(transactions.date, `${currentMonthKey}%`),
      ),
    );

  const spent = spentRow?.totalSpent ?? 0;
  const ratio = spent / budgetRow.amountCents;

  if (ratio >= 0.8) {
    const client = new TelegramClient(botToken);
    const pct = Math.round(ratio * 100);

    let alertText = "";
    if (ratio >= 1.0) {
      alertText = `🚨 <b>ALERTA DE ORÇAMENTO ESTOURADO!</b>\n\n`;
      alertText += `Você atingiu <b>${pct}%</b> do limite definido para <b>${budgetRow.categoryName}</b>.\n`;
      alertText += `• Gasto atual: <code>${money(spent)}</code>\n`;
      alertText += `• Limite: <code>${money(budgetRow.amountCents)}</code>\n`;
      alertText += `• Excedente: <code>${money(spent - budgetRow.amountCents)}</code>`;
    } else {
      alertText = `⚠️ <b>Atenção ao Orçamento!</b>\n\n`;
      alertText += `Você já consumiu <b>${pct}%</b> do orçamento de <b>${budgetRow.categoryName}</b> neste mês.\n`;
      alertText += `• Gasto atual: <code>${money(spent)}</code> / <code>${money(budgetRow.amountCents)}</code>\n`;
      alertText += `• Restante disponível: <code>${money(budgetRow.amountCents - spent)}</code>`;
    }

    try {
      await client.sendMessage(user.telegramChatId, alertText, { parse_mode: "HTML" });
    } catch (e) {
      console.error("Erro ao enviar alerta de orçamento:", e);
    }
  }
}
