import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";
import { apiError, readJson } from "@/lib/api";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const clientId = getClientIdentifier(request);
    const ipRate = checkRateLimit(`login:ip:${clientId}`, { max: 15, windowSeconds: 60 });
    if (!ipRate.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas de login. Tente novamente em ${ipRate.resetSeconds}s.` },
        { status: 429 },
      );
    }

    const body = await readJson(request);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
    }

    // Proteção contra DoS via payload excessivo em scrypt
    if (password.length > 128) {
      return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }

    const emailRate = checkRateLimit(`login:email:${email}`, { max: 8, windowSeconds: 60 });
    if (!emailRate.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas incorretas para esta conta. Tente em ${emailRate.resetSeconds}s.` },
        { status: 429 },
      );
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }

    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    return apiError(error);
  }
}

