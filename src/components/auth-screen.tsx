"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AurumLogo } from "./logo";

export function AuthScreen({ databaseError }: { databaseError?: string }) {
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("demo@aurum.app");
  const [password, setPassword] = useState("aurum123");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(databaseError ?? null);

  const submit = async () => {
    if (busy || !email || !password || (register && !name.trim())) return;
    setBusy(true);
    setError(null);
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
  };

  return (
    <main className="relative z-10 grid min-h-dvh place-items-center px-4 py-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <section className="card w-full max-w-[430px] p-5 xs:p-7 sm:p-9">
        <div className="mb-6 sm:mb-8">
          <AurumLogo size={42} />
        </div>
        <p className="eyebrow mb-2">{register ? "comece agora" : "bem-vindo de volta"}</p>
        <h2 className="font-serif text-[clamp(1.5rem,6vw,1.875rem)] leading-tight text-cream">
          {register ? "Crie seu espaço financeiro." : "Seu dinheiro, no controle."}
        </h2>
        <div className="mt-6 sm:mt-7 space-y-4">
          {register && (
            <label className="block">
              <span className="eyebrow mb-2 block">Nome</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <label className="block">
            <span className="eyebrow mb-2 block">E-mail</span>
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="eyebrow mb-2 block">Senha</span>
            <input
              className="field"
              type="password"
              value={password}
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </label>
        </div>
        {error && <p className="mt-4 rounded-xl border border-coral/20 bg-coral/10 p-3 text-xs text-coral">{error}</p>}
        <button
          onClick={() => void submit()}
          disabled={busy || Boolean(databaseError)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-bold text-ink disabled:opacity-40 min-h-[46px]"
        >
          {busy && <LoaderCircle size={16} className="animate-spin" />}
          {register ? "Criar conta" : "Entrar"}
        </button>
        {!databaseError && (
          <button
            onClick={() => {
              setRegister((value) => !value);
              setError(null);
            }}
            className="mt-4 w-full text-center text-xs text-mute hover:text-accent min-h-[40px] flex items-center justify-center"
          >
            {register ? "Já tenho uma conta" : "Criar uma nova conta"}
          </button>
        )}
      </section>
    </main>
  );
}
