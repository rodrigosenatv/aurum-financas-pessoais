"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Download,
  Share,
  PlusSquare,
  WifiOff,
  Wifi,
  RefreshCw,
  X,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { AurumEmblem } from "./logo";
import { Sheet } from "./sheet";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PwaProvider() {
  // Service Worker Update State
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  // Network Status State
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [showReconnected, setShowReconnected] = useState(false);

  // Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIosDevice] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent;
    return /iPhone|iPad|iPod/i.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  });
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isStandalone] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });

  // 1. Service Worker Registration & Updates
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Register Service Worker
    if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Listen for new worker updates
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  setWaitingWorker(newWorker);
                  setUpdateAvailable(true);
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn("[PWA] Erro no registro do Service Worker:", err);
        });

      // Handle controllerchange (refresh when new SW activates)
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 2. Install Prompt Listener
  useEffect(() => {
    if (typeof window === "undefined" || isStandalone) return;

    // Check if user dismissed previously in the last 7 days
    const dismissedTimestamp = localStorage.getItem("aurum_pwa_dismissed");
    if (dismissedTimestamp) {
      const diff = Date.now() - parseInt(dismissedTimestamp, 10);
      if (diff < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // If iOS Safari and not standalone, show prompt after 4 seconds of usage
    if (isIosDevice && !isStandalone && !dismissedTimestamp) {
      const timer = setTimeout(() => {
        setShowInstallBanner(true);
      }, 4000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, [isStandalone, isIosDevice]);

  // Action: Trigger Install
  const handleInstallClick = async () => {
    if (isIosDevice) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    }
  };

  // Action: Dismiss Install Banner
  const handleDismissInstall = () => {
    setShowInstallBanner(false);
    localStorage.setItem("aurum_pwa_dismissed", Date.now().toString());
  };

  // Action: Update SW
  const handleApplyUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  };

  return (
    <>
      {/* 1. Offline & Reconnected Toast */}
      <AnimatePresence>
        {!isOnline && (
          <motion.aside
            key="offline-toast"
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-[calc(0.75rem+var(--safe-t))] left-1/2 z-[110] flex -translate-x-1/2 items-center gap-2 rounded-full border border-warning/35 bg-surface/95 px-4 py-2 text-[12.5px] font-medium whitespace-nowrap text-warning shadow-pop"
          >
            <WifiOff size={14} />
            <span>Sem conexão · exibindo dados salvos</span>
          </motion.aside>
        )}

        {showReconnected && isOnline && (
          <motion.aside
            key="online-toast"
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-[calc(0.75rem+var(--safe-t))] left-1/2 z-[110] flex -translate-x-1/2 items-center gap-2 rounded-full border border-accent/40 bg-surface/95 px-4 py-2 text-[12.5px] font-medium whitespace-nowrap text-accent shadow-pop"
          >
            <Wifi size={14} />
            <span>Conexão restabelecida</span>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 2. Service Worker Update Notification */}
      <AnimatePresence>
        {updateAvailable && (
          <motion.aside
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-[calc(1rem+var(--safe-t))] right-4 left-4 z-[110] mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-accent/30 bg-surface p-3.5 shadow-pop sm:left-auto"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
              <Sparkles size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-semibold text-fg">Nova versão disponível</p>
              <p className="truncate text-[12.5px] text-fg-muted">Atualize para carregar as melhorias.</p>
            </div>
            <button
              onClick={handleApplyUpdate}
              className="btn btn-primary min-h-10 shrink-0 px-3"
            >
              <RefreshCw size={14} />
              Atualizar
            </button>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 3. Install App Banner */}
      <AnimatePresence>
        {showInstallBanner && !isStandalone && (
          <motion.aside
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed right-4 bottom-[calc(5.75rem+var(--safe-b))] left-4 z-[45] mx-auto max-w-md rounded-[22px] border border-line-strong bg-surface p-4 shadow-pop lg:right-6 lg:bottom-6 lg:left-auto lg:mx-0 lg:w-[400px]"
          >
            <div className="flex items-start gap-3.5">
              <AurumEmblem size={44} className="shrink-0 rounded-xl" />
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14.5px] font-semibold text-fg">Instale o Aurum</span>
                  <span className="chip bg-accent/15 text-accent">App</span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
                  Abra direto da tela inicial, em tela cheia, como um app.
                </p>
              </div>
              <button
                onClick={handleDismissInstall}
                aria-label="Fechar"
                className="icon-btn absolute top-2 right-2 h-10 w-10"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3.5 flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="btn btn-primary flex-1"
              >
                <Download size={15} strokeWidth={2.4} />
                {isIosDevice ? "Como instalar" : "Instalar"}
              </button>
              <button
                onClick={handleDismissInstall}
                className="btn btn-secondary"
              >
                Agora não
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 4. Passo a passo de instalação no iOS (Safari não tem prompt nativo) */}
      <Sheet
        open={showIosGuide}
        onClose={() => setShowIosGuide(false)}
        size="sm"
        eyebrow="Safari · iPhone e iPad"
        title="Instalar no iPhone"
        headerAside={<AurumEmblem size={40} />}
        footer={
          <button type="button" onClick={() => setShowIosGuide(false)} className="btn btn-primary w-full">
            Entendi
          </button>
        }
      >
        <ol className="space-y-2.5">
          {[
            { icon: Share, title: "Toque em Compartilhar", text: "O ícone fica na barra inferior do Safari." },
            { icon: PlusSquare, title: "Adicionar à Tela de Início", text: "Role as opções para baixo até encontrar." },
            { icon: Smartphone, title: "Pronto", text: "Abra o Aurum pelo ícone, como um app." },
          ].map((step, index) => (
            <li key={step.title} className="flex items-center gap-3 rounded-2xl border border-line bg-fg/[0.02] p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent">
                <step.icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-fg">
                  {index + 1}. {step.title}
                </span>
                <span className="block text-[12.5px] text-fg-muted">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </Sheet>
    </>
  );
}
