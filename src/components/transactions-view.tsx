"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Clock,
  LoaderCircle,
  Pencil,
  Plus,
  ReceiptText,
  Repeat2,
  Search,
  SearchX,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { fmt, fmtSigned, fullDayLabel, keyFromISO, monthKey, monthLabel } from "@/lib/format";
import { CategoryIcon } from "@/lib/icons";
import type { FinanceData, TransactionDTO, TxnType } from "@/lib/types";
import { describeCounts, useMissingRecurring } from "@/lib/use-missing-recurring";
import { EmptyState, PaidToggle } from "./ui";

type Status = "all" | "pending" | "paid" | "recurring";

const PAGE = 40;

const signedNet = (cents: number) => `${cents >= 0 ? "+" : "−"} ${fmt(Math.abs(cents))}`;

function statusLabel(t: TransactionDTO) {
  if (t.type === "income") return t.isPaid ? "recebida" : "a receber";
  return t.isPaid ? "paga" : "pendente";
}

export const TransactionsView = memo(function TransactionsView({
  data,
  month,
  onEdit,
  onNew,
  onDelete,
  onTogglePaid,
  onImportRecurring,
}: {
  data: FinanceData;
  month: { y: number; m: number };
  onEdit: (t: TransactionDTO) => void;
  onNew: () => void;
  onDelete: (t: TransactionDTO) => void;
  onTogglePaid: (id: number, currentPaid: boolean) => Promise<void>;
  onImportRecurring: () => Promise<void>;
}) {
  const key = monthKey(month.y, month.m);
  const monthName = monthLabel(month.y, month.m).toLowerCase();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TxnType>("all");
  const [statusFilter, setStatusFilter] = useState<Status>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);

  const missing = useMissingRecurring(data.transactions, key);

  const monthTxns = useMemo(() => data.transactions.filter((t) => keyFromISO(t.date) === key), [data.transactions, key]);

  const pendingCount = useMemo(() => monthTxns.filter((t) => t.type === "expense" && !t.isPaid).length, [monthTxns]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return monthTxns.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (catFilter !== "all" && String(t.categoryId) !== catFilter) return false;
      if (statusFilter === "paid" && !t.isPaid) return false;
      if (statusFilter === "pending" && t.isPaid) return false;
      if (statusFilter === "recurring" && !t.isRecurring) return false;
      if (q && !t.description.toLowerCase().includes(q) && !t.category.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [monthTxns, query, typeFilter, catFilter, statusFilter]);

  // "Mostrar mais" volta ao início sempre que o mês ou os filtros mudam
  const signature = `${key}|${query}|${typeFilter}|${statusFilter}|${catFilter}`;
  const [shown, setShown] = useState({ signature, count: PAGE });
  const count = shown.signature === signature ? shown.count : PAGE;
  const visible = useMemo(() => filtered.slice(0, count), [filtered, count]);

  const groups = useMemo(() => {
    const map = new Map<string, TransactionDTO[]>();
    for (const t of visible) {
      const list = map.get(t.date);
      if (list) list.push(t);
      else map.set(t.date, [t]);
    }
    return [...map.entries()];
  }, [visible]);

  const totals = useMemo(() => {
    let income = 0;
    let paidIncome = 0;
    let expense = 0;
    let paidExpense = 0;
    let pendingExpense = 0;
    for (const t of filtered) {
      if (t.type === "income") {
        income += t.amountCents;
        if (t.isPaid) paidIncome += t.amountCents;
      } else {
        expense += t.amountCents;
        if (t.isPaid) paidExpense += t.amountCents;
        else pendingExpense += t.amountCents;
      }
    }
    return { income, paidIncome, expense, paidExpense, pendingExpense };
  }, [filtered]);

  const pendingAll = useMemo(
    () => monthTxns.reduce((s, t) => (t.type === "expense" && !t.isPaid ? s + t.amountCents : s), 0),
    [monthTxns],
  );

  const extraFilters = (typeFilter !== "all" ? 1 : 0) + (catFilter !== "all" ? 1 : 0);
  const hasFilters = query !== "" || statusFilter !== "all" || extraFilters > 0;

  const clearFilters = () => {
    setQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setCatFilter("all");
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      await onImportRecurring();
    } finally {
      setImporting(false);
    }
  };

  const toggle = async (t: TransactionDTO) => {
    setToggling(t.id);
    await onTogglePaid(t.id, t.isPaid);
    setToggling(null);
  };

  const net = totals.income - totals.expense;

  const stats = [
    { label: "Entradas", value: fmt(totals.income), tone: "text-accent", sub: `${fmt(totals.paidIncome)} recebidas` },
    { label: "Saídas", value: fmt(totals.expense), tone: "text-negative", sub: `${fmt(totals.paidExpense)} pagas` },
    {
      label: "Saldo",
      value: fmt(net),
      tone: net >= 0 ? "text-accent" : "text-negative",
      sub: `${fmt(totals.paidIncome - totals.paidExpense)} realizado`,
    },
  ];

  return (
    <div className="space-y-4">
      {/* importar fixos */}
      {missing.items.length > 0 && (
        <div className="flex items-center gap-3 rounded-[20px] border border-accent/30 bg-accent/[0.07] p-3.5 sm:p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-ink">
            <Repeat2 size={19} strokeWidth={2.3} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-snug text-fg">Fixos prontos para importar</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-fg-muted">
              {describeCounts(missing.expenses, missing.incomes)} para {monthName}.
            </p>
          </div>
          <button type="button" disabled={importing} onClick={() => void handleImport()} className="btn btn-primary shrink-0 px-3.5">
            {importing && <LoaderCircle size={15} className="animate-spin" />}
            {importing ? "Importando" : "Importar"}
          </button>
        </div>
      )}

      {/* resumo */}
      <section aria-label="Resumo do mês" className="card overflow-clip">
        <dl className="grid grid-cols-3 divide-x divide-line">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0 px-3 py-3.5 sm:px-5 sm:py-4">
              <dt className="eyebrow truncate tracking-[0.1em] xs:tracking-[0.16em]">{s.label}</dt>
              <dd className={`mt-1.5 truncate font-display text-[clamp(0.9rem,4.1vw,1.25rem)] leading-none font-semibold tabular-nums ${s.tone}`}>
                {s.value}
              </dd>
              <dd className="mt-1.5 hidden truncate text-[12px] text-fg-subtle sm:block">{s.sub}</dd>
            </div>
          ))}
        </dl>
        {pendingAll > 0 && (
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
            aria-pressed={statusFilter === "pending"}
            className="flex min-h-11 w-full items-center justify-between gap-2 border-t border-line bg-warning/[0.07] px-3.5 text-left text-[13px] transition-colors hover:bg-warning/[0.11] sm:px-5"
          >
            <span className="flex items-center gap-2 font-medium text-warning">
              <Clock size={15} />
              {pendingCount} {pendingCount === 1 ? "conta pendente" : "contas pendentes"}
            </span>
            <span className="font-display font-semibold text-warning tabular-nums">{fmt(pendingAll)}</span>
          </button>
        )}
      </section>

      {/* filtros */}
      <section aria-label="Filtros" className="card space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-[calc(100%-3.25rem)] sm:basis-60">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-subtle" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar transações"
              aria-label="Buscar transações"
              enterKeyHint="search"
              className="field pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="absolute top-1/2 right-1 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-fg-subtle hover:text-fg"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="filtros-extras"
            aria-label={extraFilters ? `Mais filtros (${extraFilters} ativos)` : "Mais filtros"}
            className={`icon-btn relative border sm:hidden ${showFilters ? "border-accent/50 bg-accent/10 text-accent" : "border-line-strong"}`}
          >
            <SlidersHorizontal size={18} />
            {extraFilters > 0 && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-accent" />}
          </button>
          <div id="filtros-extras" className={`${showFilters ? "flex" : "hidden"} w-full gap-2 sm:flex sm:w-auto`}>
            <div className="relative min-w-0 flex-1 sm:w-[168px] sm:flex-none">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as "all" | TxnType)}
                aria-label="Tipo"
                className="field"
              >
                <option value="all">Todos os tipos</option>
                <option value="income">Receitas</option>
                <option value="expense">Despesas</option>
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-subtle" />
            </div>
            <div className="relative min-w-0 flex-1 sm:w-[220px] sm:flex-none">
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="Categoria" className="field">
                <option value="all">Todas as categorias</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-subtle" />
            </div>
          </div>
        </div>

        <div role="radiogroup" aria-label="Status" className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          {(
            [
              { id: "all", label: "Todas" },
              { id: "pending", label: "Pendentes", count: pendingCount },
              { id: "paid", label: "Pagas" },
              { id: "recurring", label: "Fixas" },
            ] as const
          ).map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold transition-colors ${
                  active
                    ? "border-transparent bg-primary text-ink"
                    : "border-line bg-fg/[0.03] text-fg-muted hover:border-line-strong hover:text-fg"
                }`}
              >
                {tab.label}
                {"count" in tab && tab.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
                      active ? "bg-ink/15 text-ink" : "bg-warning/15 text-warning"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-fg-muted transition-colors hover:bg-fg/[0.05] hover:text-fg"
            >
              <X size={14} /> Limpar
            </button>
          )}
        </div>
      </section>

      {/* lista */}
      {monthTxns.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ReceiptText size={20} />}
            title={`Nenhuma transação em ${monthName}`}
            description={
              missing.items.length > 0
                ? "Comece importando seus lançamentos fixos ou registre uma nova transação."
                : "Registre a primeira receita ou despesa do mês."
            }
            action={
              <>
                <button type="button" onClick={onNew} className="btn btn-primary">
                  <Plus size={15} strokeWidth={2.6} /> Nova transação
                </button>
                {missing.items.length > 0 && (
                  <button type="button" onClick={() => void handleImport()} disabled={importing} className="btn btn-secondary">
                    <Repeat2 size={15} /> Importar fixos
                  </button>
                )}
              </>
            }
          />
        </div>
      ) : groups.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<SearchX size={20} />}
            title="Nada encontrado"
            description="Nenhuma transação do mês corresponde a esses filtros."
            action={
              <button type="button" onClick={clearFilters} className="btn btn-secondary">
                <X size={15} /> Limpar filtros
              </button>
            }
          />
        </div>
      ) : (
        <>
          <p className="px-1 text-[13px] text-fg-muted" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? "transação" : "transações"}
            {hasFilters ? " com os filtros atuais" : ` em ${monthName}`}
          </p>
          <div className="card overflow-clip">
            {groups.map(([date, items]) => {
              const dayNet = items.reduce((s, t) => s + (t.type === "income" ? t.amountCents : -t.amountCents), 0);
              return (
                <section key={date} aria-label={fullDayLabel(date)}>
                  <div className="sticky top-[calc(var(--topbar-h)+var(--safe-t))] z-10 flex items-baseline justify-between gap-3 border-b border-line bg-surface px-4 py-2 sm:px-5 lg:top-0">
                    <h3 className="truncate text-[12px] font-semibold tracking-[0.06em] text-fg-muted uppercase">{fullDayLabel(date)}</h3>
                    <p className={`shrink-0 font-display text-[12.5px] font-medium tabular-nums ${dayNet >= 0 ? "text-accent" : "text-negative"}`}>
                      {signedNet(dayNet)}
                    </p>
                  </div>
                  <ul>
                    <AnimatePresence initial={false}>
                      {items.map((t) => (
                        <motion.li
                          key={t.id}
                          layout="position"
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22 }}
                          className={`group flex items-center gap-1.5 border-b border-line pr-2 pl-2.5 last:border-0 sm:pr-3 sm:pl-3.5 ${
                            !t.isPaid && t.type === "expense" ? "bg-warning/[0.035]" : ""
                          }`}
                        >
                          <PaidToggle
                            paid={t.isPaid}
                            kind={t.type}
                            label={t.description}
                            busy={toggling === t.id}
                            onToggle={() => void toggle(t)}
                          />
                          <button
                            type="button"
                            onClick={() => onEdit(t)}
                            className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left"
                          >
                            <CategoryIcon icon={t.category.icon} color={t.category.color} chip={38} />
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 text-[14px] leading-snug font-medium break-words text-fg">{t.description}</span>
                              <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-fg-subtle">
                                <span className="truncate">{t.category.name}</span>
                                {t.installmentTotal ? (
                                  <span className="chip bg-fg/[0.06] text-fg-muted">
                                    {t.installmentNumber}/{t.installmentTotal}
                                  </span>
                                ) : null}
                                {t.isRecurring && (
                                  <span className="chip bg-accent/12 text-accent">
                                    <Repeat2 size={11} /> fixa
                                  </span>
                                )}
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span
                                className={`block font-display text-[14px] font-semibold whitespace-nowrap tabular-nums ${
                                  t.type === "income" ? "text-accent" : t.isPaid ? "text-fg" : "text-warning"
                                }`}
                              >
                                {fmtSigned(t.amountCents, t.type)}
                              </span>
                              <span className={`block text-[11.5px] ${t.isPaid ? "text-fg-subtle" : "font-medium text-warning"}`}>
                                {statusLabel(t)}
                              </span>
                            </span>
                          </button>
                          <div className="hover-reveal hidden items-center transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 sm:flex [@media(hover:hover)]:opacity-0">
                            <button
                              type="button"
                              onClick={() => onEdit(t)}
                              aria-label={`Editar ${t.description}`}
                              className="icon-btn h-9 w-9"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(t)}
                              aria-label={`Excluir ${t.description}`}
                              className="icon-btn h-9 w-9 hover:!bg-negative/10 hover:!text-negative"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </section>
              );
            })}
          </div>
          {filtered.length > count && (
            <button
              type="button"
              onClick={() => setShown({ signature, count: count + PAGE })}
              className="btn btn-secondary w-full"
            >
              <ChevronDown size={16} /> Mostrar mais {Math.min(PAGE, filtered.length - count)}
              <span className="font-normal text-fg-subtle">
                ({count} de {filtered.length})
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
});
