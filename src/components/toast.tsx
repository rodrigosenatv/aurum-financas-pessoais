"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Tone = "default" | "success" | "error";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: Tone;
  action?: { label: string; onClick: () => void };
  /** ms; padrão 3.5s, ou 6s quando há ação (ex.: Desfazer). */
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

interface ToastApi {
  show: (toast: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = ++seq;
      setItems((current) => [...current.slice(-2), { ...input, id }]);
      const duration = input.duration ?? (input.action ? 6000 : 3500);
      timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) window.clearTimeout(timer);
    };
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-[calc(5.75rem+var(--safe-b))] z-[100] flex flex-col items-center gap-2 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[380px] lg:items-stretch"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <ToastView key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const ICON = { default: Info, success: CheckCircle2, error: AlertCircle } as const;
const ICON_COLOR = { default: "text-fg-muted", success: "text-accent", error: "text-negative" } as const;

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const tone = item.tone ?? "default";
  const Icon = ICON[tone];
  return (
    <motion.div
      layout
      role={tone === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-line-strong bg-surface py-2.5 pr-2 pl-3.5 shadow-pop"
    >
      <Icon size={18} className={`shrink-0 ${ICON_COLOR[tone]}`} />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-[13.5px] font-medium leading-snug text-fg">{item.title}</p>
        {item.description && <p className="mt-0.5 text-[12.5px] leading-snug text-fg-muted">{item.description}</p>}
      </div>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onDismiss();
          }}
          className="btn btn-ghost min-h-10 px-3 text-accent hover:text-accent"
        >
          {item.action.label}
        </button>
      )}
      <button type="button" onClick={onDismiss} aria-label="Dispensar aviso" className="icon-btn h-10 w-10">
        <X size={16} />
      </button>
    </motion.div>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast precisa estar dentro de <ToastProvider>.");
  return api;
}
