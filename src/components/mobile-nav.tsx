"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  ChartPie,
  ChartSpline,
  Download,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Settings2,
  Target,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fmt, fullMonthLabel } from "@/lib/format";
import type { UserDTO } from "@/lib/types";
import { AurumLogo } from "./logo";

export type View = "overview" | "transactions" | "manage";

interface NavItem {
  id: View;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "transactions", label: "Transações", icon: ArrowLeftRight },
  { id: "manage", label: "Cadastros", icon: Settings2 },
];

const SECTIONS = [
  { id: "fluxo", label: "Fluxo de caixa", icon: ChartSpline },
  { id: "categorias", label: "Categorias", icon: ChartPie },
  { id: "orcamentos", label: "Orçamentos", icon: ListChecks },
  { id: "metas", label: "Metas", icon: Target },
];

/* -------------------------------------------------------------------------- */
/* Bottom Navigation Bar + Floating Action Button (Mobile)                   */
/* -------------------------------------------------------------------------- */

export function BottomNav({
  view,
  onSelectView,
  onOpenNew,
}: {
  view: View;
  onSelectView: (v: View) => void;
  onOpenNew: () => void;
}) {
  return (
    <>
      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 lg:hidden">
        <button
          onClick={onOpenNew}
          aria-label="Nova transação"
          className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-ink shadow-[0_12px_40px_-6px_rgba(182,242,68,0.6)] transition-transform active:scale-95"
        >
          <Plus size={24} strokeWidth={2.6} />
        </button>
      </div>

      {/* Bottom Nav Bar */}
      <nav
        aria-label="Navegação móvel"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line bg-ink/97 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const active = view === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors ${
                active ? "text-accent font-semibold" : "text-mute hover:text-cream"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.4 : 2} />
              <span className="text-[11px] tracking-tight">{item.label}</span>
              {active && <span className="h-1 w-1 rounded-full bg-accent -mt-0.5" />}
            </button>
          );
        })}
      </nav>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile menu: botão + drawer, com o estado `open` isolado aqui               */
/* -------------------------------------------------------------------------- */

export type MobileMenuProps = Omit<NavDrawerProps, "open" | "onClose">;

/**
 * O estado de abertura mora neste componente de propósito. Quando ele vivia no
 * FinanceApp, alternar o menu re-renderizava toda a árvore de views (Overview
 * com os gráficos, ManageView), gerando uma long task a cada toque e engasgando
 * a animação de deslize do drawer.
 */
export function MobileMenu(props: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="grid h-11 w-11 place-items-center rounded-xl border border-line text-mute transition-colors hover:border-line-strong hover:text-cream"
      >
        <Menu size={20} />
      </button>
      <NavDrawer {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Navigation Drawer (Slide-out menu for Mobile / Tablet)                    */
/* -------------------------------------------------------------------------- */

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
  user: UserDTO;
  month: { y: number; m: number };
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  onSelectSection: (id: string) => void;
  onOpenNew: () => void;
  reportUrl: (format: "csv" | "pdf") => string;
  onLogout: () => void;
}

function NavDrawer({
  open,
  onClose,
  user,
  month,
  monthIncome,
  monthExpense,
  monthNet,
  onSelectSection,
  onOpenNew,
  reportUrl,
  onLogout,
}: NavDrawerProps) {
  // Lock body scroll when open and handle ESC key
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-ink/82"
          />

          {/* Drawer Panel */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 420, mass: 0.85 }}
            className="relative flex h-full w-[min(320px,85vw)] max-w-sm flex-col overflow-y-auto border-r border-line bg-panel p-5 text-cream shadow-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <AurumLogo size={32} />
              <button
                onClick={onClose}
                aria-label="Fechar menu"
                className="grid h-11 w-11 place-items-center rounded-xl border border-line text-mute transition-colors hover:border-line-strong hover:text-cream"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick action button */}
            <button
              onClick={() => {
                onClose();
                onOpenNew();
              }}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-[13.5px] font-semibold text-ink shadow-[0_8px_30px_-6px_rgba(182,242,68,0.4)] transition-all active:scale-[0.98]"
            >
              <Plus size={16} strokeWidth={2.6} />
              Nova transação
            </button>

            {/* Panel section shortcuts */}
            <p className="eyebrow mt-6 px-1">Painéis</p>
            <nav className="mt-2 space-y-1">
              {SECTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onClose();
                    onSelectSection(item.id);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-mute transition-colors hover:bg-cream/4 hover:text-cream"
                >
                  <item.icon size={16} strokeWidth={2} className="text-faint" />
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Month Summary Card */}
            <div className="mt-6 rounded-2xl border border-line bg-ink/60 p-4">
              <p className="eyebrow mb-3 capitalize">{fullMonthLabel(month.y, month.m)}</p>
              <div className="space-y-2 text-[12px]">
                <p className="flex items-center justify-between">
                  <span className="text-mute">Receitas</span>
                  <span className="font-display font-medium text-accent">{fmt(monthIncome)}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-mute">Despesas</span>
                  <span className="font-display font-medium text-coral">{fmt(monthExpense)}</span>
                </p>
                <div className="h-1 overflow-hidden rounded-full bg-cream/8">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{
                      width: `${
                        monthIncome > 0
                          ? Math.min(100, (monthIncome / Math.max(monthIncome, monthExpense)) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="flex items-center justify-between pt-1">
                  <span className="text-mute">Balanço</span>
                  <span
                    className="font-display font-semibold"
                    style={{ color: monthNet >= 0 ? "#b6f244" : "#ff6e82" }}
                  >
                    {fmt(monthNet)}
                  </span>
                </p>
              </div>
            </div>

            {/* Export buttons */}
            <div className="mt-4 flex gap-2">
              <a
                href={reportUrl("csv")}
                title="Exportar CSV"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 text-xs font-medium text-mute transition-colors hover:border-line-strong hover:text-cream"
              >
                <Download size={13} /> CSV
              </a>
              <a
                href={reportUrl("pdf")}
                title="Exportar PDF"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 text-xs font-medium text-mute transition-colors hover:border-line-strong hover:text-cream"
              >
                <Download size={13} /> PDF
              </a>
            </div>

            {/* User & Logout */}
            <div className="mt-auto pt-6 flex items-center justify-between gap-2 border-t border-line/60 px-1 text-[11px] text-faint">
              <span className="min-w-0 flex-1 truncate" title={user.email}>
                {user.name}
              </span>
              <button
                onClick={() => void onLogout()}
                aria-label="Sair"
                className="flex items-center gap-1 text-faint hover:text-coral transition-colors py-1 px-2 rounded-lg hover:bg-coral/10"
              >
                <LogOut size={14} />
                <span>Sair</span>
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
