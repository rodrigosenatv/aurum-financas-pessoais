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
import { useMemo, useState } from "react";
import { fmt, fmtSigned, fullDayLabel, keyFromISO, monthKey } from "@/lib/format";
import { CategoryIcon } from "@/lib/icons";
import type { FinanceData, TransactionDTO, TxnType } from "@/lib/types";

export function TransactionsView({
  data,
  month,
  onEdit,
  onDelete,
  onTogglePaid,
}: {
  data: FinanceData;
  month: { y: number; m: number };
  onEdit: (t: TransactionDTO) => void;
  onDelete: (id: number) => Promise<void>;
  onTogglePaid: (id: number, currentPaid: boolean) => Promise<void>;
}) {
  const key = monthKey(month.y, month.m);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TxnType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending" | "recurring">("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [pagination, setPagination] = useState({ key, page: 1 });
  const pageSize = 40;

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
  const expense = filtered.reduce((s, t) => (t.type === "expense" ? s + t.amountCents : s), 0);
  const paidExpense = filtered.reduce((s, t) => (t.type === "expense" && t.isPaid ? s + t.amountCents : s), 0);
  const pendingExpense = filtered.reduce((s, t) => (t.type === "expense" && !t.isPaid ? s + t.amountCents : s), 0);

  const hasFilters = query !== "" || typeFilter !== "all" || catFilter !== "all" || statusFilter !== "all";

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
      {/* summary strip */}
      <div className="card flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
        <div>
          <p className="eyebrow mb-1">Transações</p>
          <p className="font-display text-[17px] font-semibold tabular-nums text-cream">{filtered.length}</p>
        </div>
        <div className="h-8 w-px bg-line" />
        <div>
          <p className="eyebrow mb-1">Entradas</p>
          <p className="font-display text-[17px] font-semibold tabular-nums text-accent">{fmt(income)}</p>
        </div>
        <div>
          <p className="eyebrow mb-1">Despesas Total</p>
          <p className="font-display text-[17px] font-semibold tabular-nums text-coral">{fmt(expense)}</p>
        </div>
        <div className="h-8 w-px bg-line" />
        <div>
          <p className="eyebrow mb-1">Pagas (Liquidadas)</p>
          <p className="font-display text-[17px] font-semibold tabular-nums text-accent">{fmt(paidExpense)}</p>
        </div>
        <div>
          <p className="eyebrow mb-1">Pendentes (A Pagar)</p>
          <p
            className={`font-display text-[17px] font-semibold tabular-nums ${
              pendingExpense > 0 ? "text-amber-400" : "text-faint"
            }`}
          >
            {fmt(pendingExpense)}
          </p>
        </div>
        <div className="h-8 w-px bg-line" />
        <div>
          <p className="eyebrow mb-1">Saldo do filtro</p>
          <p
            className="font-display text-[17px] font-semibold tabular-nums"
            style={{ color: income - expense >= 0 ? "#b6f244" : "#ff6e82" }}
          >
            {fmt(income - expense)}
          </p>
        </div>
      </div>

      {/* filters & tabs */}
      <div className="card space-y-3 px-5 py-4">
        {/* Quick status tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line pb-3">
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
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
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
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPagination({ key, page: 1 });
              }}
              placeholder="Buscar por descrição ou categoria..."
              className="field !pl-9"
            />
          </div>

          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as "all" | TxnType);
                setPagination({ key, page: 1 });
              }}
              className="field appearance-none !pr-9"
            >
              <option value="all">Tipos (Todos)</option>
              <option value="income">Receitas</option>
              <option value="expense">Despesas</option>
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint" />
          </div>

          <div className="relative">
            <select
              value={catFilter}
              onChange={(e) => {
                setCatFilter(e.target.value);
                setPagination({ key, page: 1 });
              }}
              className="field appearance-none !pr-9"
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
              className="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-[11px] text-[12px] font-medium text-mute transition-colors hover:border-line-strong hover:text-cream"
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
        <div className="card grid place-items-center px-6 py-20 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line text-faint">
            <SearchX size={20} />
          </span>
          <p className="mt-4 font-display text-[15px] font-semibold text-cream">Nada por aqui</p>
          <p className="mt-1 max-w-[260px] text-[12.5px] text-faint">
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
                <div className="flex items-baseline justify-between border-b border-line bg-cream/[0.025] px-6 py-2.5">
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
                      className={`group flex cursor-pointer items-center gap-3.5 border-b border-line/60 px-6 py-3 transition-colors last:border-0 hover:bg-cream/[0.03] ${
                        !t.isPaid && t.type === "expense" ? "bg-amber-500/[0.03]" : ""
                      }`}
                      onClick={() => onEdit(t)}
                    >
                      {/* Checkbox toggle Pago / Pendente */}
                      <button
                        type="button"
                        onClick={(e) => handleToggle(e, t)}
                        disabled={toggling === t.id}
                        title={t.isPaid ? "Marcado como pago. Clique para marcar pendente." : "Pendente. Clique para marcar como pago."}
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg transition-all ${
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

                      <CategoryIcon icon={t.category.icon} color={t.category.color} chip={37} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`truncate text-[13.5px] font-medium ${t.isPaid ? "text-cream" : "text-amber-200"}`}>
                            {t.description}
                          </p>
                          {!t.isPaid && t.type === "expense" && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-400">
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

                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <span
                          role="button"
                          aria-label="Editar"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(t);
                          }}
                          className="grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-cream/8 hover:text-cream"
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
                          className={`grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-coral/15 hover:text-coral ${
                            deleting === t.id ? "animate-pulse !opacity-100 text-coral" : ""
                          }`}
                        >
                          <Trash2 size={13} />
                        </span>
                      </div>

                      <div className="text-right">
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
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page === 1}
            onClick={() => setPagination({ key, page: Math.max(1, page - 1) })}
            className="rounded-xl border border-line px-4 py-2 text-xs text-mute hover:text-cream disabled:opacity-30"
          >
            Anterior
          </button>
          <span className="text-xs text-faint">Página {page} de {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPagination({ key, page: Math.min(totalPages, page + 1) })}
            className="rounded-xl border border-line px-4 py-2 text-xs text-mute hover:text-cream disabled:opacity-30"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
