import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { sql } from "drizzle-orm";
import { db } from "./index";
import { hashPassword } from "../lib/password";
import { budgets, categories, goals, sessions, transactions, users } from "./schema";

// ---------------------------------------------------------------------------
// PRNG determinístico para consistência nos meses anteriores
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(12345);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const cents = (v: number) => Math.round(v * 100);

const pad = (n: number) => String(n).padStart(2, "0");

const EXPENSE_CATEGORIES = [
  { name: "Moradia & Habitação", icon: "Home", color: "#8B8CF6" },
  { name: "Contas & Serviços", icon: "ReceiptText", color: "#9DF65C" },
  { name: "Alimentação & Mercado", icon: "Utensils", color: "#F6A35C" },
  { name: "Transporte & Auto", icon: "CarFront", color: "#5CC8F6" },
  { name: "Dívidas & Cartões", icon: "CreditCard", color: "#F65C6E" },
  { name: "Família & Pessoal", icon: "Heart", color: "#F65CB1" },
  { name: "Saúde & Lazer", icon: "Activity", color: "#38BDF8" },
  { name: "Investimentos & Reserva", icon: "PiggyBank", color: "#4ADE80" },
] as const;

const INCOME_CATEGORIES = [
  { name: "Salário", icon: "BriefcaseBusiness", color: "#B7F34B" },
  { name: "Freelance", icon: "Laptop", color: "#6EE7B7" },
  { name: "Renda Extra & Reembolsos", icon: "Coins", color: "#FDE047" },
] as const;

// Transações exatas do mês atual baseadas na planilha financeira do Rodrigo
const CURRENT_MONTH_EXACT_TRANSACTIONS = [
  // --- RECEITAS (Total: R$ 8.840,00) ---
  { day: 5, description: "Salário Rodrigo", amount: 5470.0, type: "income" as const, catName: "Salário", isPaid: true, isRecurring: true },
  { day: 10, description: "Freelancer Coder", amount: 3000.0, type: "income" as const, catName: "Freelance", isPaid: true, isRecurring: true },
  { day: 18, description: "Extra", amount: 300.0, type: "income" as const, catName: "Renda Extra & Reembolsos", isPaid: true, isRecurring: false },
  { day: 10, description: "Internet Vó (Reembolso)", amount: 70.0, type: "income" as const, catName: "Renda Extra & Reembolsos", isPaid: true, isRecurring: true },

  // --- INVESTIMENTOS (Total: R$ 100,00) ---
  { day: 5, description: "Poupança", amount: 100.0, type: "expense" as const, catName: "Investimentos & Reserva", isPaid: true, isRecurring: true },

  // --- DÍVIDAS & PARCELAS (Total: R$ 1.766,10) ---
  { day: 10, description: "Bola (6/10)", amount: 600.0, type: "expense" as const, catName: "Dívidas & Cartões", isPaid: true, isRecurring: false, seriesId: "bola-debt", installmentNumber: 6, installmentTotal: 10 },
  { day: 15, description: "Neon (5/8)", amount: 217.0, type: "expense" as const, catName: "Dívidas & Cartões", isPaid: true, isRecurring: false, seriesId: "neon-debt", installmentNumber: 5, installmentTotal: 8 },
  { day: 20, description: "C6 Bank", amount: 949.1, type: "expense" as const, catName: "Dívidas & Cartões", isPaid: true, isRecurring: true },
  { day: 5, description: "PicPay", amount: 617.34, type: "expense" as const, catName: "Dívidas & Cartões", isPaid: true, isRecurring: true },

  // --- MORADIA & CONTAS (Despesas Fixas) ---
  { day: 10, description: "Aluguel", amount: 1100.0, type: "expense" as const, catName: "Moradia & Habitação", isPaid: true, isRecurring: true },
  { day: 8, description: "Energia", amount: 260.0, type: "expense" as const, catName: "Contas & Serviços", isPaid: true, isRecurring: true },
  { day: 15, description: "Embasa", amount: 67.0, type: "expense" as const, catName: "Contas & Serviços", isPaid: true, isRecurring: true },
  { day: 10, description: "Telefone", amount: 51.7, type: "expense" as const, catName: "Contas & Serviços", isPaid: true, isRecurring: true },
  { day: 10, description: "Internet Vó", amount: 84.13, type: "expense" as const, catName: "Contas & Serviços", isPaid: true, isRecurring: true },

  // --- ALIMENTAÇÃO ---
  { day: 5, description: "Mercado", amount: 1800.0, type: "expense" as const, catName: "Alimentação & Mercado", isPaid: true, isRecurring: true },
  { day: 11, description: "Almoço dia dos Pais", amount: 183.0, type: "expense" as const, catName: "Alimentação & Mercado", isPaid: false, isRecurring: false }, // Pendente na planilha!
  { day: 18, description: "Alimentação no trabalho", amount: 100.0, type: "expense" as const, catName: "Alimentação & Mercado", isPaid: true, isRecurring: true },
  { day: 23, description: "Alimentação fora", amount: 77.58, type: "expense" as const, catName: "Alimentação & Mercado", isPaid: true, isRecurring: false },
  { day: 26, description: "Açaí", amount: 36.73, type: "expense" as const, catName: "Alimentação & Mercado", isPaid: true, isRecurring: false },

  // --- TRANSPORTE & AUTO ---
  { day: 4, description: "Gasolina", amount: 350.0, type: "expense" as const, catName: "Transporte & Auto", isPaid: true, isRecurring: true },
  { day: 12, description: "Troca de óleo + Lâmpada", amount: 350.0, type: "expense" as const, catName: "Transporte & Auto", isPaid: true, isRecurring: false },
  { day: 17, description: "Lavagem carro", amount: 50.0, type: "expense" as const, catName: "Transporte & Auto", isPaid: true, isRecurring: false },
  { day: 21, description: "Película + Suporte", amount: 75.0, type: "expense" as const, catName: "Transporte & Auto", isPaid: true, isRecurring: false },
  { day: 22, description: "Gasolina", amount: 300.0, type: "expense" as const, catName: "Transporte & Auto", isPaid: true, isRecurring: true },
  { day: 13, description: "Estacionamento", amount: 13.0, type: "expense" as const, catName: "Transporte & Auto", isPaid: true, isRecurring: false },

  // --- FAMÍLIA & PESSOAL ---
  { day: 5, description: "Perfume Eliene", amount: 300.0, type: "expense" as const, catName: "Família & Pessoal", isPaid: true, isRecurring: false },
  { day: 5, description: "Laís", amount: 178.0, type: "expense" as const, catName: "Família & Pessoal", isPaid: true, isRecurring: false },
  { day: 10, description: "Help mother", amount: 200.0, type: "expense" as const, catName: "Família & Pessoal", isPaid: true, isRecurring: true },
  { day: 11, description: "Camisa dia dos Pais", amount: 136.98, type: "expense" as const, catName: "Família & Pessoal", isPaid: true, isRecurring: false },
  { day: 14, description: "Unha Laís", amount: 150.0, type: "expense" as const, catName: "Família & Pessoal", isPaid: true, isRecurring: true },
  { day: 16, description: "Gorro", amount: 60.0, type: "expense" as const, catName: "Família & Pessoal", isPaid: true, isRecurring: false },
  { day: 25, description: "Amo Make", amount: 28.98, type: "expense" as const, catName: "Família & Pessoal", isPaid: true, isRecurring: false },

  // --- SAÚDE & LAZER ---
  { day: 9, description: "Farmácia", amount: 274.37, type: "expense" as const, catName: "Saúde & Lazer", isPaid: true, isRecurring: false },
  { day: 10, description: "MMA", amount: 80.0, type: "expense" as const, catName: "Saúde & Lazer", isPaid: true, isRecurring: true },
];

async function main() {
  console.log("Limpando tabelas...");
  await db.delete(transactions);
  await db.delete(budgets);
  await db.delete(goals);
  await db.delete(categories);
  await db.delete(sessions);
  await db.delete(users);
  await db.execute(sql`ALTER SEQUENCE categories_id_seq RESTART WITH 1`);
  await db.execute(sql`ALTER SEQUENCE transactions_id_seq RESTART WITH 1`);

  const [demoUser] = await db
    .insert(users)
    .values({
      name: "Rodrigo",
      email: "demo@aurum.app",
      passwordHash: hashPassword("aurum123"),
    })
    .returning();

  console.log("Inserindo categorias personalizadas...");
  const insertedExpenses = await db
    .insert(categories)
    .values(EXPENSE_CATEGORIES.map((c) => ({ ...c, userId: demoUser.id, type: "expense" as const })))
    .returning();
  const insertedIncomes = await db
    .insert(categories)
    .values(INCOME_CATEGORIES.map((c) => ({ ...c, userId: demoUser.id, type: "income" as const })))
    .returning();

  const cat = Object.fromEntries(
    [...insertedExpenses, ...insertedIncomes].map((c) => [c.name, c.id]),
  );

  console.log("Gerando transações históricas e mês atual com status de pagamento...");
  const rows: (typeof transactions.$inferInsert)[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  for (let m = 6; m >= 0; m--) {
    const monthDate = new Date(currentYear, currentMonth - m, 1);
    const y = monthDate.getFullYear();
    const mo = monthDate.getMonth();
    const daysInMonth = new Date(y, mo + 1, 0).getDate();

    if (m === 0) {
      // Mês Atual: Inserir exatamente os lançamentos da planilha
      for (const item of CURRENT_MONTH_EXACT_TRANSACTIONS) {
        const d = Math.min(Math.max(1, item.day), daysInMonth);
        rows.push({
          userId: demoUser.id,
          description: item.description,
          amountCents: cents(item.amount),
          type: item.type,
          categoryId: cat[item.catName],
          date: `${y}-${pad(mo + 1)}-${pad(d)}`,
          isPaid: item.isPaid,
          isRecurring: item.isRecurring,
          seriesId: item.seriesId ?? null,
          installmentNumber: item.installmentNumber ?? null,
          installmentTotal: item.installmentTotal ?? null,
        });
      }
    } else {
      // Meses Anteriores: Simulação histórica coerente com a realidade do Rodrigo
      const addHist = (
        day: number,
        description: string,
        amount: number,
        type: "income" | "expense",
        catId: number,
        isRecurring = false,
        extra?: { seriesId?: string; installmentNumber?: number; installmentTotal?: number },
      ) => {
        const d = Math.min(Math.max(1, Math.round(day)), daysInMonth);
        rows.push({
          userId: demoUser.id,
          description,
          amountCents: cents(amount),
          type,
          categoryId: catId,
          date: `${y}-${pad(mo + 1)}-${pad(d)}`,
          isPaid: true, // Meses passados já foram pagos
          isRecurring,
          seriesId: extra?.seriesId ?? null,
          installmentNumber: extra?.installmentNumber ?? null,
          installmentTotal: extra?.installmentTotal ?? null,
        });
      };

      // Receitas
      addHist(5, "Salário Rodrigo", 5470, "income", cat["Salário"], true);
      addHist(10, "Freelancer Coder", between(2600, 3200), "income", cat["Freelance"], true);
      if (rand() > 0.4) {
        addHist(18, "Extra — Projeto freela", between(200, 500), "income", cat["Renda Extra & Reembolsos"], false);
      }
      addHist(10, "Internet Vó (Reembolso)", 70, "income", cat["Renda Extra & Reembolsos"], true);

      // Investimentos
      addHist(5, "Poupança", 100, "expense", cat["Investimentos & Reserva"], true);

      // Parcelas históricas
      const bolaParcel = 6 - m;
      if (bolaParcel >= 1 && bolaParcel <= 10) {
        addHist(10, `Bola (${bolaParcel}/10)`, 600, "expense", cat["Dívidas & Cartões"], false, {
          seriesId: "bola-debt",
          installmentNumber: bolaParcel,
          installmentTotal: 10,
        });
      }
      const neonParcel = 5 - m;
      if (neonParcel >= 1 && neonParcel <= 8) {
        addHist(15, `Neon (${neonParcel}/8)`, 217, "expense", cat["Dívidas & Cartões"], false, {
          seriesId: "neon-debt",
          installmentNumber: neonParcel,
          installmentTotal: 8,
        });
      }
      addHist(20, "C6 Bank", between(750, 1100), "expense", cat["Dívidas & Cartões"], true);
      addHist(5, "PicPay", between(400, 650), "expense", cat["Dívidas & Cartões"], true);

      // Moradia & Contas Fixas
      addHist(10, "Aluguel", 1100, "expense", cat["Moradia & Habitação"], true);
      addHist(8, "Energia", between(220, 290), "expense", cat["Contas & Serviços"], true);
      addHist(15, "Embasa", between(55, 80), "expense", cat["Contas & Serviços"], true);
      addHist(10, "Telefone", 51.7, "expense", cat["Contas & Serviços"], true);
      addHist(10, "Internet Vó", 84.13, "expense", cat["Contas & Serviços"], true);

      // Alimentação & Mercado
      addHist(5, "Mercado mensal", between(1600, 1950), "expense", cat["Alimentação & Mercado"], true);
      addHist(14, "Alimentação / Lanches", between(150, 320), "expense", cat["Alimentação & Mercado"], false);
      addHist(24, "Restaurante / Açaí", between(80, 180), "expense", cat["Alimentação & Mercado"], false);

      // Transporte
      addHist(6, "Gasolina", between(280, 360), "expense", cat["Transporte & Auto"], true);
      addHist(22, "Gasolina", between(250, 320), "expense", cat["Transporte & Auto"], true);
      if (rand() > 0.5) addHist(16, "Manutenção / Lavagem carro", between(50, 180), "expense", cat["Transporte & Auto"], false);

      // Pessoal & Família
      addHist(10, "Help mother", 200, "expense", cat["Família & Pessoal"], true);
      addHist(5, "Laís / Pessoal", between(150, 300), "expense", cat["Família & Pessoal"], false);
      if (rand() > 0.6) addHist(19, "Compras pessoais", between(80, 220), "expense", cat["Família & Pessoal"], false);

      // Saúde & Lazer
      addHist(10, "MMA", 80, "expense", cat["Saúde & Lazer"], true);
      addHist(12, "Farmácia", between(90, 280), "expense", cat["Saúde & Lazer"], false);
    }
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : 1));
  await db.insert(transactions).values(rows);
  console.log(`${rows.length} transações inseridas com sucesso.`);

  console.log("Inserindo orçamentos mensais de referência...");
  await db.insert(budgets).values([
    { userId: demoUser.id, categoryId: cat["Alimentação & Mercado"], amountCents: cents(2200) },
    { userId: demoUser.id, categoryId: cat["Dívidas & Cartões"], amountCents: cents(2000) },
    { userId: demoUser.id, categoryId: cat["Moradia & Habitação"], amountCents: cents(1200) },
    { userId: demoUser.id, categoryId: cat["Transporte & Auto"], amountCents: cents(1150) },
    { userId: demoUser.id, categoryId: cat["Família & Pessoal"], amountCents: cents(1100) },
    { userId: demoUser.id, categoryId: cat["Contas & Serviços"], amountCents: cents(500) },
    { userId: demoUser.id, categoryId: cat["Saúde & Lazer"], amountCents: cents(400) },
    { userId: demoUser.id, categoryId: cat["Investimentos & Reserva"], amountCents: cents(200) },
  ]);

  console.log("Inserindo metas financeiras...");
  await db.insert(goals).values([
    {
      userId: demoUser.id,
      name: "Poupança & Reserva de Emergência",
      icon: "PiggyBank",
      color: "#4ADE80",
      targetCents: cents(15000),
      currentCents: cents(1200),
    },
    {
      userId: demoUser.id,
      name: "Quitação de Dívidas (Bola & Neon)",
      icon: "CreditCard",
      color: "#F65C6E",
      targetCents: cents(7736),
      currentCents: cents(4685),
    },
    {
      userId: demoUser.id,
      name: "Setup & Equipamentos Dev Coder",
      icon: "Laptop",
      color: "#6EE7B7",
      targetCents: cents(6000),
      currentCents: cents(2400),
    },
  ]);

  console.log("Seed com dados atualizados do Rodrigo concluído! ✔");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
