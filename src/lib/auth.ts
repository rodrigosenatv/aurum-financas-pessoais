import { createHash, randomBytes } from "node:crypto";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import type { UserDTO } from "@/lib/types";
import { and, eq, gt, lte } from "drizzle-orm";
import { cookies } from "next/headers";
export { hashPassword, verifyPassword } from "@/lib/password";

const COOKIE_NAME = "aurum_session";
const SESSION_DAYS = 30;

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Remove sessões vencidas do banco de dados para manter a tabela limpa e otimizada.
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    await db.delete(sessions).where(lte(sessions.expiresAt, new Date()));
  } catch (err) {
    console.error("Falha ao limpar sessões expiradas:", err);
  }
}

export async function createSession(userId: number): Promise<void> {
  // Limpeza oportunista assíncrona
  void cleanupExpiredSessions();

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ tokenHash: tokenHash(token), userId, expiresAt });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
  store.delete(COOKIE_NAME);
  void cleanupExpiredSessions();
}

export async function getCurrentUser(): Promise<UserDTO | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      telegramChatId: users.telegramChatId,
      telegramUsername: users.telegramUsername,
      telegramNotifyDueBills: users.telegramNotifyDueBills,
      telegramNotifyBudgetLimit: users.telegramNotifyBudgetLimit,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function requireUser(): Promise<UserDTO> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

