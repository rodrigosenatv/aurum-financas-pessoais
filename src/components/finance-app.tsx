"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, LogOut, Plus, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fullMonthLabel,
  greeting,
  keyFromISO,
  monthKey,
  monthLabel,
  shiftMonth,
  todayLong,
} from "@/lib/format";
import { useLightMotion } from "@/lib/motion";
import { useHydrated } from "@/lib/theme";
import type { BudgetDTO, CategoryDTO, FinanceData, GoalDTO, TransactionDTO, TxnPayload, UserDTO } from "@/lib/types";
import { ConfirmProvider } from "./confirm";
import { AurumLogo } from "./logo";
import type { ManageTab } from "./manage-view";
import { BottomNav, MenuSheet, MonthSummary, MonthSwitcher, SECTIONS, type MonthValue, type View } from "./mobile-nav";
import { Overview } from "./overview";
import { ThemeSegmented } from "./theme-toggle";
import { ToastProvider, useToast } from "./toast";

function ViewSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-28 animate-pulse opacity-60" />
      ))}
    </div>
  );
}

const TransactionsView = dynamic(() => import("./transactions-view").then((m) => m.TransactionsView), {
  ssr: false,
  loading: ViewSkeleton,
});

const ManageView = dynamic(() => import("./manage-view").then((m) => m.ManageView), {
  ssr: false,
  loading: ViewSkeleton,
});

const TransactionModal = dynamic(() => import("./transaction-modal").then((m) => m.TransactionModal), { ssr: false });

const preloadTransactions = () => void import("./transactions-view");
const preloadManage = () => void import("./manage-view");
const preloadModal = () => void import("./transaction-modal");

const NAV: { id: View; label: string; preload?: () => void }[] = [
  { id: "overview", label: "Visão geral" },
  { id: "transactions", label: "Transações", preload: preloadTransactions },
  { id: "manage", label: "Cadastros", preload: preloadManage },
];

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error ?? "Não foi possível concluir a operação.");
  return body as T;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : undefined);

const byDateDesc = (a: TransactionDTO, b: TransactionDTO) => b.date.localeCompare(a.date) || b.id - a.id;

export interface FinanceAppProps {
  initialData: FinanceData;
  user: UserDTO;
  initialView?: View;
  openNew?: boolean;
}

export function FinanceApp(props: FinanceAppProps) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <FinanceShell {...props} />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function FinanceShell({ initialData, user, initialView = "overview", openNew: openNewOnLoad = false }: FinanceAppProps) {
  const [data, setData] = useState(initialData);
  const router = useRouter();
  const light = useLightMotion();
  const hydrated = useHydrated();
  const toast = useToast();

  const [today] = useState(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });
  const [view, setView] = useState<View>(initialView);
  const [manageTab, setManageTab] = useState<ManageTab>("categorias");
  const [month, setMonth] = useState<MonthValue>(today);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; editing: TransactionDTO | null }>({
    open: openNewOnLoad,
    editing: null,
  });

  const key = monthKey(month.y, month.m);
  const isCurrentMonth = month.y === today.y && month.m === today.m;

  const monthTxns = useMemo(() => data.transactions.filter((t) => keyFromISO(t.date) === key), [data.transactions, key]);
  const monthIncome = monthTxns.reduce((s, t) => (t.type === "income" ? s + t.amountCents : s), 0);
  const monthExpense = monthTxns.reduce((s, t) => (t.type === "expense" ? s + t.amountCents : s), 0);
  const monthNet = monthIncome - monthExpense;
  const pendingCount = monthTxns.filter((t) => t.type === "expense" && !t.isPaid).length;

  /* ------------------------------ mutations ------------------------------ */

  const saveTxn = useCallback(
    async (payload: TxnPayload, id?: number) => {
      const category = data.categories.find((item) => item.id === payload.categoryId);
      if (!category) throw new Error("Categoria não encontrada.");
      const previous = id ? data.transactions.find((item) => item.id === id) : null;
      const optimistic = previous
        ? {
            ...previous,
            description: payload.description,
            amountCents: payload.amountCents,
            type: payload.type,
            categoryId: payload.categoryId,
            date: payload.date,
            isPaid: payload.isPaid ?? previous.isPaid,
            isRecurring: payload.isRecurring ?? previous.isRecurring,
            category: { name: category.name, icon: category.icon, color: category.color },
          }
        : null;
      if (optimistic)
        setData((current) => ({
          ...current,
          transactions: current.transactions.map((item) => (item.id === id ? optimistic : item)),
        }));
      try {
        const result = await requestJson<
          (Omit<TransactionDTO, "category"> & { userId?: number }) | Array<Omit<TransactionDTO, "category"> & { userId?: number }>
        >(id ? `/api/transactions/${id}` : "/api/transactions", {
          method: id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const rows = (Array.isArray(result) ? result : [result]).map((item) => ({
          ...item,
          category: { name: category.name, icon: category.icon, color: category.color },
        }));
        setData((current) => ({
          ...current,
          transactions: id
            ? current.transactions.map((item) => (item.id === id ? rows[0] : item))
            : [...rows, ...current.transactions].sort(byDateDesc),
        }));
        toast.show({
          tone: "success",
          title: id
            ? "Transação atualizada"
            : rows.length > 1
              ? `${rows.length} lançamentos criados`
              : payload.type === "income"
                ? "Receita adicionada"
                : "Despesa adicionada",
        });
      } catch (error) {
        if (previous)
          setData((current) => ({
            ...current,
            transactions: current.transactions.map((item) => (item.id === previous.id ? previous : item)),
          }));
        throw error;
      }
    },
    [data.categories, data.transactions, toast],
  );

  // Exclusão com "Desfazer": some da lista na hora e só vai para a API depois
  // que o aviso expira. Se a página for fechada antes, a exclusão é enviada
  // com keepalive.
  const pendingDeletes = useRef(new Map<number, { timer: number; txn: TransactionDTO }>());

  const restoreTxn = useCallback((txn: TransactionDTO) => {
    setData((current) =>
      current.transactions.some((item) => item.id === txn.id)
        ? current
        : { ...current, transactions: [...current.transactions, txn].sort(byDateDesc) },
    );
  }, []);

  const commitDelete = useCallback(
    async (id: number) => {
      const entry = pendingDeletes.current.get(id);
      if (!entry) return;
      pendingDeletes.current.delete(id);
      try {
        await requestJson(`/api/transactions/${id}`, { method: "DELETE" });
      } catch (error) {
        restoreTxn(entry.txn);
        toast.show({ tone: "error", title: "Não foi possível excluir a transação", description: errorText(error) });
      }
    },
    [restoreTxn, toast],
  );

  const deleteTxn = useCallback(
    (txn: TransactionDTO) => {
      setData((current) => ({ ...current, transactions: current.transactions.filter((item) => item.id !== txn.id) }));
      const timer = window.setTimeout(() => void commitDelete(txn.id), 6500);
      pendingDeletes.current.set(txn.id, { timer, txn });
      toast.show({
        title: "Transação excluída",
        description: txn.description,
        duration: 6000,
        action: {
          label: "Desfazer",
          onClick: () => {
            const entry = pendingDeletes.current.get(txn.id);
            if (!entry) return;
            window.clearTimeout(entry.timer);
            pendingDeletes.current.delete(txn.id);
            restoreTxn(entry.txn);
          },
        },
      });
    },
    [commitDelete, restoreTxn, toast],
  );

  useEffect(() => {
    const pending = pendingDeletes.current;
    const flush = () => {
      for (const [id, entry] of pending) {
        window.clearTimeout(entry.timer);
        void fetch(`/api/transactions/${id}`, { method: "DELETE", keepalive: true }).catch(() => {});
      }
      pending.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const togglePaid = useCallback(
    async (id: number, currentPaid: boolean) => {
      const nextPaid = !currentPaid;
      setData((current) => ({
        ...current,
        transactions: current.transactions.map((t) => (t.id === id ? { ...t, isPaid: nextPaid } : t)),
      }));
      try {
        await requestJson(`/api/transactions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPaid: nextPaid }),
        });
      } catch (error) {
        setData((current) => ({
          ...current,
          transactions: current.transactions.map((t) => (t.id === id ? { ...t, isPaid: currentPaid } : t)),
        }));
        toast.show({ tone: "error", title: "Não foi possível atualizar o status", description: errorText(error) });
      }
    },
    [toast],
  );

  const importRecurring = useCallback(async () => {
    const targetKey = key;
    try {
      const synced = await requestJson<TransactionDTO[]>("/api/transactions/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: targetKey, action: "import" }),
      });
      if (Array.isArray(synced) && synced.length > 0) {
        const existing = data.transactions.filter((t) => keyFromISO(t.date) === targetKey).length;
        const added = synced.length - existing;
        setData((current) => {
          const others = current.transactions.filter((t) => keyFromISO(t.date) !== targetKey);
          return { ...current, transactions: [...synced, ...others].sort(byDateDesc) };
        });
        toast.show({
          tone: "success",
          title: "Lançamentos fixos importados",
          description: added > 0 ? `${added} ${added === 1 ? "lançamento adicionado" : "lançamentos adicionados"} ao mês.` : undefined,
        });
      }
    } catch (error) {
      toast.show({ tone: "error", title: "Não foi possível importar os fixos", description: errorText(error) });
    }
  }, [key, toast, data.transactions]);

  const editBudget = useCallback(
    async (budget: BudgetDTO, amountCents: number) => {
      const previous = budget.amountCents;
      setData((current) => ({
        ...current,
        budgets: current.budgets.map((item) => (item.id === budget.id ? { ...item, amountCents } : item)),
      }));
      try {
        await requestJson(`/api/budgets/${budget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountCents }),
        });
        return true;
      } catch (error) {
        setData((current) => ({
          ...current,
          budgets: current.budgets.map((item) => (item.id === budget.id ? { ...item, amountCents: previous } : item)),
        }));
        toast.show({ tone: "error", title: "Não foi possível salvar o limite", description: errorText(error) });
        return false;
      }
    },
    [toast],
  );

  const depositGoal = useCallback(
    async (id: number, addCents: number) => {
      const previous = data.goals.find((item) => item.id === id);
      if (!previous) return false;
      setData((current) => ({
        ...current,
        goals: current.goals.map((item) => (item.id === id ? { ...item, currentCents: item.currentCents + addCents } : item)),
      }));
      try {
        const updated = await requestJson<GoalDTO>(`/api/goals/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addCents }),
        });
        setData((current) => ({ ...current, goals: current.goals.map((item) => (item.id === id ? updated : item)) }));
        if (updated.currentCents >= updated.targetCents && previous.currentCents < previous.targetCents)
          toast.show({ tone: "success", title: "Meta alcançada! 🎉", description: updated.name });
        return true;
      } catch (error) {
        setData((current) => ({ ...current, goals: current.goals.map((item) => (item.id === id ? previous : item)) }));
        toast.show({ tone: "error", title: "Não foi possível registrar o aporte", description: errorText(error) });
        return false;
      }
    },
    [data.goals, toast],
  );

  const createCategory = useCallback(async (input: Omit<CategoryDTO, "id">) => {
    const created = await requestJson<CategoryDTO>("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    setData((current) => ({ ...current, categories: [...current.categories, created] }));
  }, []);

  const updateCategory = useCallback(async (id: number, input: Partial<Omit<CategoryDTO, "id">>) => {
    const updated = await requestJson<CategoryDTO>(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    setData((current) => ({
      ...current,
      categories: current.categories.map((item) => (item.id === id ? updated : item)),
      transactions: current.transactions.map((t) =>
        t.categoryId === id ? { ...t, category: { name: updated.name, icon: updated.icon, color: updated.color } } : t,
      ),
    }));
  }, []);

  const deleteCategory = useCallback(async (id: number) => {
    await requestJson(`/api/categories/${id}`, { method: "DELETE" });
    setData((current) => ({ ...current, categories: current.categories.filter((item) => item.id !== id) }));
  }, []);

  const createBudget = useCallback(async (categoryId: number, amountCents: number) => {
    const created = await requestJson<BudgetDTO>("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, amountCents }),
    });
    setData((current) => ({ ...current, budgets: [...current.budgets, created] }));
  }, []);

  const deleteBudget = useCallback(async (id: number) => {
    await requestJson(`/api/budgets/${id}`, { method: "DELETE" });
    setData((current) => ({ ...current, budgets: current.budgets.filter((item) => item.id !== id) }));
  }, []);

  const createGoal = useCallback(async (input: { name: string; targetCents: number; color: string; icon: string }) => {
    const created = await requestJson<GoalDTO>("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    setData((current) => ({ ...current, goals: [...current.goals, created] }));
  }, []);

  const deleteGoal = useCallback(async (id: number) => {
    await requestJson(`/api/goals/${id}`, { method: "DELETE" });
    setData((current) => ({ ...current, goals: current.goals.filter((item) => item.id !== id) }));
  }, []);

  /* ------------------------------ navigation ----------------------------- */

  // Troca de view em transition: o React monta a árvore nova (Overview/ManageView
  // são pesados) sem bloquear a main thread, mantendo a view atual visível até
  // ficar pronta. Sem isso o mount trava exatamente no frame de entrada.
  const selectView = useCallback((next: View) => {
    setMenuOpen(false);
    startTransition(() => setView(next));
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  // Mantém ?tab= na URL para que recarregar volte à mesma tela. Só sincroniza
  // depois de uma troca real de view: mexer na URL durante a hidratação, antes
  // de o roteador do Next assumir o history, faz a página ser remontada.
  const syncedView = useRef(initialView);
  useEffect(() => {
    if (syncedView.current === view) return;
    syncedView.current = view;
    const url = new URL(window.location.href);
    if (view === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", view);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [view]);

  const goSection = useCallback(
    (id: string) => {
      const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (view === "overview") {
        scroll();
        return;
      }
      selectView("overview");
      window.setTimeout(scroll, 160);
    },
    [view, selectView],
  );

  const openManage = useCallback(
    (tab: ManageTab) => {
      setManageTab(tab);
      selectView("manage");
    },
    [selectView],
  );

  const openNew = useCallback(() => {
    preloadModal();
    setMenuOpen(false);
    setModal({ open: true, editing: null });
  }, []);

  const openEdit = useCallback((t: TransactionDTO) => {
    preloadModal();
    setModal({ open: true, editing: t });
  }, []);

  const closeModal = useCallback(() => {
    setModal((current) => ({ ...current, open: false }));
    // o deep link ?action=new só sai da URL depois que o usuário fecha o sheet
    const url = new URL(window.location.href);
    if (url.searchParams.has("action")) {
      url.searchParams.delete("action");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  // atalho de teclado: N abre uma nova transação
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "n" && event.key !== "N") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      event.preventDefault();
      openNew();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNew]);

  const reportUrl = (format: "csv" | "pdf") => `/api/reports/${format}?month=${key}`;

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.refresh();
  };

  const headline =
    view === "overview" ? (
      <>
        <span className={`transition-opacity duration-300 ${hydrated ? "opacity-100" : "opacity-0"}`}>
          {hydrated ? greeting() : "Olá"}
        </span>
        ,{" "}
        <em className="text-accent not-italic underline decoration-fg/15 decoration-[3px] underline-offset-[9px]">
          tudo sob controle.
        </em>
      </>
    ) : view === "transactions" ? (
      <>
        Cada centavo,{" "}
        <em className="text-accent not-italic underline decoration-fg/15 decoration-[3px] underline-offset-[9px]">
          no seu lugar.
        </em>
      </>
    ) : (
      <>
        Organize seus <em className="text-accent not-italic">cadastros.</em>
      </>
    );

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1500px] items-start 3xl:max-w-[1760px]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-[calc(1rem+var(--safe-t))] focus:left-4 focus:z-[200] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Pular para o conteúdo
      </a>

      {/* ------------------------------ sidebar ----------------------------- */}
      <aside className="no-scrollbar sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r border-line px-4 py-6 lg:flex xl:w-64">
        <div className="px-2">
          <AurumLogo size={36} />
        </div>

        <nav aria-label="Navegação principal" className="mt-8 space-y-1">
          {NAV.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => selectView(item.id)}
                onMouseEnter={item.preload}
                className={`group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors ${
                  active
                    ? "bg-raised text-fg shadow-[inset_0_0_0_1px_var(--line)]"
                    : "text-fg-muted hover:bg-fg/[0.04] hover:text-fg"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full transition-colors ${active ? "bg-accent" : "bg-transparent"}`} />
                {item.label}
                {item.id === "transactions" && pendingCount > 0 && (
                  <span className="chip ml-auto bg-warning/15 text-warning" title={`${pendingCount} contas pendentes no mês`}>
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* em telas baixas (notebooks de 768px) os atalhos saem para o essencial caber */}
        <p className="eyebrow mt-7 px-3 [@media(max-height:820px)]:hidden">Painéis</p>
        <nav aria-label="Atalhos da visão geral" className="mt-2 space-y-0.5 [@media(max-height:820px)]:hidden">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goSection(item.id)}
              className="group flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium text-fg-muted transition-colors hover:bg-fg/[0.04] hover:text-fg"
            >
              <item.icon size={16} strokeWidth={2} className="text-fg-subtle group-hover:text-accent" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3 pt-6">
          <MonthSummary
            income={monthIncome}
            expense={monthExpense}
            net={monthNet}
            header={
              <div className="-mx-1 -mt-1 mb-2.5 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() => setMonth(shiftMonth(month.y, month.m, -1))}
                  className="grid h-8 w-8 place-items-center rounded-lg text-fg-muted hover:bg-fg/[0.06] hover:text-fg"
                >
                  <ChevronLeft size={15} />
                </button>
                <p className="font-display text-[13px] font-semibold capitalize">{fullMonthLabel(month.y, month.m)}</p>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  onClick={() => setMonth(shiftMonth(month.y, month.m, 1))}
                  className="grid h-8 w-8 place-items-center rounded-lg text-fg-muted hover:bg-fg/[0.06] hover:text-fg"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            }
          />

          <ThemeSegmented dense />

          <div className="flex items-center gap-2.5 px-1">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 font-display text-[12.5px] font-semibold text-accent">
              {initials || "?"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-fg">{user.name}</span>
              <span className="block truncate text-[11.5px] text-fg-subtle">{user.email}</span>
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Sair da conta"
              title="Sair"
              className="icon-btn h-9 w-9 hover:!text-negative"
            >
              <LogOut size={16} />
            </button>
          </div>

          <button type="button" onClick={openNew} onMouseEnter={preloadModal} className="btn btn-primary w-full">
            <Plus size={16} strokeWidth={2.6} />
            Nova transação
          </button>
        </div>
      </aside>

      {/* ------------------------------- main ------------------------------- */}
      <div className="min-w-0 flex-1">
        {/* barra superior compacta — única parte fixa no celular */}
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 pt-[var(--safe-t)] lg:hidden">
          <div className="flex h-[var(--topbar-h)] items-center justify-between gap-3 px-4 sm:px-6">
            <AurumLogo size={30} sublabel={false} className="min-w-0" />
            <MonthSwitcher month={month} onChange={setMonth} compact />
          </div>
        </header>

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-4 pt-6 pb-5 sm:px-6 lg:px-7 lg:pt-9 lg:pb-7">
          <div className="min-w-0">
            <p className="eyebrow mb-2 min-h-[1em]">{hydrated ? todayLong() : " "}</p>
            <h1 className="font-serif text-[clamp(1.75rem,7.4vw,2.75rem)] leading-[1.06] tracking-[-0.01em] text-fg">
              {headline}
            </h1>
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={() => setMonth(today)}
                className="mt-3.5 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[12.5px] font-medium text-fg-muted transition-colors hover:text-fg"
              >
                <RotateCcw size={13} />
                Voltar para {monthLabel(today.y, today.m).toLowerCase()}
              </button>
            )}
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <a href={reportUrl("csv")} className="btn btn-secondary px-3.5" title="Exportar CSV do mês">
              <Download size={15} /> CSV
            </a>
            <a href={reportUrl("pdf")} className="btn btn-secondary px-3.5" title="Exportar PDF do mês">
              <Download size={15} /> PDF
            </a>
            <MonthSwitcher month={month} onChange={setMonth} />
            <button
              type="button"
              onClick={openNew}
              onMouseEnter={preloadModal}
              className="btn btn-primary"
              title="Nova transação (atalho: N)"
            >
              <Plus size={16} strokeWidth={2.6} />
              Nova transação
              <kbd className="key">N</kbd>
            </button>
          </div>
        </div>

        <main id="conteudo" tabIndex={-1} className="px-4 pb-[calc(7rem+var(--safe-b))] outline-none sm:px-6 lg:px-7 lg:pb-16">
          {/* Sem AnimatePresence: o `exit` de mode="wait" adiava o unmount e jogava
              o mount da view nova em cima do primeiro frame da entrada. Com a key
              simples + startTransition, a entrada começa já com a árvore montada. */}
          <motion.div
            key={view}
            initial={{ opacity: 0, y: light ? 8 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: light ? 0.2 : 0.3, ease: "easeOut" }}
          >
            {view === "overview" ? (
              <Overview
                data={data}
                month={month}
                onEdit={openEdit}
                onNew={openNew}
                onSeeAll={() => selectView("transactions")}
                onManage={openManage}
                onTogglePaid={togglePaid}
                onEditBudget={editBudget}
                onDepositGoal={depositGoal}
                onImportRecurring={importRecurring}
              />
            ) : view === "transactions" ? (
              <TransactionsView
                data={data}
                month={month}
                onEdit={openEdit}
                onNew={openNew}
                onDelete={deleteTxn}
                onTogglePaid={togglePaid}
                onImportRecurring={importRecurring}
              />
            ) : (
              <ManageView
                data={data}
                user={user}
                tab={manageTab}
                onTabChange={setManageTab}
                onCreateCategory={createCategory}
                onUpdateCategory={updateCategory}
                onDeleteCategory={deleteCategory}
                onCreateBudget={createBudget}
                onDeleteBudget={deleteBudget}
                onCreateGoal={createGoal}
                onDeleteGoal={deleteGoal}
              />
            )}
          </motion.div>
        </main>
      </div>

      <BottomNav
        view={view}
        menuOpen={menuOpen}
        pendingCount={pendingCount}
        onSelectView={selectView}
        onOpenNew={openNew}
        onOpenMenu={() => setMenuOpen(true)}
      />

      <MenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        month={month}
        monthIncome={monthIncome}
        monthExpense={monthExpense}
        monthNet={monthNet}
        reportUrl={reportUrl}
        onSelectSection={goSection}
        onLogout={logout}
      />

      <TransactionModal
        key={`${modal.open ? "open" : "closed"}-${modal.editing?.id ?? "new"}`}
        open={modal.open}
        editing={modal.editing}
        categories={data.categories}
        onClose={closeModal}
        onSubmit={saveTxn}
        onDelete={deleteTxn}
        onManageCategories={() => {
          closeModal();
          openManage("categorias");
        }}
      />
    </div>
  );
}
