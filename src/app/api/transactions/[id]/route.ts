import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { apiError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
type Ctx = { params: Promise<{ id: string }> };

async function parseId(ctx: Ctx): Promise<number | null> {
  const n = Number((await ctx.params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const id = await parseId(ctx);
    if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    const body = await readJson(request);
    if (!body) return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    const patch: Partial<typeof transactions.$inferInsert> = {};
    if (body.description !== undefined) {
      if (typeof body.description !== "string" || body.description.trim().length < 1 || body.description.length > 160)
        return NextResponse.json({ error: "Descrição inválida." }, { status: 400 });
      patch.description = body.description.trim();
    }
    if (body.amountCents !== undefined) {
      if (typeof body.amountCents !== "number" || !Number.isInteger(body.amountCents) || body.amountCents <= 0)
        return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
      patch.amountCents = body.amountCents;
    }
    if (body.type !== undefined) {
      if (body.type !== "income" && body.type !== "expense")
        return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
      patch.type = body.type;
    }
    if (body.categoryId !== undefined) {
      if (typeof body.categoryId !== "number" || !Number.isInteger(body.categoryId))
        return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
      const [category] = await db
        .select({ id: categories.id, type: categories.type })
        .from(categories)
        .where(and(eq(categories.id, body.categoryId), eq(categories.userId, user.id)))
        .limit(1);
      let expectedType = patch.type;
      if (!expectedType) {
        const [current] = await db
          .select({ type: transactions.type })
          .from(transactions)
          .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
          .limit(1);
        if (!current) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
        expectedType = current.type;
      }
      if (!category || category.type !== expectedType)
        return NextResponse.json({ error: "Categoria inválida para este tipo." }, { status: 400 });
      patch.categoryId = body.categoryId;
    }
    if (body.date !== undefined) {
      if (typeof body.date !== "string" || !DATE_RE.test(body.date) || Number.isNaN(Date.parse(`${body.date}T12:00:00`)))
        return NextResponse.json({ error: "Data inválida." }, { status: 400 });
      patch.date = body.date;
    }
    if (body.isPaid !== undefined) {
      patch.isPaid = Boolean(body.isPaid);
    }
    if (body.isRecurring !== undefined) {
      patch.isRecurring = Boolean(body.isRecurring);
    }
    if (Object.keys(patch).length === 0)
      return NextResponse.json({ error: "Nenhuma alteração enviada." }, { status: 400 });
    if (patch.type && patch.categoryId === undefined) {
      const [current] = await db
        .select({ categoryId: transactions.categoryId })
        .from(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
        .limit(1);
      if (!current) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
      const [category] = await db
        .select({ type: categories.type })
        .from(categories)
        .where(and(eq(categories.id, current.categoryId), eq(categories.userId, user.id)))
        .limit(1);
      if (!category || category.type !== patch.type)
        return NextResponse.json({ error: "Escolha uma categoria compatível com o novo tipo." }, { status: 400 });
    }
    const [updated] = await db
      .update(transactions)
      .set(patch)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .returning();
    if (!updated) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const id = await parseId(ctx);
    if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    const [removed] = await db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .returning({ id: transactions.id });
    if (!removed) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
