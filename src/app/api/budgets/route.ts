import { db } from "@/db";
import { budgets, categories } from "@/db/schema";
import { apiError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await db.select().from(budgets).where(eq(budgets.userId, user.id)));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const categoryId = Number(body?.categoryId);
    const amountCents = Number(body?.amountCents);
    if (!Number.isInteger(categoryId) || categoryId < 1 || !Number.isInteger(amountCents) || amountCents <= 0)
      return NextResponse.json({ error: "Categoria ou valor inválido." }, { status: 400 });
    const [category] = await db.select().from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, user.id), eq(categories.type, "expense")))
      .limit(1);
    if (!category) return NextResponse.json({ error: "Categoria de despesa inválida." }, { status: 400 });
    const [existing] = await db.select({ id: budgets.id }).from(budgets)
      .where(and(eq(budgets.userId, user.id), eq(budgets.categoryId, categoryId))).limit(1);
    if (existing) return NextResponse.json({ error: "Esta categoria já possui orçamento." }, { status: 409 });
    const [created] = await db.insert(budgets)
      .values({ userId: user.id, categoryId, amountCents }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
