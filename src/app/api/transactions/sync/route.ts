import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { apiError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getMissingRecurringForMonth, importRecurringForMonth } from "@/lib/recurring";
import { and, desc, eq, like } from "drizzle-orm";
import { NextResponse } from "next/server";

const MONTH_RE = /^\d{4}-\d{2}$/;

// GET /api/transactions/sync?month=YYYY-MM
// Returns preview of missing recurring items without modifying the database
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || "";

    if (!MONTH_RE.test(month)) {
      return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
    }

    const preview = await getMissingRecurringForMonth(user.id, month);
    return NextResponse.json(preview);
  } catch (error) {
    return apiError(error);
  }
}

// POST /api/transactions/sync
// Imports recurring items when user explicitly confirms
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const month = typeof body?.month === "string" ? body.month : "";

    if (!MONTH_RE.test(month)) {
      return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
    }

    // Explicit manual import
    if (body?.action === "import") {
      await importRecurringForMonth(user.id, month);
    }

    // Fetch transactions in this month
    const rows = await db
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
      .where(and(eq(transactions.userId, user.id), like(transactions.date, `${month}%`)))
      .orderBy(desc(transactions.date), desc(transactions.id));

    return NextResponse.json(
      rows.map((t) => ({
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
    );
  } catch (error) {
    return apiError(error);
  }
}

