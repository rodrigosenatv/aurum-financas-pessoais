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
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-amber-500/30 bg-ink/95 px-4 py-2 text-xs font-medium text-amber-300 shadow-2xl backdrop-blur-md"
          >
            <WifiOff size={14} className="animate-pulse text-amber-400" />
            <span>Modo Offline: exibindo dados em cache</span>
          </motion.aside>
        )}

        {showReconnected && isOnline && (
          <motion.aside
            key="online-toast"
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-accent/40 bg-ink/95 px-4 py-2 text-xs font-medium text-accent shadow-2xl backdrop-blur-md"
          >
            <Wifi size={14} />
            <span>Conexão restabelecida!</span>
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
            className="fixed top-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-2xl border border-accent/30 bg-surface-1/95 p-3.5 shadow-2xl backdrop-blur-xl"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
              <Sparkles size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-cream">Nova versão disponível</p>
              <p className="text-[11px] text-cream-muted truncate">
                Atualize para carregar novas melhorias.
              </p>
            </div>
            <button
              onClick={handleApplyUpdate}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-ink transition-transform active:scale-95"
            >
              <RefreshCw size={12} />
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
            className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-border/80 bg-surface-1/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl lg:bottom-6"
          >
            <div className="flex items-start gap-3.5">
              <AurumEmblem size={44} className="shrink-0 rounded-xl" />
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-cream">Instalar o Aurum</span>
                  <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                    App
                  </span>
                </div>
                <p className="mt-1 text-xs text-cream-muted leading-relaxed">
                  Adicione à tela inicial para abrir como app, em tela cheia e com acesso instantâneo.
                </p>
              </div>
              <button
                onClick={handleDismissInstall}
                aria-label="Fechar"
                className="absolute top-3.5 right-3.5 grid h-7 w-7 place-items-center rounded-lg text-cream-muted hover:bg-surface-2 hover:text-cream transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-3.5 flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 px-4 text-xs font-semibold text-ink shadow-[0_4px_20px_rgba(182,242,68,0.3)] transition-transform active:scale-95"
              >
                <Download size={15} strokeWidth={2.4} />
                {isIosDevice ? "Ver como instalar no iPhone" : "Instalar aplicativo"}
              </button>
              <button
                onClick={handleDismissInstall}
                className="rounded-xl border border-border bg-surface-2/60 py-2.5 px-3.5 text-xs font-medium text-cream-muted hover:text-cream transition-colors"
              >
                Depois
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 4. iOS Safari Installation Instructions Modal */}
      <AnimatePresence>
        {showIosGuide && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 40 }}
              className="relative w-full max-w-sm rounded-3xl border border-border bg-surface-1 p-6 shadow-2xl text-cream"
            >
              <button
                onClick={() => setShowIosGuide(false)}
                className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-xl bg-surface-2 text-cream-muted hover:text-cream"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-3">
                <AurumEmblem size={48} />
                <div>
                  <h2 className="font-semibold text-base text-cream">Instalar no iOS</h2>
                  <p className="text-xs text-cream-muted">Safari / iPhone & iPad</p>
                </div>
              </div>

              <div className="mt-5 space-y-3.5 text-xs text-cream-muted">
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/50 p-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-accent">
                    <Share size={16} />
                  </div>
                  <div>
                    <span className="font-semibold text-cream">1. Toque em Compartilhar</span>
                    <p className="text-[11px]">Localizado na barra inferior do Safari.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/50 p-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-accent">
                    <PlusSquare size={16} />
                  </div>
                  <div>
                    <span className="font-semibold text-cream">2. Adicionar à Tela de Início</span>
                    <p className="text-[11px]">Role as opções para baixo até encontrar.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/50 p-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-accent">
                    <Smartphone size={16} />
                  </div>
                  <div>
                    <span className="font-semibold text-cream">3. Pronto!</span>
                    <p className="text-[11px]">Abra o Aurum como aplicativo nativo.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIosGuide(false)}
                className="mt-6 w-full rounded-xl bg-accent py-3 text-xs font-semibold text-ink transition-transform active:scale-95"
              >
                Entendi
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
