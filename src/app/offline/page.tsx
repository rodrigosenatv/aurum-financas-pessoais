"use client";

import { AurumEmblem } from "@/components/logo";
import { RefreshCw, WifiOff } from "lucide-react";
import { useState } from "react";

export default function OfflinePage() {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = () => {
    setRetrying(true);
    window.location.reload();
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6 text-center bg-ink text-cream selection:bg-accent selection:text-ink">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-accent/5 blur-[120px]" />

      <div className="relative z-10 flex max-w-sm flex-col items-center">
        {/* Aurum Logo */}
        <div className="relative mb-6">
          <AurumEmblem size={72} />
          <div className="absolute -bottom-2 -right-2 grid h-8 w-8 place-items-center rounded-full bg-surface-2 border border-border/80 text-accent shadow-lg">
            <WifiOff size={16} />
          </div>
        </div>

        <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-0.5 text-xs font-medium text-accent">
          Modo Offline
        </span>

        <h1 className="mt-1 font-serif text-3xl italic tracking-wide text-cream">
          Você está desconectado
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-cream-muted">
          Não conseguimos conectar aos servidores da Aurum. Suas configurações em cache continuam salvas e você poderá sincronizar novos lançamentos assim que a conexão retornar.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent font-medium text-ink transition-transform active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={18} className={retrying ? "animate-spin" : ""} />
            {retrying ? "Reconectando..." : "Tentar reconectar"}
          </button>

          <a
            href="/"
            className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-surface-1 text-sm font-medium text-cream hover:bg-surface-2 transition-colors"
          >
            Voltar para o início
          </a>
        </div>
      </div>
    </main>
  );
}
