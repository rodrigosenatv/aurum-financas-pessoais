import { db } from "@/db";
import { goals } from "@/db/schema";
import { apiError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await db.select().from(goals).where(eq(goals.userId, user.id)));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const targetCents = Number(body?.targetCents);
    const currentCents = Number(body?.currentCents ?? 0);
    const color = typeof body?.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : "#B7F34B";
    const icon = typeof body?.icon === "string" ? body.icon : "Target";
    if (name.length < 2 || name.length > 80 || !Number.isInteger(targetCents) || targetCents <= 0 ||
        !Number.isInteger(currentCents) || currentCents < 0)
      return NextResponse.json({ error: "Dados da meta inválidos." }, { status: 400 });
    const [created] = await db.insert(goals)
      .values({ userId: user.id, name, targetCents, currentCents, color, icon }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
