import { db } from "@/db";
import { budgets } from "@/db/schema";
import { apiError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };
const idFrom = async (ctx: Ctx) => Number((await ctx.params).id);

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const id = await idFrom(ctx);
    const body = await readJson(request);
    const amount = Number(body?.amountCents);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(amount) || amount <= 0)
      return NextResponse.json({ error: "ID ou valor inválido." }, { status: 400 });
    const [updated] = await db.update(budgets).set({ amountCents: amount })
      .where(and(eq(budgets.id, id), eq(budgets.userId, user.id))).returning();
    if (!updated) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const id = await idFrom(ctx);
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    const [removed] = await db.delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, user.id))).returning({ id: budgets.id });
    if (!removed) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
