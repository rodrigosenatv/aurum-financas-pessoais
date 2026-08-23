import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { and, desc, eq, like } from "drizzle-orm";

export interface RecurringPreview {
  description: string;
  amountCents: number;
  type: "income" | "expense";
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  date: string;
}

export async function getMissingRecurringForMonth(userId: number, targetMonth: string) {
  // targetMonth format: "YYYY-MM"
  const [yearStr, monthStr] = targetMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { missing: [], counts: { expenses: 0, income: 0, total: 0 } };
  }

  const daysInMonth = new Date(year, month, 0).getDate();

  // 1. Fetch user categories map
  const userCats = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));
  const catMap = new Map(userCats.map((c) => [c.id, c]));

  // 2. Fetch distinct master templates defined by this user
  const userRecurring = await db
    .select({
      description: transactions.description,
      amountCents: transactions.amountCents,
      type: transactions.type,
      categoryId: transactions.categoryId,
      date: transactions.date,
      seriesId: transactions.seriesId,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.isRecurring, true)))
    .orderBy(desc(transactions.date), desc(transactions.id));

  if (userRecurring.length === 0) {
    return { missing: [], counts: { expenses: 0, income: 0, total: 0 } };
  }

  // Deduplicate to get the latest unique template per description+type+categoryId
  const templatesMap = new Map<string, (typeof userRecurring)[0]>();
  for (const item of userRecurring) {
    const key = `${item.type}:${item.categoryId}:${item.description.trim().toLowerCase()}`;
    if (!templatesMap.has(key)) {
      templatesMap.set(key, item);
    }
  }

  // 3. Fetch existing transactions in target month
  const existingInMonth = await db
    .select({
      description: transactions.description,
      type: transactions.type,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), like(transactions.date, `${targetMonth}%`)));

  const existingKeys = new Set(
    existingInMonth.map((t) => `${t.type}:${t.categoryId}:${t.description.trim().toLowerCase()}`),
  );

  // 4. Identify missing items
  const missing: RecurringPreview[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");

  let expensesCount = 0;
  let incomeCount = 0;

  for (const [key, tpl] of templatesMap.entries()) {
    if (!existingKeys.has(key)) {
      const origDay = Number(tpl.date.split("-")[2]) || 10;
      const day = Math.min(Math.max(1, origDay), daysInMonth);
      const newDate = `${targetMonth}-${pad(day)}`;
      const cat = catMap.get(tpl.categoryId);

      if (tpl.type === "expense") expensesCount++;
      else incomeCount++;

      missing.push({
        description: tpl.description,
        amountCents: tpl.amountCents,
        type: tpl.type as "income" | "expense",
        categoryId: tpl.categoryId,
        categoryName: cat?.name ?? "Geral",
        categoryIcon: cat?.icon ?? "Wallet",
        categoryColor: cat?.color ?? "#B7F34B",
        date: newDate,
      });
    }
  }

  return {
    missing,
    counts: {
      expenses: expensesCount,
      income: incomeCount,
      total: missing.length,
    },
  };
}

export async function importRecurringForMonth(userId: number, targetMonth: string) {
  const { missing } = await getMissingRecurringForMonth(userId, targetMonth);
  if (missing.length === 0) return [];

  const toInsert = missing.map((item) => ({
    userId,
    description: item.description,
    amountCents: item.amountCents,
    type: item.type,
    categoryId: item.categoryId,
    date: item.date,
    isPaid: false, // Default to pending payment for new month
    isRecurring: true,
  }));

  const created = await db
    .insert(transactions)
    .values(toInsert)
    .returning({ id: transactions.id });

  return created;
}

