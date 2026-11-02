"use client";

import {
  ArrowLeftRight,
  ChartPie,
  ChartSpline,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Settings2,
  Target,
} from "lucide-react";
import { memo, type ReactNode } from "react";
import { fmt, fullMonthLabel, shiftMonth, shortMonthLabel } from "@/lib/format";
import type { UserDTO } from "@/lib/types";
import { Sheet } from "./sheet";
import { ThemeSegmented } from "./theme-toggle";

export type View = "overview" | "transactions" | "manage";

export interface MonthValue {
  y: number;
  m: number;
}

export const SECTIONS = [
  { id: "fluxo", label: "Fluxo de caixa", icon: ChartSpline },
  { id: "categorias", label: "Categorias", icon: ChartPie },
  { id: "orcamentos", label: "Orçamentos", icon: ListChecks },
  { id: "metas", label: "Metas", icon: Target },
] as const;

/* -------------------------------------------------------------------------- */
/* Seletor de mês                                                              */
/* -------------------------------------------------------------------------- */

export const MonthSwitcher = memo(function MonthSwitcher({
  month,
  onChange,
  compact = false,
}: {
  month: MonthValue;
  onChange: (next: MonthValue) => void;
  compact?: boolean;
}) {
  return (
    <div role="group" aria-label="Mês exibido" className="flex shrink-0 items-center rounded-2xl border border-line bg-surface p-0.5">
      <button
        type="button"
        aria-label="Mês anterior"
        onClick={() => onChange(shiftMonth(month.y, month.m, -1))}
        className="grid h-10 w-10 place-items-center rounded-[14px] text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
      >
        <ChevronLeft size={18} />
      </button>
      <p
        aria-live="polite"
        className={`px-1 text-center font-display text-[13.5px] font-semibold tracking-tight text-fg capitalize ${
          compact ? "min-w-[5.25rem] xs:min-w-[8.25rem]" : "min-w-[8.75rem]"
        }`}
      >
        {compact ? (
          <>
            <span className="xs:hidden">
              {shortMonthLabel(month.y, month.m)} {month.y}
            </span>
            <span className="hidden xs:inline">{fullMonthLabel(month.y, month.m)}</span>
          </>
        ) : (
          fullMonthLabel(month.y, month.m)
        )}
      </p>
      <button
        type="button"
        aria-label="Próximo mês"
        onClick={() => onChange(shiftMonth(month.y, month.m, 1))}
        className="grid h-10 w-10 place-items-center rounded-[14px] text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Resumo do mês (sidebar e menu)                                              */
/* -------------------------------------------------------------------------- */

export function MonthSummary({
  income,
  expense,
  net,
  header,
}: {
  income: number;
  expense: number;
  net: number;
  header: ReactNode;
}) {
  const ratio = income > 0 ? Math.min(100, (expense / income) * 100) : expense > 0 ? 100 : 0;
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      {header}
      <dl className="space-y-2 text-[12.5px]">
        <div className="flex items-center justify-between">
          <dt className="text-fg-muted">Receitas</dt>
          <dd className="font-display font-medium text-accent tabular-nums">{fmt(income)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-fg-muted">Despesas</dt>
          <dd className="font-display font-medium text-negative tabular-nums">{fmt(expense)}</dd>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-fg/[0.08]"
          role="img"
          aria-label={`Despesas consomem ${Math.round(ratio)}% das receitas`}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${ratio >= 100 ? "bg-negative" : ratio >= 80 ? "bg-warning" : "bg-accent"}`}
            style={{ width: `${ratio}%` }}
          />
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <dt className="text-fg-muted">Balanço</dt>
          <dd className={`font-display font-semibold tabular-nums ${net >= 0 ? "text-accent" : "text-negative"}`}>{fmt(net)}</dd>
        </div>
      </dl>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Barra de navegação inferior (celular e tablet)                              */
/* -------------------------------------------------------------------------- */

const NAV_ITEMS: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Resumo", icon: LayoutDashboard },
  { id: "transactions", label: "Transações", icon: ArrowLeftRight },
  { id: "manage", label: "Cadastros", icon: Settings2 },
];

function NavButton({
  active,
  label,
  icon: Icon,
  badge,
  onClick,
  onTouchStart,
  ariaCurrent = true,
}: {
  active: boolean;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  onClick: () => void;
  onTouchStart?: () => void;
  ariaCurrent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onTouchStart={onTouchStart}
      aria-current={ariaCurrent && active ? "page" : undefined}
      aria-label={badge ? `${label}, ${badge} pendentes` : undefined}
      className="flex min-w-0 flex-col items-center justify-center gap-1"
    >
      <span
        className={`relative grid h-8 w-14 place-items-center rounded-full transition-colors duration-200 ${
          active ? "bg-accent/15 text-accent" : "text-fg-muted"
        }`}
      >
        <Icon size={20} strokeWidth={active ? 2.3 : 1.9} />
        {badge ? (
          <span className="absolute -top-1 right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-warning px-1 text-[10.5px] font-bold text-surface">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
      <span className={`max-w-full truncate text-[11px] leading-none font-medium ${active ? "text-fg" : "text-fg-muted"}`}>
        {label}
      </span>
    </button>
  );
}

export const BottomNav = memo(function BottomNav({
  view,
  menuOpen,
  pendingCount,
  onSelectView,
  onOpenNew,
  onOpenMenu,
}: {
  view: View;
  menuOpen: boolean;
  pendingCount: number;
  onSelectView: (v: View) => void;
  onOpenNew: () => void;
  onOpenMenu: () => void;
}) {
  const preload = (id: View) => {
    if (id === "transactions") void import("./transactions-view");
    if (id === "manage") void import("./manage-view");
  };
  const [overview, transactions, manage] = NAV_ITEMS;
  const item = (nav: (typeof NAV_ITEMS)[number], badge?: number) => (
    <NavButton
      active={!menuOpen && view === nav.id}
      label={nav.label}
      icon={nav.icon}
      badge={badge}
      onClick={() => onSelectView(nav.id)}
      onTouchStart={() => preload(nav.id)}
    />
  );

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 pb-[var(--safe-b)] shadow-nav lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-xl grid-cols-5 px-1">
        {item(overview)}
        {item(transactions, pendingCount)}
        <div className="grid place-items-center">
          <button
            type="button"
            onClick={onOpenNew}
            onTouchStart={() => void import("./transaction-modal")}
            aria-label="Nova transação"
            className="grid h-12 w-12 -translate-y-1.5 place-items-center rounded-2xl bg-primary text-ink shadow-glow transition-transform active:scale-95"
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        </div>
        {item(manage)}
        <NavButton active={menuOpen} label="Mais" icon={Menu} onClick={onOpenMenu} ariaCurrent={false} />
      </div>
    </nav>
  );
});

/* -------------------------------------------------------------------------- */
/* Menu "Mais" (bottom sheet)                                                  */
/* -------------------------------------------------------------------------- */

export function MenuSheet({
  open,
  onClose,
  user,
  month,
  monthIncome,
  monthExpense,
  monthNet,
  reportUrl,
  onSelectSection,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  user: UserDTO;
  month: MonthValue;
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  reportUrl: (format: "csv" | "pdf") => string;
  onSelectSection: (id: string) => void;
  onLogout: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="sua conta"
      title={user.name}
      description={user.email}
      footer={
        <button type="button" onClick={() => void onLogout()} className="btn btn-danger w-full">
          <LogOut size={16} /> Sair da conta
        </button>
      }
    >
      <div className="space-y-6">
        <MonthSummary
          income={monthIncome}
          expense={monthExpense}
          net={monthNet}
          header={<p className="mb-3 font-display text-[13.5px] font-semibold text-fg capitalize">{fullMonthLabel(month.y, month.m)}</p>}
        />

        <section>
          <h3 className="eyebrow mb-2.5">Ir para</h3>
          <div className="grid grid-cols-2 gap-2">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onClose();
                  onSelectSection(item.id);
                }}
                className="flex min-h-12 items-center gap-2.5 rounded-2xl border border-line bg-fg/[0.02] px-3.5 text-left text-[13.5px] font-medium text-fg transition-colors hover:border-line-strong"
              >
                <item.icon size={17} className="shrink-0 text-accent" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="eyebrow mb-2.5">Aparência</h3>
          <ThemeSegmented />
        </section>

        <section>
          <h3 className="eyebrow mb-2.5">Exportar relatório do mês</h3>
          <div className="grid grid-cols-2 gap-2">
            <a href={reportUrl("csv")} className="btn btn-secondary">
              <Download size={15} /> CSV
            </a>
            <a href={reportUrl("pdf")} className="btn btn-secondary">
              <Download size={15} /> PDF
            </a>
          </div>
        </section>
      </div>
    </Sheet>
  );
}
