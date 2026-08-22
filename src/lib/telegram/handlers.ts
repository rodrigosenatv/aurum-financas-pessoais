import { db } from "@/db";
import { budgets, categories, goals, transactions, users } from "@/db/schema";
import { and, desc, eq, gt, like, sql } from "drizzle-orm";
import { createPdf } from "@/app/api/reports/[format]/route";
import { TelegramClient, type TelegramCallbackQuery, type TelegramMessage, type TelegramUpdate } from "./client";
import { parseAudioWithGemini, parseReceiptWithGemini, parseTextWithGemini } from "./gemini";
import { parseNaturalLanguage } from "./parser";
import { checkBudgetAlert } from "./reminders";

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const moneyNum = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getCurrentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export class TelegramHandler {
  private client: TelegramClient;

  constructor(client?: TelegramClient) {
    this.client = client ?? new TelegramClient();
  }

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    try {
      if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
        return;
      }

      const msg = update.message || update.edited_message;
      if (!msg) return;

      await this.handleMessage(msg);
    } catch (err) {
      console.error("Erro ao processar update do Telegram:", err);
    }
  }

  private async findUserByChatId(chatId: string | number) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.telegramChatId, String(chatId)))
      .limit(1);
    return user ?? null;
  }

  private async handleMessage(msg: TelegramMessage): Promise<void> {
    const chatId = String(msg.chat.id);
    const text = (msg.text || msg.caption || "").trim();

    // Check pairing commands: /start <pairCode> or /conectar <pairCode>
    if (text.startsWith("/start ") || text.startsWith("/conectar ")) {
      const parts = text.split(/\s+/);
      const code = parts[1]?.trim().toUpperCase();
      if (code) {
        await this.handleConnectCode(chatId, code, msg.from?.username);
        return;
      }
    }

    if (text === "/start") {
      const existingUser = await this.findUserByChatId(chatId);
      if (!existingUser) {
        await this.sendUnlinkedWelcome(chatId);
        return;
      }
      await this.sendLinkedWelcome(chatId, existingUser.name);
      return;
    }

    // Check if user is linked
    const user = await this.findUserByChatId(chatId);
    if (!user) {
      await this.sendUnlinkedWelcome(chatId);
      return;
    }

    // Process linked user commands
    if (text === "/ajuda") {
      await this.sendHelp(chatId);
      return;
    }

    if (text === "/desconectar") {
      await db
        .update(users)
        .set({ telegramChatId: null, telegramUsername: null })
        .where(eq(users.id, user.id));

      await this.client.sendMessage(
        chatId,
        "🔒 <b>Conta Desvinculada com Sucesso!</b>\n\nEste chat do Telegram não está mais conectado ao Aurum. Para reconectar no futuro, use o código gerado no app.",
        { parse_mode: "HTML" },
      );
      return;
    }

    if (text === "/resumo" || text === "/saldo") {
      await this.sendSummary(chatId, user.id);
      return;
    }

    if (text === "/contas" || text === "/vencimentos") {
      await this.sendPendingBills(chatId, user.id);
      return;
    }

    if (text === "/gastos") {
      await this.sendSpendingByCategory(chatId, user.id);
      return;
    }

    if (text === "/metas") {
      await this.sendGoals(chatId, user.id);
      return;
    }

    if (text.startsWith("/relatorio") || text.startsWith("/exportar")) {
      await this.sendReportFile(chatId, user.id, text);
      return;
    }

    // Handle Voice / Audio Note
    if (msg.voice || msg.audio) {
      await this.handleAudioMessage(msg, user.id);
      return;
    }

    // Handle Photo / Receipt / Document Image
    if (msg.photo && msg.photo.length > 0) {
      await this.handlePhotoMessage(msg, user.id);
      return;
    }

    // Handle Natural Language or Command Text
    if (text) {
      await this.handleTextMessage(chatId, user.id, text);
    }
  }

  private async handleConnectCode(chatId: string, code: string, username?: string): Promise<void> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.telegramPairCode, code), gt(users.telegramPairExpires, new Date())))
      .limit(1);

    if (!user) {
      await this.client.sendMessage(
        chatId,
        "❌ <b>Código inválido ou expirado!</b>\n\nPor favor, acesse o <b>Aurum</b> na aba <i>Gerenciar</i>, gere um novo código de conexão e tente novamente com:\n<code>/conectar SEU_CODIGO</code>",
        { parse_mode: "HTML" },
      );
      return;
    }

    await db
      .update(users)
      .set({
        telegramChatId: chatId,
        telegramUsername: username ?? null,
        telegramPairCode: null,
        telegramPairExpires: null,
      })
      .where(eq(users.id, user.id));

    let welcome = `🎉 <b>Conta Aurum Conectada com Sucesso!</b>\n\n`;
    welcome += `Olá, <b>${user.name}</b>! Agora seu assistente financeiro pessoal está ativo.\n\n`;
    welcome += `✨ <b>O que você pode fazer por aqui:</b>\n`;
    welcome += `• <b>Lançar gastos/receitas:</b> Basta enviar <i>"Almoço 35 alimentação"</i> ou <i>"Salário 4500"</i>\n`;
    welcome += `• <b>Mandar áudio:</b> Fale seus gastos por voz que eu registro automaticamente! 🎙️\n`;
    welcome += `• <b>Enviar foto/comprovante:</b> Tire foto de recibos ou comprovantes PIX 📸\n`;
    welcome += `• <b>Ver contas a pagar:</b> Digite <code>/contas</code>\n`;
    welcome += `• <b>Ver resumo do mês:</b> Digite <code>/resumo</code>\n`;
    welcome += `• <b>Baixar relatório em PDF:</b> Digite <code>/relatorio pdf</code>\n\n`;
    welcome += `Experimente enviar agora seu primeiro gasto! 🚀`;

    await this.client.sendMessage(chatId, welcome, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📊 Ver Resumo do Mês", callback_data: "view_summary" }],
          [{ text: "📋 Contas a Pagar", callback_data: "view_bills" }],
        ],
      },
    });
  }

  private async sendUnlinkedWelcome(chatId: string): Promise<void> {
    let text = `👋 <b>Olá! Bem-vindo ao Aurum Bot!</b>\n\n`;
    text += `Eu sou seu assistente inteligente de finanças pessoais.\n\n`;
    text += `Para conectar seu Telegram à sua conta do Aurum:\n`;
    text += `1️⃣ Acesse o <b>Aurum</b> no navegador\n`;
    text += `2️⃣ Vá na aba <b>Gerenciar</b> > <b>Assistente do Telegram</b>\n`;
    text += `3️⃣ Clique em <b>Gerar Código de Conexão</b>\n`;
    text += `4️⃣ Envie aqui o comando:\n<code>/conectar SEU_CODIGO</code>\n\n`;
    text += `Depois de conectar, você poderá lançar despesas por texto, áudio ou foto de comprovante! 🎯`;

    await this.client.sendMessage(chatId, text, { parse_mode: "HTML" });
  }

  private async sendLinkedWelcome(chatId: string, userName: string): Promise<void> {
    let text = `👋 Olá, <b>${userName}</b>! O assistente do <b>Aurum</b> está pronto.\n\n`;
    text += `💡 <b>Dicas rápidas:</b>\n`;
    text += `• Envie uma mensagem simples como: <i>"Mercado 120"</i>\n`;
    text += `• Mande um áudio dizendo o que comprou 🎙️\n`;
    text += `• Mande a foto de uma nota ou comprovante 📸\n`;
    text += `• Use os comandos abaixo para navegar:`;

    await this.client.sendMessage(chatId, text, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📊 Resumo Geral", callback_data: "view_summary" },
            { text: "📅 Contas a Pagar", callback_data: "view_bills" },
          ],
          [
            { text: "🏷️ Gastos por Categoria", callback_data: "view_spending" },
            { text: "🎯 Minhas Metas", callback_data: "view_goals" },
          ],
        ],
      },
    });
  }

  private async sendHelp(chatId: string): Promise<void> {
    let help = `📖 <b>Guia de Comandos e Uso — Aurum Bot</b>\n\n`;
    help += `<b>Lançamento Rápido por Texto:</b>\n`;
    help += `• <code>Almoço 42,50 alimentação</code> (despesa)\n`;
    help += `• <code>Uber 28 transporte pendente</code> (despesa a pagar)\n`;
    help += `• <code>Salário 5000</code> (receita)\n`;
    help += `• <code>Notebook 3000 10x</code> (parcelado em 10 vezes)\n`;
    help += `• <code>Internet 119 recorrente dia 15</code> (gasto fixo mensal)\n\n`;
    help += `<b>🎙️ Áudio & 📸 Comprovantes:</b>\n`;
    help += `• Envie um <b>áudio de voz</b> dizendo o que gastou.\n`;
    help += `• Envie uma <b>foto de nota fiscal ou comprovante PIX</b> que leio os valores automaticamente.\n\n`;
    help += `<b>Consultas & Relatórios:</b>\n`;
    help += `• <code>/resumo</code> ou <code>/saldo</code> — Visão geral do mês\n`;
    help += `• <code>/contas</code> — Contas a pagar com botões para quitar\n`;
    help += `• <code>/gastos</code> — Distribuição por categoria e limites\n`;
    help += `• <code>/metas</code> — Progresso dos seus objetivos\n`;
    help += `• <code>/relatorio pdf</code> — Envia o arquivo PDF do mês\n`;
    help += `• <code>/relatorio csv</code> — Envia a planilha CSV do mês\n`;
    help += `• <code>/desconectar</code> — Desvincula este Telegram`;

    await this.client.sendMessage(chatId, help, { parse_mode: "HTML" });
  }

  private async handleTextMessage(chatId: string, userId: number, text: string): Promise<void> {
    const userCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(categories.id);

    // Try Gemini Natural Language first if available, else deterministic parser
    let parsed = await parseTextWithGemini(text, userCategories);
    if (!parsed) {
      parsed = parseNaturalLanguage(text, userCategories);
    }

    if (!parsed) {
      await this.client.sendMessage(
        chatId,
        `🤔 Não entendi o lançamento. Tente algo como:\n• <code>Almoço 45 alimentação</code>\n• <code>Salário 3000</code>\n• <code>Luz 180 pendente</code>\n\nOu digite <code>/ajuda</code> para ver exemplos.`,
        { parse_mode: "HTML" },
      );
      return;
    }

    await this.saveAndConfirmTransaction(chatId, userId, parsed, userCategories);
  }

  private async handleAudioMessage(msg: TelegramMessage, userId: number): Promise<void> {
    const chatId = String(msg.chat.id);
    const voice = msg.voice || msg.audio;
    if (!voice?.file_id) return;

    await this.client.sendChatAction(chatId, "record_voice");

    const userCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(categories.id);

    try {
      const fileInfo = await this.client.getFile(voice.file_id);
      if (!fileInfo.file_path) {
        await this.client.sendMessage(chatId, "⚠️ Não foi possível obter o arquivo de áudio.");
        return;
      }

      const audioBuffer = await this.client.downloadFile(fileInfo.file_path);
      const mimeType = voice.mime_type || "audio/ogg";

      const parsed = await parseAudioWithGemini(audioBuffer, mimeType, userCategories);

      if (!parsed) {
        await this.client.sendMessage(
          chatId,
          "🎙️ Ouvi seu áudio, mas não identifiquei um valor ou gasto específico. Poderia repetir ou enviar por texto?",
        );
        return;
      }

      let extraInfo = "";
      if (parsed.rawText) {
        extraInfo = `🎙️ <i>"${parsed.rawText}"</i>\n\n`;
      }

      await this.saveAndConfirmTransaction(chatId, userId, parsed, userCategories, extraInfo);
    } catch (err) {
      console.error("Erro ao processar áudio:", err);
      await this.client.sendMessage(
        chatId,
        "⚠️ Ocorreu um erro ao processar o áudio. Se você não configurou a chave da IA (GEMINI_API_KEY), adicione-a no .env.local.",
      );
    }
  }

  private async handlePhotoMessage(msg: TelegramMessage, userId: number): Promise<void> {
    const chatId = String(msg.chat.id);
    if (!msg.photo || msg.photo.length === 0) return;

    await this.client.sendChatAction(chatId, "upload_photo");

    // Get highest resolution photo
    const bestPhoto = msg.photo[msg.photo.length - 1];

    const userCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(categories.id);

    try {
      const fileInfo = await this.client.getFile(bestPhoto.file_id);
      if (!fileInfo.file_path) {
        await this.client.sendMessage(chatId, "⚠️ Não foi possível baixar a imagem.");
        return;
      }

      const imageBuffer = await this.client.downloadFile(fileInfo.file_path);
      const parsed = await parseReceiptWithGemini(imageBuffer, "image/jpeg", userCategories);

      if (!parsed) {
        await this.client.sendMessage(
          chatId,
          "📸 Analisei a imagem, mas não consegui ler os dados do comprovante com clareza. Tente digitar o valor e a descrição manualmente.",
        );
        return;
      }

      await this.saveAndConfirmTransaction(
        chatId,
        userId,
        parsed,
        userCategories,
        `📸 <b>Comprovante / Recibo Identificado!</b>\n\n`,
      );
    } catch (err) {
      console.error("Erro ao processar foto:", err);
      await this.client.sendMessage(
        chatId,
        "⚠️ Erro ao analisar imagem. Certifique-se de que a GEMINI_API_KEY está configurada no .env.local para suporte a OCR visual.",
      );
    }
  }

  private async saveAndConfirmTransaction(
    chatId: string,
    userId: number,
    parsed: {
      description: string;
      amountCents: number;
      type: "income" | "expense";
      categoryId?: number;
      categoryName?: string;
      date?: string;
      isPaid?: boolean;
      isRecurring?: boolean;
      installments?: number;
    },
    categoriesList: (typeof categories.$inferSelect)[],
    prefixMsg = "",
  ): Promise<void> {
    // Resolve category
    let categoryId = parsed.categoryId;
    let catName = parsed.categoryName;

    if (!categoryId) {
      const match = categoriesList.find((c) => c.type === parsed.type);
      if (match) {
        categoryId = match.id;
        catName = match.name;
      } else {
        // Create a default category if none exists
        const [newCat] = await db
          .insert(categories)
          .values({
            userId,
            name: parsed.type === "income" ? "Renda Geral" : "Despesas Gerais",
            icon: parsed.type === "income" ? "TrendingUp" : "Wallet",
            color: parsed.type === "income" ? "#B7F34B" : "#FF6B6B",
            type: parsed.type,
          })
          .returning();
        categoryId = newCat.id;
        catName = newCat.name;
      }
    }

    const date = parsed.date || getTodayIso();
    const isPaid = typeof parsed.isPaid === "boolean" ? parsed.isPaid : true;
    const isRecurring = Boolean(parsed.isRecurring);

    let insertedId: number | null = null;

    // Handle installments
    if (parsed.installments && parsed.installments > 1) {
      const totalInst = parsed.installments;
      const installmentAmount = Math.round(parsed.amountCents / totalInst);
      const seriesId = `series_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const [baseYear, baseMonth, baseDay] = date.split("-").map(Number);

      const rows = Array.from({ length: totalInst }, (_, i) => {
        const d = new Date(baseYear, baseMonth - 1 + i, baseDay);
        const yStr = d.getFullYear();
        const mStr = String(d.getMonth() + 1).padStart(2, "0");
        const dStr = String(d.getDate()).padStart(2, "0");
        return {
          userId,
          description: parsed.description,
          amountCents: installmentAmount,
          type: parsed.type,
          categoryId: categoryId!,
          date: `${yStr}-${mStr}-${dStr}`,
          isPaid: i === 0 ? isPaid : false,
          isRecurring: false,
          seriesId,
          installmentNumber: i + 1,
          installmentTotal: totalInst,
        };
      });

      const created = await db.insert(transactions).values(rows).returning({ id: transactions.id });
      insertedId = created[0]?.id ?? null;

      let msg = prefixMsg;
      msg += `✅ <b>Lançamento Parcelado Criado!</b>\n\n`;
      msg += `📝 <b>${parsed.description}</b>\n`;
      msg += `💰 <b>${money(parsed.amountCents)}</b> em <b>${totalInst}x de ${money(installmentAmount)}</b>\n`;
      msg += `🏷️ Categoria: <b>${catName}</b>\n`;
      msg += `📅 Início: <b>${date}</b>\n`;
      msg += `📌 1ª Parcela: ${isPaid ? "✅ <i>Paga</i>" : "⏳ <i>Pendente</i>"}`;

      const buttons = [];
      if (!isPaid) {
        buttons.push([{ text: "✅ Marcar como Pago", callback_data: `pay_${insertedId}` }]);
      }
      buttons.push([
        { text: "🏷️ Alterar Categoria", callback_data: `editcat_${insertedId}` },
        { text: "🗑️ Desfazer", callback_data: `del_${insertedId}` },
      ]);
      buttons.push([{ text: "📊 Ver Resumo", callback_data: "view_summary" }]);

      await this.client.sendMessage(chatId, msg, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: buttons,
        },
      });

      if (parsed.type === "expense") {
        await checkBudgetAlert(userId, categoryId!);
      }
      return;
    }

    // Single transaction
    const [created] = await db
      .insert(transactions)
      .values({
        userId,
        description: parsed.description,
        amountCents: parsed.amountCents,
        type: parsed.type,
        categoryId: categoryId!,
        date,
        isPaid,
        isRecurring,
      })
      .returning({ id: transactions.id });

    insertedId = created.id;

    const isExpense = parsed.type === "expense";
    const typeLabel = isExpense ? "Despesa" : "Receita";
    const statusLabel = isPaid ? "✅ Pago" : "⏳ Pendente";

    let msg = prefixMsg;
    msg += `✅ <b>${typeLabel} Registrada com Sucesso!</b>\n\n`;
    msg += `📝 <b>${parsed.description}</b>\n`;
    msg += `💰 <code>${money(parsed.amountCents)}</code>\n`;
    msg += `🏷️ Categoria: <b>${catName}</b>\n`;
    msg += `📅 Data: <b>${date}</b>\n`;
    msg += `📌 Status: <b>${statusLabel}</b>`;
    if (isRecurring) msg += ` (🔁 Recorrente)`;

    const buttons = [];
    if (!isPaid) {
      buttons.push([{ text: "✅ Marcar como Pago", callback_data: `pay_${insertedId}` }]);
    }
    buttons.push([
      { text: "🏷️ Alterar Categoria", callback_data: `editcat_${insertedId}` },
      { text: "🗑️ Desfazer", callback_data: `del_${insertedId}` },
    ]);
    buttons.push([{ text: "📊 Ver Resumo", callback_data: "view_summary" }]);

    await this.client.sendMessage(chatId, msg, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    });

    if (isExpense) {
      await checkBudgetAlert(userId, categoryId!);
    }
  }

  private async sendSummary(chatId: string, userId: number): Promise<void> {
    const monthKey = getCurrentMonthKey();
    const rows = await db
      .select({
        amountCents: transactions.amountCents,
        type: transactions.type,
        isPaid: transactions.isPaid,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), like(transactions.date, `${monthKey}%`)));

    let income = 0;
    let expense = 0;
    let pendingExpense = 0;

    for (const r of rows) {
      if (r.type === "income") {
        income += r.amountCents;
      } else {
        expense += r.amountCents;
        if (!r.isPaid) pendingExpense += r.amountCents;
      }
    }

    const net = income - expense;
    const savingsRate = income > 0 ? Math.max(0, Math.round(((income - expense) / income) * 100)) : 0;

    const [y, m] = monthKey.split("-");
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];
    const monthLabel = `${monthNames[Number(m) - 1]} de ${y}`;

    let msg = `📊 <b>Resumo Financeiro — ${monthLabel}</b>\n\n`;
    msg += `🟢 <b>Receitas:</b> <code>${money(income)}</code>\n`;
    msg += `🔴 <b>Despesas:</b> <code>${money(expense)}</code>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 <b>Saldo Líquido:</b> <code>${net >= 0 ? "+" : ""}${money(net)}</code>\n`;
    msg += `📈 <b>Taxa de Poupança:</b> <code>${savingsRate}%</code>\n`;

    if (pendingExpense > 0) {
      msg += `⏳ <b>Contas Pendentes:</b> <code>${money(pendingExpense)}</code>\n`;
    }

    await this.client.sendMessage(chatId, msg, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📋 Ver Contas Pendentes", callback_data: "view_bills" },
            { text: "🏷️ Gastos por Categoria", callback_data: "view_spending" },
          ],
          [{ text: "📄 Exportar PDF do Mês", callback_data: `export_pdf_${monthKey}` }],
        ],
      },
    });
  }

  private async sendPendingBills(chatId: string, userId: number): Promise<void> {
    const today = getTodayIso();
    const currentMonthKey = getCurrentMonthKey();

    const pending = await db
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
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          eq(transactions.isPaid, false),
          like(transactions.date, `${currentMonthKey}%`),
        ),
      )
      .orderBy(transactions.date);

    if (pending.length === 0) {
      await this.client.sendMessage(
        chatId,
        `🎉 <b>Parabéns!</b> Não há contas pendentes para o mês atual (${currentMonthKey}). Todas as despesas estão pagas!`,
        { parse_mode: "HTML" },
      );
      return;
    }

    const totalPending = pending.reduce((sum, p) => sum + p.amountCents, 0);

    let msg = `📅 <b>Contas & Vencimentos do Mês (${pending.length})</b>\n`;
    msg += `Total a pagar: <b>${money(totalPending)}</b>\n\n`;

    const buttons = [];

    for (const b of pending) {
      const isOverdue = b.date < today;
      const isToday = b.date === today;
      const badge = isOverdue ? "🔴 <b>[ATRASADA]</b>" : isToday ? "🟡 <b>[HOJE]</b>" : "🟢";

      const [y, m, d] = b.date.split("-");
      msg += `${badge} <b>${b.description}</b>\n`;
      msg += `   💰 <code>${money(b.amountCents)}</code> | 🏷️ ${b.categoryName} | 📅 ${d}/${m}\n\n`;

      buttons.push([
        {
          text: `✅ Pagar: ${b.description.slice(0, 16)} (${money(b.amountCents)})`,
          callback_data: `pay_${b.id}`,
        },
      ]);
    }

    await this.client.sendMessage(chatId, msg, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons.slice(0, 8) },
    });
  }

  private async sendSpendingByCategory(chatId: string, userId: number): Promise<void> {
    const monthKey = getCurrentMonthKey();
    const rows = await db
      .select({
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        amountCents: transactions.amountCents,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          like(transactions.date, `${monthKey}%`),
        ),
      );

    if (rows.length === 0) {
      await this.client.sendMessage(chatId, "Nenhum gasto registrado neste mês ainda.");
      return;
    }

    const totalExpense = rows.reduce((sum, r) => sum + r.amountCents, 0);

    // Group by category
    const catMap = new Map<number, { name: string; spent: number }>();
    for (const r of rows) {
      const cur = catMap.get(r.categoryId) || { name: r.categoryName, spent: 0 };
      cur.spent += r.amountCents;
      catMap.set(r.categoryId, cur);
    }

    // Fetch budgets
    const userBudgets = await db
      .select()
      .from(budgets)
      .where(eq(budgets.userId, userId));

    const budgetMap = new Map(userBudgets.map((b) => [b.categoryId, b.amountCents]));

    const sorted = [...catMap.entries()].sort((a, b) => b[1].spent - a[1].spent);

    let msg = `🏷️ <b>Gastos por Categoria — ${monthKey}</b>\n`;
    msg += `Total Gasto: <b>${money(totalExpense)}</b>\n\n`;

    for (const [catId, info] of sorted) {
      const pctTotal = Math.round((info.spent / totalExpense) * 100);
      const budgetLimit = budgetMap.get(catId);

      msg += `▪️ <b>${info.name}</b>: <code>${money(info.spent)}</code> (${pctTotal}%)\n`;
      if (budgetLimit && budgetLimit > 0) {
        const ratio = Math.round((info.spent / budgetLimit) * 100);
        const barLength = Math.min(10, Math.round(ratio / 10));
        const bar = "█".repeat(barLength) + "░".repeat(10 - barLength);
        const statusEmoji = ratio > 100 ? "🚨" : ratio >= 80 ? "⚠️" : "🟢";
        msg += `   [${bar}] ${statusEmoji} ${ratio}% do teto de ${money(budgetLimit)}\n`;
      }
      msg += `\n`;
    }

    await this.client.sendMessage(chatId, msg, { parse_mode: "HTML" });
  }

  private async sendGoals(chatId: string, userId: number): Promise<void> {
    const userGoals = await db
      .select()
      .from(goals)
      .where(eq(goals.userId, userId))
      .orderBy(goals.id);

    if (userGoals.length === 0) {
      await this.client.sendMessage(
        chatId,
        "🎯 Você ainda não cadastrou metas. Crie novas metas na aba <b>Metas</b> no app Aurum!",
        { parse_mode: "HTML" },
      );
      return;
    }

    let msg = `🎯 <b>Minhas Metas Financeiras</b>\n\n`;
    for (const g of userGoals) {
      const pct = Math.min(100, Math.round((g.currentCents / g.targetCents) * 100));
      const barLength = Math.min(10, Math.round(pct / 10));
      const bar = "█".repeat(barLength) + "░".repeat(10 - barLength);

      msg += `✨ <b>${g.name}</b>\n`;
      msg += `   Acumulado: <code>${money(g.currentCents)}</code> / <code>${money(g.targetCents)}</code>\n`;
      msg += `   [${bar}] <b>${pct}%</b>\n\n`;
    }

    await this.client.sendMessage(chatId, msg, { parse_mode: "HTML" });
  }

  private async sendReportFile(chatId: string, userId: number, cmdText: string): Promise<void> {
    await this.client.sendChatAction(chatId, "upload_document");

    const parts = cmdText.split(/\s+/);
    const format = parts[1]?.toLowerCase() === "csv" ? "csv" : "pdf";
    const month = parts[2] && /^\d{4}-\d{2}$/.test(parts[2]) ? parts[2] : getCurrentMonthKey();

    const rows = await db
      .select({
        date: transactions.date,
        description: transactions.description,
        type: transactions.type,
        category: categories.name,
        amountCents: transactions.amountCents,
        installmentNumber: transactions.installmentNumber,
        installmentTotal: transactions.installmentTotal,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(eq(transactions.userId, userId), like(transactions.date, `${month}%`)))
      .orderBy(desc(transactions.date), desc(transactions.id));

    const income = rows.reduce((sum, r) => sum + (r.type === "income" ? r.amountCents : 0), 0);
    const expense = rows.reduce((sum, r) => sum + (r.type === "expense" ? r.amountCents : 0), 0);

    const filename = `aurum-${month}.${format}`;

    if (format === "csv") {
      const header = ["Data", "Descrição", "Tipo", "Categoria", "Parcela", "Valor (R$)"];
      const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
      const content = [
        header.map(csvCell).join(";"),
        ...rows.map((r) =>
          [
            r.date,
            r.description,
            r.type === "income" ? "Receita" : "Despesa",
            r.category,
            r.installmentTotal ? `${r.installmentNumber}/${r.installmentTotal}` : "",
            moneyNum(r.amountCents),
          ].map(csvCell).join(";"),
        ),
      ].join("\r\n");

      const buffer = Buffer.from(`\ufeff${content}`, "utf-8");
      await this.client.sendDocument(chatId, buffer, filename, `📄 <b>Relatório CSV Aurum — ${month}</b>`, {
        parse_mode: "HTML",
      });
      return;
    }

    // PDF export
    const lines = [
      `Receitas: ${money(income)} | Despesas: ${money(expense)} | Saldo: ${money(income - expense)}`,
      "",
      ...rows.map((r) =>
        `${r.date} | ${r.type === "income" ? "+" : "-"} ${money(r.amountCents)} | ${r.category} | ${r.description}${
          r.installmentTotal ? ` (${r.installmentNumber}/${r.installmentTotal})` : ""
        }`,
      ),
    ];

    const pdfUint8 = createPdf(`Aurum - Relatorio ${month}`, lines);
    const pdfBuffer = Buffer.from(pdfUint8);

    await this.client.sendDocument(chatId, pdfBuffer, filename, `📄 <b>Relatório PDF Aurum — ${month}</b>`, {
      parse_mode: "HTML",
    });
  }

  private async handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
    const data = query.data;
    const chatId = query.message?.chat.id ? String(query.message.chat.id) : null;
    const messageId = query.message?.message_id;

    if (!chatId || !data) {
      await this.client.answerCallbackQuery(query.id);
      return;
    }

    const user = await this.findUserByChatId(chatId);
    if (!user) {
      await this.client.answerCallbackQuery(query.id, { text: "Conta não conectada.", show_alert: true });
      return;
    }

    if (data === "view_summary") {
      await this.client.answerCallbackQuery(query.id);
      await this.sendSummary(chatId, user.id);
      return;
    }

    if (data === "view_bills") {
      await this.client.answerCallbackQuery(query.id);
      await this.sendPendingBills(chatId, user.id);
      return;
    }

    if (data === "view_spending") {
      await this.client.answerCallbackQuery(query.id);
      await this.sendSpendingByCategory(chatId, user.id);
      return;
    }

    if (data === "view_goals") {
      await this.client.answerCallbackQuery(query.id);
      await this.sendGoals(chatId, user.id);
      return;
    }

    if (data.startsWith("export_pdf_")) {
      const month = data.replace("export_pdf_", "");
      await this.client.answerCallbackQuery(query.id, { text: "Gerando PDF..." });
      await this.sendReportFile(chatId, user.id, `/relatorio pdf ${month}`);
      return;
    }

    // Pay a bill: pay_<txnId>
    if (data.startsWith("pay_")) {
      const txnId = parseInt(data.replace("pay_", ""), 10);
      if (isNaN(txnId)) {
        await this.client.answerCallbackQuery(query.id);
        return;
      }

      const [updated] = await db
        .update(transactions)
        .set({ isPaid: true })
        .where(and(eq(transactions.id, txnId), eq(transactions.userId, user.id)))
        .returning({ id: transactions.id, description: transactions.description, amountCents: transactions.amountCents });

      if (updated) {
        await this.client.answerCallbackQuery(query.id, {
          text: `✅ ${updated.description} marcada como paga!`,
        });

        if (messageId) {
          try {
            await this.client.sendMessage(
              chatId,
              `✅ <b>Conta Paga:</b> <b>${updated.description}</b> (${money(updated.amountCents)}) foi marcada como paga no Aurum!`,
              { parse_mode: "HTML" },
            );
          } catch {
            // ignore edit errors
          }
        }
      } else {
        await this.client.answerCallbackQuery(query.id, { text: "Conta não encontrada.", show_alert: true });
      }
      return;
    }

    // Choose category prompt: editcat_<txnId>
    if (data.startsWith("editcat_")) {
      const txnId = parseInt(data.replace("editcat_", ""), 10);
      if (isNaN(txnId)) {
        await this.client.answerCallbackQuery(query.id);
        return;
      }

      const [txn] = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, txnId), eq(transactions.userId, user.id)))
        .limit(1);

      if (!txn) {
        await this.client.answerCallbackQuery(query.id, { text: "Lançamento não encontrado.", show_alert: true });
        return;
      }

      const userCategories = await db
        .select()
        .from(categories)
        .where(and(eq(categories.userId, user.id), eq(categories.type, txn.type)))
        .orderBy(categories.id);

      const catButtons = [];
      for (let i = 0; i < userCategories.length; i += 2) {
        const row = [
          {
            text: userCategories[i].name,
            callback_data: `setcat_${txnId}_${userCategories[i].id}`,
          },
        ];
        if (userCategories[i + 1]) {
          row.push({
            text: userCategories[i + 1].name,
            callback_data: `setcat_${txnId}_${userCategories[i + 1].id}`,
          });
        }
        catButtons.push(row);
      }

      catButtons.push([{ text: "🔙 Cancelar", callback_data: `view_summary` }]);

      await this.client.answerCallbackQuery(query.id);
      await this.client.sendMessage(
        chatId,
        `🏷️ <b>Selecione a nova categoria para:</b>\n<i>"${txn.description}"</i> (${money(txn.amountCents)})`,
        {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: catButtons },
        },
      );
      return;
    }

    // Set new category: setcat_<txnId>_<catId>
    if (data.startsWith("setcat_")) {
      const parts = data.replace("setcat_", "").split("_");
      const txnId = parseInt(parts[0], 10);
      const catId = parseInt(parts[1], 10);

      if (isNaN(txnId) || !catId) {
        await this.client.answerCallbackQuery(query.id);
        return;
      }

      const [category] = await db
        .select()
        .from(categories)
        .where(and(eq(categories.id, catId), eq(categories.userId, user.id)))
        .limit(1);

      if (!category) {
        await this.client.answerCallbackQuery(query.id, { text: "Categoria não encontrada.", show_alert: true });
        return;
      }

      const [updated] = await db
        .update(transactions)
        .set({ categoryId: catId })
        .where(and(eq(transactions.id, txnId), eq(transactions.userId, user.id)))
        .returning({ id: transactions.id, description: transactions.description, amountCents: transactions.amountCents });

      if (updated) {
        await this.client.answerCallbackQuery(query.id, {
          text: `✅ Categoria alterada para ${category.name}!`,
        });

        await this.client.sendMessage(
          chatId,
          `🏷️ Categoria de <b>"${updated.description}"</b> alterada com sucesso para <b>${category.name}</b>!`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[{ text: "📊 Ver Resumo", callback_data: "view_summary" }]],
            },
          },
        );

        if (category.type === "expense") {
          await checkBudgetAlert(user.id, catId);
        }
      } else {
        await this.client.answerCallbackQuery(query.id, { text: "Lançamento não encontrado.", show_alert: true });
      }
      return;
    }

    // Delete/Undo a transaction: del_<txnId>
    if (data.startsWith("del_")) {
      const txnId = parseInt(data.replace("del_", ""), 10);
      if (!isNaN(txnId)) {
        await db
          .delete(transactions)
          .where(and(eq(transactions.id, txnId), eq(transactions.userId, user.id)));

        await this.client.answerCallbackQuery(query.id, { text: "Lançamento desfeito/excluído." });
        if (messageId) {
          try {
            await this.client.editMessageText(chatId, messageId, "🗑️ <i>Lançamento cancelado e removido do Aurum.</i>", {
              parse_mode: "HTML",
            });
          } catch {
            // ignore
          }
        }
      }
      return;
    }

    await this.client.answerCallbackQuery(query.id);
  }
}
