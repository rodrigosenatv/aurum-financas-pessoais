import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export function apiError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED")
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  // PostgreSQL unique violation error code: 23505
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  ) {
    return NextResponse.json(
      { error: "Este e-mail já está cadastrado. Clique em 'Já tenho uma conta' para fazer login." },
      { status: 409 },
    );
  }

  console.error("API Error Trace:", error);
  return NextResponse.json(
    { error: "Não foi possível concluir a operação." },
    { status: 500 },
  );
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Comparação em tempo constante contra ataques de temporização (timing attacks)
 * para chaves de API, webhooks e tokens.
 */
export function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Sanitiza valores de células CSV para prevenir Injeção de Fórmulas (CSV / Formula Injection - CWE-1236).
 * Caso o valor inicie com caracteres executáveis (=, +, -, @, tab, newline), adiciona aspa simples inicial.
 */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);
  // Remove caracteres de controle perigosos
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  // Se inicia com caractere de fórmula executável, neutraliza com apóstrofo
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  return `"${str.replace(/"/g, '""')}"`;
}

