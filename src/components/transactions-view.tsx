"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Clock,
  Pencil,
  Repeat2,
  Search,
  SearchX,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { fmt, fmtSigned, fullDayLabel, keyFromISO, monthKey } from "@/lib/format";
import { CategoryIcon } from "@/lib/icons";
import type { FinanceData, TransactionDTO, TxnType } from "@/lib/types";

export const TransactionsView = memo(function TransactionsView({
  data,
  month,
  onEdit,
  onDelete,
  onTogglePaid,
  onImportRecurring,
}: {
  data: FinanceData;
  month: { y: number; m: number };
  onEdit: (t: TransactionDTO) => void;
  onDelete: (id: number) => Promise<void>;
  onTogglePaid: (id: number, currentPaid: boolean) => Promise<void>;
  onImportRecurring?: () => Promise<void>;
}) {
  const key = monthKey(month.y, month.m);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TxnType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending" | "recurring">("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [pagination, setPagination] = useState({ key, page: 1 });
  const pageSize = 40;

  // Compute missing recurring items available to import for this month
  const missingRecurring = useMemo(() => {
    const userRecurring = data.transactions.filter((t) => t.isRecurring);
    if (userRecurring.length === 0) return [];

    const templatesMap = new Map<string, TransactionDTO>();
    for (const item of userRecurring) {
      const k = `${item.type}:${item.categoryId}:${item.description.trim().toLowerCase()}`;
      if (!templatesMap.has(k)) {
        templatesMap.set(k, item);
      }
    }

    const currentMonthKeys = new Set(
      data.transactions
        .filter((t) => keyFromISO(t.date) === key)
        .map((t) => `${t.type}:${t.categoryId}:${t.description.trim().toLowerCase()}`),
    );

    const available: TransactionDTO[] = [];
    for (const [k, tpl] of templatesMap.entries()) {
      if (!currentMonthKeys.has(k)) {
        available.push(tpl);
      }
    }
    return available;
  }, [data.transactions, key]);

  const missingExpensesCount = missingRecurring.filter((t) => t.type === "expense").length;
  const missingIncomeCount = missingRecurring.filter((t) => t.type === "income").length;

  const monthTxns = useMemo(
    () => data.transactions.filter((t) => keyFromISO(t.date) === key),
    [data.transactions, key],
  );

  const pendingCount = useMemo(
    () => monthTxns.filter((t) => t.type === "expense" && !t.isPaid).length,
    [monthTxns],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return monthTxns.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (catFilter !== "all" && String(t.categoryId) !== catFilter) return false;
      if (statusFilter === "paid" && !t.isPaid) return false;
      if (statusFilter === "pending" && t.isPaid) return false;
      if (statusFilter === "recurring" && !t.isRecurring) return false;
      if (q && !t.description.toLowerCase().includes(q) && !t.category.name.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [monthTxns, query, typeFilter, catFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = pagination.key === key ? Math.min(pagination.page, totalPages) : 1;
  const visible = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  );

  const groups = useMemo(() => {
    const map = new Map<string, TransactionDTO[]>();
    for (const t of visible) {
      const list = map.get(t.date);
      if (list) list.push(t);
      else map.set(t.date, [t]);
    }
    return [...map.entries()];
  }, [visible]);

  const income = filtered.reduce((s, t) => (t.type === "income" ? s + t.amountCents : s), 0);
  const paidIncome = filtered.reduce((s, t) => (t.type === "income" && t.isPaid ? s + t.amountCents : s), 0);
  const pendingIncome = filtered.reduce((s, t) => (t.type === "income" && !t.isPaid ? s + t.amountCents : s), 0);

  const expense = filtered.reduce((s, t) => (t.type === "expense" ? s + t.amountCents : s), 0);
  const paidExpense = filtered.reduce((s, t) => (t.type === "expense" && t.isPaid ? s + t.amountCents : s), 0);
  const pendingExpense = filtered.reduce((s, t) => (t.type === "expense" && !t.isPaid ? s + t.amountCents : s), 0);

  const hasFilters = query !== "" || typeFilter !== "all" || catFilter !== "all" || statusFilter !== "all";

  const handleImport = async () => {
    if (!onImportRecurring) return;
    setImporting(true);
    try {
      await onImportRecurring();
    } finally {
      setImporting(false);
    }
  };

  const remove = async (id: number) => {
    setDeleting(id);
    try {
      await onDelete(id);
    } finally {
      setDeleting(null);
    }
  };

  const handleToggle = async (e: React.MouseEvent, t: TransactionDTO) => {
    e.stopPropagation();
    setToggling(t.id);
    try {
      await onTogglePaid(t.id, t.isPaid);
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner de Importação de Fixos */}
      {missingRecurring.length > 0 && onImportRecurring && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-accent/[0.07] p-4.5 text-cream lg:backdrop-blur-md shadow-[0_10px_35px_-15px_rgba(182,242,68,0.2)]">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-ink">
              <Repeat2 size={20} strokeWidth={2.4} />
            </span>
            <div>
              <p className="font-display text-[14.5px] font-semibold text-cream">
                Lançamentos Fixos Prontos para Importar
              </p>
              <p className="text-[12px] text-faint">
                {missingExpensesCount > 0 && `${missingExpensesCount} despesa${missingExpensesCount > 1 ? "s" : ""}`}
                {missingExpensesCount > 0 && missingIncomeCount > 0 && " e "}
                {missingIncomeCount > 0 && `${missingIncomeCount} receita${missingIncomeCount > 1 ? "s" : ""}`} disponíveis para o mês selecionado.
              </p>
            </div>
          </div>

          <button
            disabled={importing}
            onClick={() => void handleImport()}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-ink shadow-[0_10px_25px_-5px_rgba(182,242,68,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Repeat2 size={14} className={importing ? "animate-spin" : ""} strokeWidth={2.4} />
            {importing ? "Importando..." : "Importar Fixos do Mês"}
          </button>
        </div>
      )}

      {/* summary strip */}
      <div className="card grid grid-cols-2 xs:grid-cols-3 lg:grid-cols-5 gap-3 p-4 sm:p-5 lg:gap-0 lg:divide-x lg:divide-line">
        <div className="px-1 sm:px-2 lg:px-4">
          <p className="eyebrow mb-1">Transações</p>
          <p className="font-display text-[16px] sm:text-[17px] font-semibold tabular-nums text-cream">{filtered.length}</p>
        </div>
        <div className="px-1 sm:px-2 lg:px-4">
          <p className="eyebrow mb-1">Entradas Total</p>
          <p className="font-display text-[16px] sm:text-[17px] font-semibold tabular-nums text-accent">{fmt(income)}</p>
          <p className="text-[10px] text-faint mt-0.5">{fmt(paidIncome)} recebidas</p>
        </div>
        <div className="px-1 sm:px-2 lg:px-4">
          <p className="eyebrow mb-1">Despesas Total</p>
          <p className="font-display text-[16px] sm:text-[17px] font-semibold tabular-nums text-coral">{fmt(expense)}</p>
          <p className="text-[10px] text-faint mt-0.5">{fmt(paidExpense)} pagas</p>
        </div>
        <div className="px-1 sm:px-2 lg:px-4">
          <p className="eyebrow mb-1">Pendentes a Pagar</p>
          <p
            className={`font-display text-[16px] sm:text-[17px] font-semibold tabular-nums ${
              pendingExpense > 0 ? "text-amber-400" : "text-faint"
            }`}
          >
            {fmt(pendingExpense)}
          </p>
          <p className="text-[10px] text-faint mt-0.5">{pendingCount} contas</p>
        </div>
        <div className="col-span-2 xs:col-span-1 px-1 sm:px-2 lg:px-4">
          <p className="eyebrow mb-1">Saldo do filtro</p>
          <p
            className="font-display text-[16px] sm:text-[17px] font-semibold tabular-nums"
            style={{ color: income - expense >= 0 ? "#b6f244" : "#ff6e82" }}
          >
            {fmt(income - expense)}
          </p>
          <p className="text-[10px] text-faint mt-0.5">
            Realizado: <span className="font-semibold">{fmt(paidIncome - paidExpense)}</span>
          </p>
        </div>
      </div>

      {/* filters & tabs */}
      <div className="card space-y-3 px-3 xs:px-4 sm:px-5 py-4">
        {/* Quick status tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar snap-x border-b border-line pb-3">
          {(
            [
              { id: "all", label: "Todas" },
              { id: "pending", label: "Pendentes", count: pendingCount },
              { id: "paid", label: "Pagas" },
              { id: "recurring", label: "Gastos Fixos" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPagination({ key, page: 1 });
              }}
              className={`flex shrink-0 snap-start items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold min-h-[44px] transition-all ${
                statusFilter === tab.id
                  ? "bg-accent text-ink shadow-[0_2px_12px_rgba(182,242,68,0.3)]"
                  : "bg-panel text-mute hover:bg-cream/6 hover:text-cream"
              }`}
            >
              {tab.label}
              {"count" in tab && tab.count && tab.count > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    statusFilter === tab.id ? "bg-ink/20 text-ink" : "bg-amber-400/20 text-amber-400"
                  }`}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative basis-[min(100%,260px)] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPagination({ key, page: 1 });
              }}
              placeholder="Buscar por descrição ou categoria..."
              className="field !pl-9 w-full"
            />
          </div>

          <div className="relative basis-[min(100%,160px)] flex-1 xs:flex-none">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as "all" | TxnType);
                setPagination({ key, page: 1 });
              }}
              className="field appearance-none !pr-9 w-full"
            >
              <option value="all">Tipos (Todos)</option>
              <option value="income">Receitas</option>
              <option value="expense">Despesas</option>
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint" />
          </div>

          <div className="relative basis-[min(100%,190px)] flex-1 xs:flex-none">
            <select
              value={catFilter}
              onChange={(e) => {
                setCatFilter(e.target.value);
                setPagination({ key, page: 1 });
              }}
              className="field appearance-none !pr-9 w-full"
            >
              <option value="all">Todas as categorias</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint" />
          </div>

          {hasFilters && (
            <button
              onClick={() => {
                setQuery("");
                setTypeFilter("all");
                setStatusFilter("all");
                setCatFilter("all");
                setPagination({ key, page: 1 });
              }}
              className="flex w-full xs:w-auto items-center justify-center gap-1.5 rounded-xl border border-line px-3.5 py-2.5 text-[12px] font-medium text-mute transition-colors hover:border-line-strong hover:text-cream min-h-[44px]"
            >
              <X size={13} /> Limpar
            </button>
          )}

          <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-faint sm:flex">
            <SlidersHorizontal size={12} /> mostrando {visible.length} de {filtered.length}
          </span>
        </div>
      </div>

      {/* list */}
      {groups.length === 0 ? (
        <div className="card grid place-items-center px-4 sm:px-6 py-20 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line text-faint">
            <SearchX size={20} />
          </span>
          <p className="mt-4 font-display text-[15px] font-semibold text-cream">Nada por aqui</p>
          <p className="mt-1 max-w-[28ch] text-[12.5px] text-faint">
            Nenhuma transação encontrada com esses filtros neste mês.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {groups.map(([date, items]) => {
            const dayNet = items.reduce(
              (s, t) => s + (t.type === "income" ? t.amountCents : -t.amountCents),
              0,
            );
            return (
              <div key={date}>
                <div className="flex items-baseline justify-between border-b border-line bg-cream/[0.025] px-3 xs:px-4 sm:px-6 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
                    {fullDayLabel(date)}
                  </p>
                  <p
                    className="font-display text-[11.5px] font-medium tabular-nums"
                    style={{ color: dayNet >= 0 ? "rgba(182,242,68,0.75)" : "rgba(255,110,130,0.75)" }}
                  >
                    {fmt(dayNet)}
                  </p>
                </div>
                <AnimatePresence initial={false}>
                  {items.map((t) => (
                    <motion.div
                      key={t.id}
                      layout
                      exit={{ opacity: 0, x: -24, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`group flex flex-wrap sm:flex-nowrap cursor-pointer items-center gap-3 sm:gap-3.5 border-b border-line/60 px-3 xs:px-4 sm:px-6 py-3 transition-colors last:border-0 hover:bg-cream/[0.03] ${
                        !t.isPaid && t.type === "expense" ? "bg-amber-500/[0.03]" : ""
                      }`}
                      onClick={() => onEdit(t)}
                    >
                      {/* Checkbox toggle Pago / Pendente with 44px tap target */}
                      <div className="grid h-11 w-11 shrink-0 place-items-center -m-2">
                        <button
                          type="button"
                          onClick={(e) => handleToggle(e, t)}
                          disabled={toggling === t.id}
                          title={t.isPaid ? "Marcado como pago. Clique para marcar pendente." : "Pendente. Clique para marcar como pago."}
                          className={`grid h-6 w-6 place-items-center rounded-lg transition-all ${
                            t.isPaid
                              ? "bg-accent/15 text-accent border border-accent/30 hover:bg-accent hover:text-ink"
                              : "border-2 border-amber-400 bg-amber-400/10 text-amber-400 hover:bg-amber-400 hover:text-ink animate-pulse"
                          }`}
                        >
                          {t.isPaid ? (
                            <Check size={13} strokeWidth={2.8} />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          )}
                        </button>
                      </div>

                      <CategoryIcon icon={t.category.icon} color={t.category.color} chip={37} />

                      <div className="min-w-0 flex-1 basis-[calc(100%-140px)] sm:basis-auto">
                        <div className="flex items-center gap-2">
                          <p className={`truncate text-[13.5px] font-medium ${t.isPaid ? "text-cream" : "text-amber-200"}`}>
                            {t.description}
                          </p>
                          {!t.isPaid && t.type === "expense" && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-400 shrink-0">
                              <Clock size={10} /> pendente
                            </span>
                          )}
                        </div>

                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
                          <span>{t.category.name}</span>
                          {t.installmentTotal && (
                            <span className="inline-flex rounded-md bg-cream/5 px-1.5 py-0.2 text-[9.5px] text-mute">
                              parcela {t.installmentNumber}/{t.installmentTotal}
                            </span>
                          )}
                          {t.isRecurring && (
                            <span className="inline-flex items-center gap-0.8 rounded-md bg-accent/10 px-1.5 py-0.2 text-[9.5px] font-medium text-accent">
                              <Repeat2 size={10} /> fixa
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="hover-reveal [@media(hover:hover)]:opacity-0 flex items-center gap-1 sm:opacity-0 transition-opacity group-hover:opacity-100 order-3 sm:order-none ml-auto sm:ml-0">
                        <span
                          role="button"
                          aria-label="Editar"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(t);
                          }}
                          className="grid h-9 w-9 sm:h-7 sm:w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-cream/8 hover:text-cream"
                        >
                          <Pencil size={13} />
                        </span>
                        <span
                          role="button"
                          aria-label="Excluir"
                          onClick={(e) => {
                            e.stopPropagation();
                            void remove(t.id);
                          }}
                          className={`grid h-9 w-9 sm:h-7 sm:w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-coral/15 hover:text-coral ${
                            deleting === t.id ? "animate-pulse !opacity-100 text-coral" : ""
                          }`}
                        >
                          <Trash2 size={13} />
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <p
                          className={`font-display text-[13.5px] font-medium tabular-nums ${
                            t.type === "income" ? "text-accent" : t.isPaid ? "text-cream" : "text-amber-300"
                          }`}
                        >
                          {fmtSigned(t.amountCents, t.type)}
                        </p>
                        <p className="text-[10px] text-faint">
                          {t.isPaid ? "pago" : "a pagar"}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
      {filtered.length > pageSize && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            disabled={page === 1}
            onClick={() => setPagination({ key, page: Math.max(1, page - 1) })}
            className="min-h-[44px] rounded-xl border border-line px-4 py-2 text-xs text-mute hover:text-cream disabled:opacity-30"
          >
            Anterior
          </button>
          <span className="text-xs text-faint">Página {page} de {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPagination({ key, page: Math.min(totalPages, page + 1) })}
            className="min-h-[44px] rounded-xl border border-line px-4 py-2 text-xs text-mute hover:text-cream disabled:opacity-30"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
});
