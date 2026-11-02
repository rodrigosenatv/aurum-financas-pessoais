"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { PHONE_QUERY, useMediaQuery } from "@/lib/media";

/** Pilha de sheets abertos: só o do topo reage ao Esc. */
const stack: string[] = [];

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Conteúdo fixo no rodapé (ações). Fica sempre visível acima do teclado/safe area. */
  footer?: ReactNode;
  /** Elemento extra no cabeçalho, à esquerda do botão fechar. */
  headerAside?: ReactNode;
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Seletor (dentro do sheet) que recebe o foco ao abrir. */
  initialFocus?: string;
  /** z-index acima de outros sheets (ex.: confirmação sobre um formulário). */
  elevated?: boolean;
}

const WIDTH = { sm: "sm:max-w-[420px]", md: "sm:max-w-[520px]", lg: "sm:max-w-[600px]" } as const;

/**
 * Diálogo modal responsivo: bottom sheet com alça de arrastar no celular,
 * janela centralizada a partir de 640px. Trava o scroll da página, fecha com
 * Esc / toque fora / arrastar para baixo e devolve o foco a quem o abriu.
 */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  description,
  footer,
  headerAside,
  children,
  size = "md",
  initialFocus,
  elevated = false,
}: SheetProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const phone = useMediaQuery(PHONE_QUERY);
  const dragControls = useDragControls();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    stack.push(id);
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = initialFocus ? panel.querySelector<HTMLElement>(initialFocus) : null;
      (target ?? panel).focus({ preventScroll: true });
    }, 60);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && stack[stack.length - 1] === id) {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      const index = stack.lastIndexOf(id);
      if (index >= 0) stack.splice(index, 1);
      document.body.style.overflow = previousOverflow;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
    };
  }, [open, id, initialFocus]);

  const startDrag = (event: ReactPointerEvent) => {
    if (!phone) return;
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    dragControls.start(event);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 550) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet"
          className={`fixed inset-0 flex items-end justify-center sm:items-center sm:p-4 ${elevated ? "z-[96]" : "z-[90]"}`}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          <motion.button
            type="button"
            tabIndex={-1}
            aria-label="Fechar"
            className="absolute inset-0 cursor-default bg-scrim sm:backdrop-blur-[2px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            className={`relative flex max-h-[min(92dvh,920px)] w-full flex-col overflow-hidden rounded-t-[28px] border border-b-0 border-line-strong bg-surface shadow-pop outline-none sm:max-h-[88dvh] sm:rounded-[26px] sm:border-b ${WIDTH[size]}`}
            initial={phone ? { y: "100%" } : { opacity: 0, y: 24, scale: 0.97 }}
            animate={phone ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={phone ? { y: "100%" } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={phone ? { type: "spring", damping: 36, stiffness: 380, mass: 0.9 } : { type: "spring", stiffness: 380, damping: 32 }}
            drag={phone ? "y" : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={onDragEnd}
          >
            <div onPointerDown={startDrag} className="shrink-0 touch-none select-none">
              <div className="flex justify-center pt-2.5 pb-1 sm:hidden" aria-hidden>
                <span className="h-1.5 w-10 rounded-full bg-fg/20" />
              </div>
              <div className="flex items-start justify-between gap-3 px-5 pt-2 pb-4 sm:px-7 sm:pt-7 sm:pb-5">
                <div className="min-w-0">
                  {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
                  <h2 id={titleId} className="font-serif text-[1.625rem] leading-[1.1] text-fg sm:text-[1.75rem]">
                    {title}
                  </h2>
                  {description && (
                    <p id={descId} className="mt-1.5 text-[13.5px] leading-relaxed text-fg-muted">
                      {description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {headerAside}
                  <button type="button" onClick={onClose} aria-label="Fechar" className="icon-btn -mr-1.5 -mt-1">
                    <X size={19} />
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-7 sm:pb-6">{children}</div>

            {footer ? (
              <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[calc(0.75rem+var(--safe-b))] sm:px-7 sm:pt-4 sm:pb-6">
                {footer}
              </div>
            ) : (
              <div className="shrink-0 pb-[var(--safe-b)] sm:pb-0" />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
