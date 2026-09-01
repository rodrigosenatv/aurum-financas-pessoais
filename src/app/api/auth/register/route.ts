import { db } from "@/db";
import { categories, users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import { apiError, readJson } from "@/lib/api";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const clientId = getClientIdentifier(request);
    const rate = checkRateLimit(`register:${clientId}`, { max: 6, windowSeconds: 300 }); // max 6 cadastros a cada 5 min por IP
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas de cadastro. Tente novamente em ${rate.resetSeconds}s.` },
        { status: 429 },
      );
    }

    const body = await readJson(request);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (name.length < 2 || name.length > 80)
      return NextResponse.json({ error: "Informe um nome válido (2 a 80 caracteres)." }, { status: 400 });
    if (!EMAIL_RE.test(email) || email.length > 120)
      return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    if (password.length < 8 || password.length > 128)
      return NextResponse.json(
        { error: "A senha deve ter entre 8 e 128 caracteres." },
        { status: 400 },
      );

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 });

    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash: hashPassword(password) })
      .returning();

    await db.insert(categories).values([
      { userId: user.id, name: "Salário", icon: "BriefcaseBusiness", color: "#B7F34B", type: "income" },
      { userId: user.id, name: "Moradia", icon: "Home", color: "#8B8CF6", type: "expense" },
      { userId: user.id, name: "Alimentação", icon: "Utensils", color: "#F6A35C", type: "expense" },
      { userId: user.id, name: "Transporte", icon: "CarFront", color: "#5CC8F6", type: "expense" },
    ]);

    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

