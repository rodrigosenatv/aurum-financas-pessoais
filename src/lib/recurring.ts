import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { and, desc, eq, like } from "drizzle-orm";

export async function ensureRecurringForMonth(userId: number, targetMonth: string) {
  // targetMonth format: "YYYY-MM"
  const [yearStr, monthStr] = targetMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-indexed

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return [];
  }

  const daysInMonth = new Date(year, month, 0).getDate();

  // 1. Fetch all distinct recurring templates/items defined by this user
  const userRecurring = await db
    .select({
      description: transactions.description,
      amountCents: transactions.amountCents,
      type: transactions.type,
      categoryId: transactions.categoryId,
      date: transactions.date,
      seriesId: transactions.seriesId,
      installmentTotal: transactions.installmentTotal,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.isRecurring, true)))
    .orderBy(desc(transactions.date), desc(transactions.id));

  if (userRecurring.length === 0) return [];

  // Group by unique description + type + categoryId to get the latest master template
  const templatesMap = new Map<string, (typeof userRecurring)[0]>();
  for (const item of userRecurring) {
    const key = `${item.type}:${item.categoryId}:${item.description.trim().toLowerCase()}`;
    if (!templatesMap.has(key)) {
      templatesMap.set(key, item);
    }
  }

  // 2. Fetch existing transactions in the target month for this user
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

  // 3. Identify which recurring templates are missing in the target month
  const toInsert: (typeof transactions.$inferInsert)[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");

  for (const [key, tpl] of templatesMap.entries()) {
    if (!existingKeys.has(key)) {
      // Extract original day from tpl.date
      const origDay = Number(tpl.date.split("-")[2]) || 10;
      const day = Math.min(Math.max(1, origDay), daysInMonth);
      const newDate = `${targetMonth}-${pad(day)}`;

      toInsert.push({
        userId,
        description: tpl.description,
        amountCents: tpl.amountCents,
        type: tpl.type,
        categoryId: tpl.categoryId,
        date: newDate,
        isPaid: false, // In a new month, defaults to pending payment
        isRecurring: true,
        seriesId: tpl.seriesId ?? null,
      });
    }
  }

  if (toInsert.length === 0) return [];

  const created = await db.insert(transactions).values(toInsert).returning();
  return created;
}
