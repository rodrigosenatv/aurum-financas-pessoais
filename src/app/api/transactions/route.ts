import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { apiError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validate(body: Record<string, unknown>): string | null {
  const { description, amountCents, type, categoryId, date } = body;
  if (typeof description !== "string" || description.trim().length < 1 || description.length > 160)
    return "Descrição inválida.";
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents <= 0)
    return "Valor inválido.";
  if (type !== "income" && type !== "expense") return "Tipo inválido.";
  if (typeof categoryId !== "number" || !Number.isInteger(categoryId) || categoryId < 1)
    return "Categoria inválida.";
  if (typeof date !== "string" || !DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00`)))
    return "Data inválida.";
  const installments = body.installments === undefined ? 1 : Number(body.installments);
  if (!Number.isInteger(installments) || installments < 1 || installments > 60)
    return "O parcelamento deve ter entre 1 e 60 parcelas.";
  if (body.repeat !== undefined && body.repeat !== "none" && body.repeat !== "monthly")
    return "Recorrência inválida.";
  if (installments > 1 && body.repeat === "monthly")
    return "Escolha parcelamento ou recorrência mensal.";
  if (installments > 1 && type !== "expense") return "Somente despesas podem ser parceladas.";
  return null;
}

function shiftISO(iso: string, months: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(
    Math.min(day, maxDay),
  ).padStart(2, "0")}`;
}

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, user.id))
      .orderBy(desc(transactions.date), desc(transactions.id));
    return NextResponse.json(rows);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    if (!body) return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    const error = validate(body);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, body.categoryId as number), eq(categories.userId, user.id)))
      .limit(1);
    if (!category || category.type !== body.type)
      return NextResponse.json({ error: "Categoria inválida para este tipo." }, { status: 400 });

    const installments = Number(body.installments ?? 1);
    const count = body.repeat === "monthly" ? 12 : installments;
    const seriesId = count > 1 ? randomUUID() : null;
    const isRecurring = Boolean(body.isRecurring) || body.repeat === "monthly";
    const isPaid = typeof body.isPaid === "boolean" ? body.isPaid : true;
    const totalCents = body.amountCents as number;
    const baseCents = installments > 1 ? Math.floor(totalCents / installments) : totalCents;
    const remainder = installments > 1 ? totalCents % installments : 0;

    const values: (typeof transactions.$inferInsert)[] = Array.from({ length: count }, (_, index) => ({
      userId: user.id,
      description: (body.description as string).trim(),
      amountCents: baseCents + (installments > 1 && index < remainder ? 1 : 0),
      type: body.type as "income" | "expense",
      categoryId: body.categoryId as number,
      date: shiftISO(body.date as string, index),
      isPaid: index === 0 ? isPaid : false,
      isRecurring,
      seriesId,
      installmentNumber: installments > 1 ? index + 1 : null,
      installmentTotal: installments > 1 ? installments : null,
    }));
    const created = await db.insert(transactions).values(values).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
