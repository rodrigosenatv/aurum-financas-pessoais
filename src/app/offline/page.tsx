"use client";

import { AurumEmblem } from "@/components/logo";
import { RefreshCw, WifiOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function OfflinePage() {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = () => {
    setRetrying(true);
    window.location.reload();
  };

  return (
    <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 pt-[max(1.5rem,var(--safe-t))] pb-[max(1.5rem,var(--safe-b))] text-center">
      <div className="relative flex w-full max-w-sm flex-col items-center">
        <div className="relative mb-6">
          <AurumEmblem size={72} />
          <div className="absolute -right-2 -bottom-2 grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-surface text-warning shadow-pop">
            <WifiOff size={17} />
          </div>
        </div>

        <span className="chip mb-3 bg-warning/12 text-warning">Sem conexão</span>

        <h1 className="font-serif text-[2rem] leading-tight text-fg">Você está offline</h1>

        <p className="mt-3 text-[14px] leading-relaxed text-fg-muted">
          Não conseguimos falar com os servidores do Aurum. Assim que a internet voltar, é só tentar de novo — nada do que
          você já salvou se perde.
        </p>

        <div className="mt-8 flex w-full flex-col gap-2.5">
          <button type="button" onClick={handleRetry} disabled={retrying} className="btn btn-primary min-h-12 w-full">
            <RefreshCw size={18} className={retrying ? "animate-spin" : ""} />
            {retrying ? "Reconectando…" : "Tentar novamente"}
          </button>
          <Link href="/" className="btn btn-secondary min-h-12 w-full">
            Voltar para o início
          </Link>
        </div>
      </div>
    </main>
  );
}
