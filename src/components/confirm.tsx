"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Sheet } from "./sheet";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" pinta a ação de vermelho (exclusões, desconectar…). */
  tone?: "danger" | "default";
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** Substitui o `window.confirm` por um diálogo do próprio app (bottom sheet no celular). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((next) => {
    resolver.current?.(false);
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(false);
  };

  const danger = (options?.tone ?? "danger") === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet
        open={open}
        onClose={() => settle(false)}
        size="sm"
        elevated
        title={options?.title ?? ""}
        initialFocus="[data-autofocus]"
        footer={
          <div className="flex flex-col-reverse gap-2 xs:flex-row">
            <button type="button" data-autofocus onClick={() => settle(false)} className="btn btn-secondary flex-1">
              {options?.cancelLabel ?? "Cancelar"}
            </button>
            <button
              type="button"
              onClick={() => settle(true)}
              className={`btn flex-1 ${danger ? "btn-danger-solid" : "btn-primary"}`}
            >
              {options?.confirmLabel ?? "Confirmar"}
            </button>
          </div>
        }
      >
        {options?.description && <div className="text-[14px] leading-relaxed text-fg-muted">{options.description}</div>}
      </Sheet>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm precisa estar dentro de <ConfirmProvider>.");
  return confirm;
}
