import { db } from "@/db";
import { budgets, categories, transactions } from "@/db/schema";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id) || id < 1)
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    const [transaction, budget] = await Promise.all([
      db.select({ id: transactions.id }).from(transactions)
        .where(and(eq(transactions.userId, user.id), eq(transactions.categoryId, id))).limit(1),
      db.select({ id: budgets.id }).from(budgets)
        .where(and(eq(budgets.userId, user.id), eq(budgets.categoryId, id))).limit(1),
    ]);
    if (transaction.length || budget.length)
      return NextResponse.json(
        { error: "Remova as transações e o orçamento vinculados antes de excluir esta categoria." },
        { status: 409 },
      );
    const [removed] = await db.delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
      .returning({ id: categories.id });
    if (!removed) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
