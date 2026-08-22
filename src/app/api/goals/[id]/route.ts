import { db } from "@/db";
import { goals } from "@/db/schema";
import { apiError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };
const idFrom = async (ctx: Ctx) => Number((await ctx.params).id);

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const id = await idFrom(ctx);
    const body = await readJson(request);
    const addCents = Number(body?.addCents);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(addCents) || addCents <= 0)
      return NextResponse.json({ error: "ID ou valor inválido." }, { status: 400 });
    const [updated] = await db.update(goals)
      .set({ currentCents: sql`${goals.currentCents} + ${addCents}` })
      .where(and(eq(goals.id, id), eq(goals.userId, user.id))).returning();
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
    const [removed] = await db.delete(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, user.id))).returning({ id: goals.id });
    if (!removed) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
