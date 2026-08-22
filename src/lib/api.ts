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
