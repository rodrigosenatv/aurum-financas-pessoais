import { db } from "@/db";
import { budgets, categories, goals, transactions } from "@/db/schema";
import { FinanceApp } from "@/components/finance-app";
import { AuthScreen } from "@/components/auth-screen";
import { getCurrentUser } from "@/lib/auth";
import type { FinanceData } from "@/lib/types";
import { desc, eq } from "drizzle-orm";

import { ensureRecurringForMonth } from "@/lib/recurring";

export const dynamic = "force-dynamic";

async function loadData(userId: number): Promise<FinanceData> {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await ensureRecurringForMonth(userId, currentMonthKey).catch((e) => console.error("Recurring sync error:", e));

  const [cats, txns, bds, gls] = await Promise.all([
    db.select().from(categories).where(eq(categories.userId, userId)).orderBy(categories.id),
    db
      .select({
        id: transactions.id,
        description: transactions.description,
        amountCents: transactions.amountCents,
        type: transactions.type,
        categoryId: transactions.categoryId,
        date: transactions.date,
        isPaid: transactions.isPaid,
        isRecurring: transactions.isRecurring,
        seriesId: transactions.seriesId,
        installmentNumber: transactions.installmentNumber,
        installmentTotal: transactions.installmentTotal,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date), desc(transactions.id)),
    db.select().from(budgets).where(eq(budgets.userId, userId)).orderBy(budgets.id),
    db.select().from(goals).where(eq(goals.userId, userId)).orderBy(goals.id),
  ]);

  return {
    categories: cats,
    transactions: txns.map((t) => ({
      id: t.id,
      description: t.description,
      amountCents: t.amountCents,
      type: t.type,
      categoryId: t.categoryId,
      date: t.date,
      isPaid: t.isPaid,
      isRecurring: t.isRecurring,
      seriesId: t.seriesId,
      installmentNumber: t.installmentNumber,
      installmentTotal: t.installmentTotal,
      category: {
        name: t.categoryName,
        icon: t.categoryIcon,
        color: t.categoryColor,
      },
    })),
    budgets: bds,
    goals: gls,
  };
}

async function getPageState() {
  try {
    const user = await getCurrentUser();
    if (!user) return { kind: "anonymous" as const };
    const data = await loadData(user.id);
    return { kind: "ready" as const, data, user };
  } catch (error) {
    console.error(error);
    return { kind: "error" as const };
  }
}

export default async function Page() {
  const state = await getPageState();
  if (state.kind === "ready") return <FinanceApp initialData={state.data} user={state.user} />;
  if (state.kind === "error")
    return <AuthScreen databaseError="O banco de dados está indisponível. Confira DATABASE_URL, execute npm run db:push e tente novamente." />;
  return <AuthScreen />;
}
