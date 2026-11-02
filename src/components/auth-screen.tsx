"use client";

import { AlertCircle, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AurumLogo } from "./logo";
import { ThemeQuickToggle } from "./theme-toggle";

export function AuthScreen({ databaseError }: { databaseError?: string }) {
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("demo@aurum.app");
  const [password, setPassword] = useState("aurum123");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(databaseError ?? null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || databaseError) return;
    if (!email.trim() || !password || (register && !name.trim())) {
      setError(register ? "Preencha nome, e-mail e senha." : "Informe e-mail e senha.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(register ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Não foi possível entrar.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Sem conexão com o servidor. Verifique sua internet e tente novamente.");
      setBusy(false);
    }
  };

  return (
    <main className="relative z-10 flex min-h-dvh flex-col px-4 pt-[max(1rem,var(--safe-t))] pb-[max(1.5rem,var(--safe-b))]">
      <div className="flex justify-end">
        <ThemeQuickToggle />
      </div>

      <div className="grid flex-1 place-items-center py-6">
        <section className="card w-full max-w-[420px] p-5 xs:p-7 sm:p-9">
          <div className="mb-7 sm:mb-8">
            <AurumLogo size={42} />
          </div>
          <p className="eyebrow mb-2">{register ? "comece agora" : "bem-vindo de volta"}</p>
          <h1 className="font-serif text-[clamp(1.75rem,7vw,2rem)] leading-tight text-fg">
            {register ? "Crie seu espaço financeiro." : "Seu dinheiro, no controle."}
          </h1>

          <form onSubmit={(e) => void submit(e)} noValidate className="mt-7 space-y-4">
            {register && (
              <label className="block">
                <span className="eyebrow mb-1.5 block">Nome</span>
                <input
                  className="field"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
            <label className="block">
              <span className="eyebrow mb-1.5 block">E-mail</span>
              <input
                className="field"
                type="email"
                name="email"
                autoComplete={register ? "email" : "username"}
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-1.5 block">Senha</span>
              <span className="relative block">
                <input
                  className="field pr-12"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  value={password}
                  minLength={8}
                  aria-describedby={register ? "password-hint" : undefined}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-0.5 grid h-10 w-11 -translate-y-1/2 place-items-center rounded-xl text-fg-subtle hover:text-fg"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
              {register && (
                <span id="password-hint" className="mt-1.5 block text-[12px] text-fg-subtle">
                  Use pelo menos 8 caracteres.
                </span>
              )}
            </label>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-negative/25 bg-negative/10 p-3 text-[13px] text-negative">
                <AlertCircle size={16} className="mt-px shrink-0" />
                {error}
              </p>
            )}

            <button type="submit" disabled={busy || Boolean(databaseError)} className="btn btn-primary min-h-12 w-full text-[14.5px]">
              {busy && <LoaderCircle size={17} className="animate-spin" />}
              {register ? "Criar conta" : "Entrar"}
            </button>
          </form>

          {!databaseError && (
            <p className="mt-5 text-center text-[13px] text-fg-muted">
              {register ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setRegister((value) => !value);
                  setError(null);
                }}
                className="inline-flex min-h-10 items-center font-semibold text-accent underline-offset-4 hover:underline"
              >
                {register ? "Entrar" : "Criar conta"}
              </button>
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
