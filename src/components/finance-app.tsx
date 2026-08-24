"use client";

import { AnimatePresence, motion } from "framer-motion";
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
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { fmt, fullMonthLabel, greeting, keyFromISO, monthKey, shiftMonth, shortMonthLabel, todayLong } from "@/lib/format";
import type { BudgetDTO, CategoryDTO, FinanceData, GoalDTO, TransactionDTO, TxnPayload, UserDTO } from "@/lib/types";
import { ManageView } from "./manage-view";
import { Overview } from "./overview";
import { TransactionModal } from "./transaction-modal";
import { TransactionsView } from "./transactions-view";
import { AurumLogo } from "./logo";
import { BottomNav, NavDrawer, type View } from "./mobile-nav";

const NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
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

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error ?? "Não foi possível concluir a operação.");
  return body as T;
}

export function FinanceApp({ initialData, user }: { initialData: FinanceData; user: UserDTO }) {
  const [data, setData] = useState(initialData);
  const router = useRouter();

  const now = new Date();
  const [view, setView] = useState<View>("overview");
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; editing: TransactionDTO | null }>({
    open: false,
    editing: null,
  });

  const key = monthKey(month.y, month.m);
  const atCurrentMonth =
    month.y > now.getFullYear() ||
    (month.y === now.getFullYear() && month.m >= now.getMonth());

  const monthTxns = useMemo(
    () => data.transactions.filter((t) => keyFromISO(t.date) === key),
    [data.transactions, key],
  );
  const monthIncome = monthTxns.reduce((s, t) => (t.type === "income" ? s + t.amountCents : s), 0);
  const monthExpense = monthTxns.reduce((s, t) => (t.type === "expense" ? s + t.amountCents : s), 0);
  const monthNet = monthIncome - monthExpense;

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
            category: { name: category.name, icon: category.icon, color: category.color },
          }
        : null;
      if (optimistic)
        setData((current) => ({
          ...current,
          transactions: current.transactions.map((item) => (item.id === id ? optimistic : item)),
        }));
      try {
        const result = await requestJson<(Omit<TransactionDTO, "category"> & { userId?: number }) | Array<Omit<TransactionDTO, "category"> & { userId?: number }>>(
          id ? `/api/transactions/${id}` : "/api/transactions",
          {
            method: id ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const rows = (Array.isArray(result) ? result : [result]).map((item) => ({
          ...item,
          category: { name: category.name, icon: category.icon, color: category.color },
        }));
        setData((current) => ({
          ...current,
          transactions: id
            ? current.transactions.map((item) => (item.id === id ? rows[0] : item))
            : [...rows, ...current.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
        }));
      } catch (error) {
        if (previous)
          setData((current) => ({
            ...current,
            transactions: current.transactions.map((item) => (item.id === previous.id ? previous : item)),
          }));
        throw error;
      }
    },
    [data.categories, data.transactions],
  );

  const deleteTxn = useCallback(
    async (id: number) => {
      const previous = data.transactions;
      setData((current) => ({ ...current, transactions: current.transactions.filter((item) => item.id !== id) }));
      try {
        await requestJson(`/api/transactions/${id}`, { method: "DELETE" });
      } catch (error) {
        setData((current) => ({ ...current, transactions: previous }));
        throw error;
      }
    },
    [data.transactions],
  );

  const togglePaid = useCallback(
    async (id: number, currentPaid: boolean) => {
      const nextPaid = !currentPaid;
      setData((current) => ({
        ...current,
        transactions: current.transactions.map((t) =>
          t.id === id ? { ...t, isPaid: nextPaid } : t,
        ),
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
          transactions: current.transactions.map((t) =>
            t.id === id ? { ...t, isPaid: currentPaid } : t,
          ),
        }));
        throw error;
      }
    },
    [],
  );

  const changeMonth = useCallback((target: { y: number; m: number }) => {
    setMonth(target);
  }, [setMonth]);

  const importRecurring = useCallback(
    async (targetKey: string) => {
      try {
        const synced = await requestJson<TransactionDTO[]>("/api/transactions/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month: targetKey, action: "import" }),
        });
        if (synced && Array.isArray(synced) && synced.length > 0) {
          setData((current) => {
            const nonTargetTxns = current.transactions.filter(
              (t) => keyFromISO(t.date) !== targetKey,
            );
            return {
              ...current,
              transactions: [...synced, ...nonTargetTxns].sort(
                (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
              ),
            };
          });
        }
      } catch (e) {
        console.error("Erro ao importar gastos fixos do mês:", e);
        throw e;
      }
    },
    [],
  );

  const editBudget = useCallback(
    async (budget: BudgetDTO, amountCents: number) => {
      const previous = budget.amountCents;
      setData((current) => ({
        ...current,
        budgets: current.budgets.map((item) => item.id === budget.id ? { ...item, amountCents } : item),
      }));
      try {
        await requestJson(`/api/budgets/${budget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountCents }),
        });
      } catch (error) {
        setData((current) => ({
          ...current,
          budgets: current.budgets.map((item) => item.id === budget.id ? { ...item, amountCents: previous } : item),
        }));
        throw error;
      }
    },
    [],
  );

  const depositGoal = useCallback(
    async (id: number, addCents: number) => {
      const previous = data.goals.find((item) => item.id === id);
      if (!previous) return;
      setData((current) => ({
        ...current,
        goals: current.goals.map((item) => item.id === id ? { ...item, currentCents: item.currentCents + addCents } : item),
      }));
      try {
        const updated = await requestJson<GoalDTO>(`/api/goals/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addCents }),
        });
        setData((current) => ({ ...current, goals: current.goals.map((item) => item.id === id ? updated : item) }));
      } catch (error) {
        setData((current) => ({ ...current, goals: current.goals.map((item) => item.id === id ? previous : item) }));
        throw error;
      }
    },
    [data.goals],
  );

  const createCategory = async (input: Omit<CategoryDTO, "id">) => {
    const created = await requestJson<CategoryDTO>("/api/categories", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
    setData((current) => ({ ...current, categories: [...current.categories, created] }));
  };
  const updateCategory = async (id: number, input: Partial<Omit<CategoryDTO, "id">>) => {
    const updated = await requestJson<CategoryDTO>(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    setData((current) => ({
      ...current,
      categories: current.categories.map((item) => (item.id === id ? updated : item)),
      transactions: current.transactions.map((t) =>
        t.categoryId === id
          ? {
              ...t,
              category: {
                name: updated.name,
                icon: updated.icon,
                color: updated.color,
              },
            }
          : t,
      ),
    }));
  };
  const deleteCategory = async (id: number) => {
    await requestJson(`/api/categories/${id}`, { method: "DELETE" });
    setData((current) => ({ ...current, categories: current.categories.filter((item) => item.id !== id) }));
  };
  const createBudget = async (categoryId: number, amountCents: number) => {
    const created = await requestJson<BudgetDTO>("/api/budgets", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categoryId, amountCents }),
    });
    setData((current) => ({ ...current, budgets: [...current.budgets, created] }));
  };
  const deleteBudget = async (id: number) => {
    await requestJson(`/api/budgets/${id}`, { method: "DELETE" });
    setData((current) => ({ ...current, budgets: current.budgets.filter((item) => item.id !== id) }));
  };
  const createGoal = async (input: { name: string; targetCents: number; color: string; icon: string }) => {
    const created = await requestJson<GoalDTO>("/api/goals", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
    setData((current) => ({ ...current, goals: [...current.goals, created] }));
  };
  const deleteGoal = async (id: number) => {
    await requestJson(`/api/goals/${id}`, { method: "DELETE" });
    setData((current) => ({ ...current, goals: current.goals.filter((item) => item.id !== id) }));
  };

  /* ------------------------------- helpers ------------------------------- */

  const goSection = (id: string) => {
    setView("overview");
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const openNew = () => setModal({ open: true, editing: null });
  const openEdit = (t: TransactionDTO) => setModal({ open: true, editing: t });

  const isOverview = view === "overview";
  const reportUrl = (format: "csv" | "pdf") => `/api/reports/${format}?month=${key}`;
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  };

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1500px] 3xl:max-w-[1760px] items-start">
      {/* ------------------------------ sidebar ----------------------------- */}
      <aside className="sticky top-0 hidden h-dvh lg:w-56 xl:w-60 2xl:w-64 shrink-0 flex-col border-r border-line px-5 py-7 lg:flex">
        <div className="px-1">
          <AurumLogo size={36} />
        </div>

        <nav className="mt-10 space-y-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200 ${
                view === item.id
                  ? "bg-raise text-cream shadow-[inset_0_0_0_1px_rgba(238,242,228,0.06)]"
                  : "text-mute hover:text-cream"
              }`}
            >
              <item.icon
                size={16}
                strokeWidth={2}
                className={view === item.id ? "text-accent" : "text-faint group-hover:text-mute"}
              />
              {item.label}
              {view === item.id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
            </button>
          ))}
        </nav>

        <p className="eyebrow mt-9 px-3">Painéis</p>
        <nav className="mt-2 space-y-1">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              onClick={() => goSection(item.id)}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-mute transition-colors hover:text-cream"
            >
              <item.icon size={15} strokeWidth={2} className="text-faint group-hover:text-mute" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* month mini panel */}
        <div className="mt-auto rounded-2xl border border-line bg-panel p-4">
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
              <motion.div
                className="h-full rounded-full bg-accent"
                animate={{
                  width: `${monthIncome > 0 ? Math.min(100, (monthIncome / Math.max(monthIncome, monthExpense)) * 100) : 0}%`,
                }}
                transition={{ duration: 0.8, ease: "easeOut" }}
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

        <div className="mt-3 flex items-center gap-2 px-1 text-[11px] text-faint">
          <span className="min-w-0 flex-1 truncate" title={user.email}>{user.name}</span>
          <button onClick={() => void logout()} aria-label="Sair" className="hover:text-coral"><LogOut size={14} /></button>
        </div>

        <button
          onClick={openNew}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-[13.5px] font-semibold text-ink transition-all duration-200 hover:shadow-[0_10px_40px_-8px_rgba(182,242,68,0.5)] active:scale-[0.98]"
        >
          <Plus size={16} strokeWidth={2.6} />
          Nova transação
        </button>
      </aside>

      {/* ------------------------------- main ------------------------------- */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-line bg-ink/78 backdrop-blur-xl">
          {/* mobile top bar */}
          <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 xs:px-4 sm:px-6 lg:hidden">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="Abrir menu"
                className="grid h-11 w-11 place-items-center rounded-xl border border-line text-mute transition-colors hover:border-line-strong hover:text-cream"
              >
                <Menu size={20} />
              </button>
              <AurumLogo size={30} sublabel={false} />
            </div>

            {/* Compact mobile month switcher */}
            <div className="flex items-center rounded-xl border border-line bg-panel p-0.5">
              <button
                aria-label="Mês anterior"
                onClick={() => changeMonth(shiftMonth(month.y, month.m, -1))}
                className="grid h-9 w-9 place-items-center rounded-lg text-mute transition-colors hover:bg-cream/6 hover:text-cream"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="min-w-[4.8rem] xs:min-w-[7.5rem] px-1 text-center font-display text-[12px] xs:text-[13px] font-semibold capitalize tracking-tight">
                <span className="xs:hidden">{shortMonthLabel(month.y, month.m)} {month.y}</span>
                <span className="hidden xs:inline">{fullMonthLabel(month.y, month.m)}</span>
              </p>
              <button
                aria-label="Próximo mês"
                onClick={() => changeMonth(shiftMonth(month.y, month.m, 1))}
                className="grid h-9 w-9 place-items-center rounded-lg text-mute transition-colors hover:bg-cream/6 hover:text-cream"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-3 pb-4 pt-2 xs:px-4 sm:px-6 sm:pb-5 sm:pt-4 lg:pt-8 lg:px-7">
            <div>
              <p className="eyebrow mb-1.5 sm:mb-2.5">{todayLong()}</p>
              <h1 className="font-serif text-[clamp(1.5rem,5.2vw,2.7rem)] leading-[1.06] tracking-[-0.01em] text-cream">
                {isOverview ? (
                  <>
                    {greeting()},{" "}
                    <em className="text-accent not-italic underline decoration-cream/15 decoration-[3px] underline-offset-[10px]">
                      tudo sob controle.
                    </em>
                  </>
                ) : view === "transactions" ? (
                  <>
                    Cada centavo,{" "}
                    <em className="text-accent not-italic underline decoration-cream/15 decoration-[3px] underline-offset-[10px]">
                      no seu lugar.
                    </em>
                  </>
                ) : (
                  <>Organize seus <em className="text-accent not-italic">cadastros.</em></>
                )}
              </h1>
            </div>

            <div className="hidden items-center gap-2.5 lg:flex">
              <a href={reportUrl("csv")} title="Exportar CSV" className="hidden h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-xs text-mute hover:text-cream sm:flex">
                <Download size={14} /> CSV
              </a>
              <a href={reportUrl("pdf")} title="Exportar PDF" className="hidden h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-xs text-mute hover:text-cream sm:flex">
                <Download size={14} /> PDF
              </a>
              {/* desktop month switcher */}
              <div className="flex items-center rounded-xl border border-line bg-panel p-1">
                <button
                  aria-label="Mês anterior"
                  onClick={() => changeMonth(shiftMonth(month.y, month.m, -1))}
                  className="grid h-8 w-8 place-items-center rounded-lg text-mute transition-colors hover:bg-cream/6 hover:text-cream"
                >
                  <ChevronLeft size={16} />
                </button>
                <p className="min-w-[8.5rem] text-center font-display text-[13px] font-semibold capitalize tracking-tight">
                  {fullMonthLabel(month.y, month.m)}
                </p>
                <button
                  aria-label="Próximo mês"
                  onClick={() => changeMonth(shiftMonth(month.y, month.m, 1))}
                  className="grid h-8 w-8 place-items-center rounded-lg text-mute transition-colors hover:bg-cream/6 hover:text-cream"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <button
                onClick={openNew}
                className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-ink transition-all hover:shadow-[0_10px_36px_-10px_rgba(182,242,68,0.55)] active:scale-[0.98]"
              >
                <Plus size={15} strokeWidth={2.6} />
                Nova transação
              </button>
            </div>
          </div>
        </header>

        <main className="px-3 xs:px-4 sm:px-6 lg:px-7 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 sm:pt-7 lg:pb-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {isOverview ? (
                <Overview
                  data={data}
                  month={month}
                  onEdit={openEdit}
                  onSeeAll={() => setView("transactions")}
                  onTogglePaid={togglePaid}
                  onEditBudget={editBudget}
                  onDepositGoal={depositGoal}
                  onImportRecurring={() => importRecurring(key)}
                />
              ) : view === "transactions" ? (
                <TransactionsView
                  data={data}
                  month={month}
                  onEdit={openEdit}
                  onDelete={deleteTxn}
                  onTogglePaid={togglePaid}
                  onImportRecurring={() => importRecurring(key)}
                />
              ) : (
                <ManageView
                  data={data}
                  user={user}
                  onCreateCategory={createCategory}
                  onUpdateCategory={updateCategory}
                  onDeleteCategory={deleteCategory}
                  onCreateBudget={createBudget}
                  onDeleteBudget={deleteBudget}
                  onCreateGoal={createGoal}
                  onDeleteGoal={deleteGoal}
                  onTogglePaid={togglePaid}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* --------------------------- mobile nav --------------------------- */}
      <BottomNav
        view={view}
        onSelectView={setView}
        onOpenNew={openNew}
      />

      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
        month={month}
        monthIncome={monthIncome}
        monthExpense={monthExpense}
        monthNet={monthNet}
        onSelectSection={goSection}
        onOpenNew={openNew}
        reportUrl={reportUrl}
        onLogout={logout}
      />

      <TransactionModal
        key={`${modal.open ? "open" : "closed"}-${modal.editing?.id ?? "new"}`}
        open={modal.open}
        editing={modal.editing}
        categories={data.categories}
        onClose={() => setModal((p) => ({ ...p, open: false }))}
        onSubmit={saveTxn}
      />
    </div>
  );
}
