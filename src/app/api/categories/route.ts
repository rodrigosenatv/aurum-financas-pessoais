import { db } from "@/db";
import { categories } from "@/db/schema";
import { apiError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const COLOR_RE = /^#[0-9a-f]{6}$/i;

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(
      await db.select().from(categories).where(eq(categories.userId, user.id)).orderBy(categories.name),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const icon = typeof body?.icon === "string" ? body.icon : "Wallet";
    const color = typeof body?.color === "string" ? body.color : "";
    const type = body?.type;
    if (name.length < 2 || name.length > 50)
      return NextResponse.json({ error: "Nome de categoria inválido." }, { status: 400 });
    if (!COLOR_RE.test(color)) return NextResponse.json({ error: "Cor inválida." }, { status: 400 });
    if (type !== "income" && type !== "expense")
      return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
    const [created] = await db
      .insert(categories)
      .values({ userId: user.id, name, icon, color, type })
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
