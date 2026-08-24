import { db } from "@/db";
import { budgets, categories, transactions } from "@/db/schema";
import { apiError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

const COLOR_RE = /^#[0-9a-f]{6}$/i;

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id) || id < 1)
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });

    const body = await readJson(request);
    const updates: Partial<{ name: string; icon: string; color: string; type: "income" | "expense" }> = {};

    if (body?.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 2 || name.length > 50) {
        return NextResponse.json({ error: "Nome de categoria deve ter entre 2 e 50 caracteres." }, { status: 400 });
      }
      updates.name = name;
    }

    if (body?.icon !== undefined) {
      if (typeof body.icon !== "string" || !body.icon) {
        return NextResponse.json({ error: "Ícone inválido." }, { status: 400 });
      }
      updates.icon = body.icon;
    }

    if (body?.color !== undefined) {
      if (typeof body.color !== "string" || !COLOR_RE.test(body.color)) {
        return NextResponse.json({ error: "Cor inválida." }, { status: 400 });
      }
      updates.color = body.color;
    }

    if (body?.type !== undefined) {
      if (body.type !== "income" && body.type !== "expense") {
        return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
      }
      updates.type = body.type;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nenhum dado informado para atualização." }, { status: 400 });
    }

    const [updated] = await db
      .update(categories)
      .set(updates)
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

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
