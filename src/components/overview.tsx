"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  LineChart,
  ListChecks,
  LoaderCircle,
  Pencil,
  PieChart,
  Plus,
  ReceiptText,
  Repeat2,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { memo, useMemo, useState, type ReactNode } from "react";
import {
  centsToInput,
  dayLabel,
  fmt,
  fmtSigned,
  formatCurrencyInput,
  keyFromISO,
  monthKey,
  monthLabel,
  parseAmount,
  pct,
  shiftMonth,
  shortMonthLabel,
} from "@/lib/format";
import { CategoryIcon } from "@/lib/icons";
import { useLightMotion } from "@/lib/motion";
import type { BudgetDTO, FinanceData, GoalDTO, TransactionDTO } from "@/lib/types";
import { describeCounts, useMissingRecurring } from "@/lib/use-missing-recurring";
import { Donut, FlowChart, Money, Percent, ProgressRing, Sparkline, type DonutSlice, type FlowPoint } from "./charts";
import type { ManageTab } from "./manage-view";
import { useToast } from "./toast";
import { EmptyState, PaidToggle } from "./ui";

/* ------------------------------ primitives ------------------------------ */

function Item({ i, children, className, id }: { i: number; children: ReactNode; className?: string; id?: string }) {
  const light = useLightMotion();
  const step = light ? 0.035 : 0.07;
  // Teto no índice: a partir do 5º card o atraso para de crescer, senão o
  // último card só começa a animar 0.6s depois — com todas as camadas vivas.
  const delay = Math.max(0, 0.05 + Math.min(i, 4) * step);
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: light ? 10 : 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: light ? 0.32 : 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function CardHeader({ id, title, sub, right }: { id?: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 sm:mb-5">
      <div className="min-w-0">
        <h2 id={id} className="font-display text-[16px] font-semibold tracking-tight text-fg">
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-[12.5px] text-fg-subtle">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/* --------------------------------- main --------------------------------- */

export const Overview = memo(function Overview({
  data,
  month,
  onEdit,
  onNew,
  onSeeAll,
  onManage,
  onTogglePaid,
  onEditBudget,
  onDepositGoal,
  onImportRecurring,
}: {
  data: FinanceData;
  month: { y: number; m: number };
  onEdit: (t: TransactionDTO) => void;
  onNew: () => void;
  onSeeAll: () => void;
  onManage: (tab: ManageTab) => void;
  onTogglePaid: (id: number, currentPaid: boolean) => Promise<void>;
  onEditBudget: (b: BudgetDTO, amountCents: number) => Promise<boolean>;
  onDepositGoal: (id: number, addCents: number) => Promise<boolean>;
  onImportRecurring: () => Promise<void>;
}) {
  const key = monthKey(month.y, month.m);
  const light = useLightMotion();
  const toast = useToast();
  const [activeSlice, setActiveSlice] = useState<string | null>(null);
  const [editBudgetId, setEditBudgetId] = useState<number | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [depositId, setDepositId] = useState<number | null>(null);
  const [depositInput, setDepositInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [billsExpanded, setBillsExpanded] = useState(false);

  const catById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const missing = useMissingRecurring(data.transactions, key);
  const monthName = monthLabel(month.y, month.m).toLowerCase();

  const m = useMemo(() => {
    const prev = shiftMonth(month.y, month.m, -1);
    const prevKey = monthKey(prev.y, prev.m);

    const last6Keys: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = shiftMonth(month.y, month.m, -i);
      last6Keys.push({ key: monthKey(d.y, d.m), label: shortMonthLabel(d.y, d.m) });
    }
    const last6Map = new Map<string, { income: number; expense: number }>();
    for (const item of last6Keys) last6Map.set(item.key, { income: 0, expense: 0 });

    const monthTxns: TransactionDTO[] = [];
    let income = 0;
    let expense = 0;
    let paidIncome = 0;
    let pendingIncome = 0;
    let paidExpense = 0;
    let pendingExpense = 0;
    let prevIncome = 0;
    let prevExpense = 0;
    let realizedBalance = 0;
    const realizedNetByKey = new Map<string, number>();
    const spendByCat = new Map<number, number>();

    // uma única passada por todas as transações — O(N)
    for (const t of data.transactions) {
      const tKey = keyFromISO(t.date);

      const flowSlot = last6Map.get(tKey);
      if (flowSlot) {
        if (t.type === "income") flowSlot.income += t.amountCents;
        else flowSlot.expense += t.amountCents;
      }

      if (t.isPaid) {
        const net = t.type === "income" ? t.amountCents : -t.amountCents;
        realizedNetByKey.set(tKey, (realizedNetByKey.get(tKey) ?? 0) + net);
        if (tKey <= key) realizedBalance += net;
      }

      if (tKey === prevKey) {
        if (t.type === "income") prevIncome += t.amountCents;
        else prevExpense += t.amountCents;
      }

      if (tKey === key) {
        monthTxns.push(t);
        if (t.type === "income") {
          income += t.amountCents;
          if (t.isPaid) paidIncome += t.amountCents;
          else pendingIncome += t.amountCents;
        } else {
          expense += t.amountCents;
          spendByCat.set(t.categoryId, (spendByCat.get(t.categoryId) ?? 0) + t.amountCents);
          if (t.isPaid) paidExpense += t.amountCents;
          else pendingExpense += t.amountCents;
        }
      }
    }

    const projectedBalance = realizedBalance + (pendingIncome - pendingExpense);

    const balanceSeries: number[] = [];
    let rolling = 0;
    for (let i = 11; i >= 0; i--) {
      const d = shiftMonth(month.y, month.m, -i);
      rolling += realizedNetByKey.get(monthKey(d.y, d.m)) ?? 0;
      if (i < 6) balanceSeries.push(rolling);
    }

    const flow: FlowPoint[] = last6Keys.map((item) => {
      const val = last6Map.get(item.key) ?? { income: 0, expense: 0 };
      return { label: item.label, income: val.income, expense: val.expense };
    });

    const sorted = [...spendByCat.entries()].sort((a, b) => b[1] - a[1]);

    // contas do mês: fixas + qualquer despesa ainda não paga; pendentes primeiro
    const bills = monthTxns
      .filter((t) => t.type === "expense" && (t.isRecurring || !t.isPaid))
      .sort((a, b) => (a.isPaid !== b.isPaid ? (a.isPaid ? 1 : -1) : a.date.localeCompare(b.date)));

    return {
      monthTxns,
      income,
      expense,
      paidIncome,
      pendingIncome,
      paidExpense,
      pendingExpense,
      prevIncome,
      prevExpense,
      realizedBalance,
      projectedBalance,
      flow,
      balanceSeries,
      spendByCat,
      sorted,
      bills,
      billsPaidCount: bills.filter((t) => t.isPaid).length,
    };
  }, [data.transactions, key, month]);

  const saved = Math.max(0, m.income - m.expense);
  const savingsRate = m.income > 0 ? Math.max(0, ((m.income - m.expense) / m.income) * 100) : 0;

  const slices: DonutSlice[] = useMemo(() => {
    const base = m.sorted.slice(0, 6).map(([catId, value]) => {
      const c = catById.get(catId);
      return { id: String(catId), label: c?.name ?? "—", value, color: c?.color ?? "#888888" };
    });
    const rest = m.sorted.slice(6).reduce((s, [, v]) => s + v, 0);
    if (rest > 0) base.push({ id: "outros", label: "Outros", value: rest, color: "var(--fg-subtle)" });
    return base;
  }, [m.sorted, catById]);

  const recent = m.monthTxns.slice(0, 6);
  const billsShown = m.bills.slice(0, billsExpanded ? m.bills.length : 8);
  const billsProgress = m.bills.length > 0 ? m.billsPaidCount / m.bills.length : 0;

  const handleImport = async () => {
    setImporting(true);
    try {
      await onImportRecurring();
    } finally {
      setImporting(false);
    }
  };

  const submitBudget = async (b: BudgetDTO) => {
    const cents = parseAmount(budgetInput);
    if (!cents) return;
    setBusy(true);
    const ok = await onEditBudget(b, cents);
    setBusy(false);
    if (ok) {
      setEditBudgetId(null);
      setBudgetInput("");
    }
  };

  const submitDeposit = async (goal: GoalDTO, value?: number) => {
    const cents = value ?? parseAmount(depositInput);
    if (!cents) return;
    setBusy(true);
    const ok = await onDepositGoal(goal.id, cents);
    setBusy(false);
    if (ok) {
      setDepositInput("");
      setDepositId(null);
      toast.show({ tone: "success", title: `${fmt(cents, cents % 100 !== 0)} guardados`, description: goal.name });
    }
  };

  const toggle = async (t: TransactionDTO) => {
    setTogglingId(t.id);
    await onTogglePaid(t.id, t.isPaid);
    setTogglingId(null);
  };

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* --------------------------- importar fixos --------------------------- */}
      {missing.items.length > 0 && (
        <Item i={0}>
          <div className="flex items-center gap-3 rounded-[20px] border border-accent/30 bg-accent/[0.07] p-3.5 sm:p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-ink">
              <Repeat2 size={19} strokeWidth={2.3} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-snug text-fg">
                {missing.items.length === 1 ? "1 lançamento fixo" : `${missing.items.length} lançamentos fixos`} para{" "}
                {monthName}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-fg-muted">
                {describeCounts(missing.expenses, missing.incomes)} ainda não {missing.items.length === 1 ? "lançada" : "lançadas"}{" "}
                neste mês.
              </p>
            </div>
            <button
              type="button"
              disabled={importing}
              onClick={() => void handleImport()}
              className="btn btn-primary shrink-0 px-3.5"
            >
              {importing ? <LoaderCircle size={15} className="animate-spin" /> : null}
              {importing ? "Importando" : "Importar"}
            </button>
          </div>
        </Item>
      )}

      {/* ------------------------------ indicadores ----------------------------- */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        <Item i={0} className="col-span-2 xl:col-span-1">
          <div className="relative h-full overflow-hidden rounded-[clamp(18px,4vw,22px)] bg-[linear-gradient(140deg,#cdf96f,#a9e22c)] p-[clamp(1rem,3.6vw,1.5rem)] text-ink shadow-glow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] text-ink/70 uppercase">Saldo em caixa</p>
                <p className="mt-0.5 text-[12px] font-medium text-ink/60">realizado em conta</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink/10">
                <Wallet size={17} strokeWidth={2.2} />
              </span>
            </div>
            <p className="mt-3 font-display text-[clamp(1.9rem,9vw,2.4rem)] leading-none font-semibold tracking-tight">
              <Money cents={m.realizedBalance} />
            </p>
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-ink/[0.08] px-3 py-1.5 text-[12px] font-semibold text-ink/80">
              <span>
                <span className="xl:hidden 2xl:inline">Previsto no fim do mês</span>
                <span className="hidden xl:inline 2xl:hidden">Previsão do mês</span>
              </span>
              <span className="font-bold tabular-nums">{fmt(m.projectedBalance)}</span>
            </div>
            {m.balanceSeries.some((v) => v !== 0) && (
              <div className="mt-2 -mb-1">
                <Sparkline values={m.balanceSeries} color="#233309" height={38} />
              </div>
            )}
          </div>
        </Item>

        <Item i={1}>
          <div className="card card-pad h-full">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">Receitas</p>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent">
                <TrendingUp size={15} strokeWidth={2.2} />
              </span>
            </div>
            <p className="mt-3 font-display text-[clamp(1.15rem,5.4vw,1.9rem)] leading-none font-semibold tracking-tight text-fg">
              <Money cents={m.income} />
            </p>
            <div className="mt-2.5 space-y-0.5 text-[12px] leading-snug 2xl:flex 2xl:items-center 2xl:justify-between 2xl:space-y-0">
              <p className="text-fg-muted">
                <span className="font-medium text-accent">{fmt(m.paidIncome)}</span> recebidas
              </p>
              {m.pendingIncome > 0 ? (
                <p className="font-medium text-warning">{fmt(m.pendingIncome)} a receber</p>
              ) : (
                <p className="text-fg-subtle">tudo recebido</p>
              )}
            </div>
          </div>
        </Item>

        <Item i={2}>
          <div className="card card-pad h-full">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">Despesas</p>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-negative/12 text-negative">
                <TrendingDown size={15} strokeWidth={2.2} />
              </span>
            </div>
            <p className="mt-3 font-display text-[clamp(1.15rem,5.4vw,1.9rem)] leading-none font-semibold tracking-tight text-fg">
              <Money cents={m.expense} />
            </p>
            <div className="mt-2.5 space-y-0.5 text-[12px] leading-snug 2xl:flex 2xl:items-center 2xl:justify-between 2xl:space-y-0">
              <p className="text-fg-muted">
                <span className="font-medium text-fg">{fmt(m.paidExpense)}</span> pagas
              </p>
              {m.pendingExpense > 0 ? (
                <p className="font-medium text-warning">{fmt(m.pendingExpense)} pendente</p>
              ) : (
                <p className="text-fg-subtle">tudo pago</p>
              )}
            </div>
          </div>
        </Item>

        <Item i={3} className="col-span-2 xl:col-span-1">
          <div className="card card-pad flex h-full items-center gap-4 xl:gap-3.5">
            <div className="relative grid shrink-0 place-items-center">
              <ProgressRing value={savingsRate / 100} size={64} stroke={7} delay={light ? 0.14 : 0.3} />
              <span className="absolute font-display text-[14px] font-semibold text-fg">
                <Percent value={savingsRate} />
              </span>
            </div>
            <div className="min-w-0">
              <p className="eyebrow">Poupança</p>
              <p className="mt-1.5 font-display text-[15px] leading-snug font-medium text-fg">{fmt(saved)} guardados</p>
              <p className="mt-0.5 text-[12px] leading-snug text-fg-subtle">
                {m.income === 0
                  ? "Sem receitas lançadas no mês."
                  : savingsRate >= 20
                    ? "Ótimo ritmo: acima de 20% da renda."
                    : savingsRate > 0
                      ? "Referência saudável: 20% da renda."
                      : "As despesas superam as receitas."}
              </p>
            </div>
          </div>
        </Item>
      </div>

      {/* ------------------------------ contas do mês ----------------------------- */}
      {m.bills.length > 0 && (
        <Item i={4}>
          <section aria-labelledby="bills-title" className="card card-pad">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent">
                  <CheckCircle2 size={19} strokeWidth={2.3} />
                </span>
                <div className="min-w-0">
                  <h2 id="bills-title" className="font-display text-[16px] font-semibold tracking-tight text-fg">
                    Contas do mês
                  </h2>
                  <p className="text-[12.5px] text-fg-muted">
                    {m.billsPaidCount} de {m.bills.length} pagas
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11.5px] text-fg-subtle">Falta pagar</p>
                <p
                  className={`font-display text-[16px] font-bold tabular-nums ${m.pendingExpense > 0 ? "text-warning" : "text-accent"}`}
                >
                  {fmt(m.pendingExpense)}
                </p>
              </div>
            </div>

            <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-fg/[0.08]">
              <motion.div
                className="h-full w-full origin-left rounded-full bg-accent"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: billsProgress }}
                transition={{ duration: light ? 0.5 : 0.8, ease: "easeOut" }}
              />
            </div>

            <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {billsShown.map((bill, index) => (
                <li key={bill.id} className={!billsExpanded && index >= 5 ? "max-sm:hidden" : undefined}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={bill.isPaid}
                    aria-label={`${bill.description}, ${fmt(bill.amountCents, true)}, ${bill.isPaid ? "paga" : "pendente"}`}
                    disabled={togglingId === bill.id}
                    onClick={() => void toggle(bill)}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                      bill.isPaid
                        ? "border-line bg-fg/[0.02] hover:bg-fg/[0.04]"
                        : "border-warning/35 bg-warning/[0.06] hover:border-warning/60"
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg transition-colors ${
                        bill.isPaid ? "bg-primary text-ink" : "border-2 border-warning/80"
                      }`}
                    >
                      {bill.isPaid && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[13.5px] font-medium ${bill.isPaid ? "text-fg-subtle line-through" : "text-fg"}`}
                      >
                        {bill.description}
                      </span>
                      <span className="block truncate text-[12px] text-fg-subtle">
                        Dia {bill.date.split("-")[2]} · {bill.category.name}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-display text-[13.5px] font-semibold tabular-nums ${bill.isPaid ? "text-fg-subtle" : "text-fg"}`}
                    >
                      {fmt(bill.amountCents)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {m.bills.length > 5 && !billsExpanded ? (
                <button
                  type="button"
                  onClick={() => setBillsExpanded(true)}
                  className="btn btn-ghost -ml-2 px-2 sm:hidden"
                >
                  <ChevronDown size={16} /> Mostrar mais {m.bills.length - 5}
                </button>
              ) : (
                <span className="sm:hidden" />
              )}
              {m.bills.length > 8 && !billsExpanded && (
                <button
                  type="button"
                  onClick={() => setBillsExpanded(true)}
                  className="btn btn-ghost -ml-2 hidden px-2 sm:inline-flex"
                >
                  <ChevronDown size={16} /> Mostrar todas ({m.bills.length})
                </button>
              )}
              <button type="button" onClick={onSeeAll} className="btn btn-ghost -mr-2 ml-auto px-2 text-accent hover:text-accent">
                Ver no extrato <ArrowRight size={15} />
              </button>
            </div>
          </section>
        </Item>
      )}

      {/* --------------------------- fluxo + categorias -------------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr] lg:gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Item i={5} id="fluxo">
          <section aria-labelledby="flow-title" className="card card-pad flex h-full flex-col">
            <CardHeader
              id="flow-title"
              title="Fluxo de caixa"
              sub="Receitas e despesas dos últimos 6 meses"
              right={
                <div className="flex items-center gap-3.5 text-[12px] text-fg-muted" aria-hidden>
                  <span className="flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full bg-accent" /> Receitas
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full bg-negative" /> Despesas
                  </span>
                </div>
              }
            />
            {m.flow.every((p) => p.income === 0 && p.expense === 0) ? (
              <EmptyState
                compact
                icon={<LineChart size={20} />}
                title="Sem movimentações recentes"
                description="O gráfico aparece assim que houver receitas ou despesas nos últimos 6 meses."
              />
            ) : (
              <FlowChart data={m.flow} seriesKey={key} fill />
            )}
          </section>
        </Item>

        <Item i={6} id="categorias">
          <section aria-labelledby="cat-title" className="card card-pad flex h-full flex-col">
            <CardHeader id="cat-title" title="Despesas por categoria" sub={`Distribuição em ${monthName}`} />
            {slices.length === 0 ? (
              <EmptyState
                compact
                icon={<PieChart size={20} />}
                title="Nenhuma despesa no mês"
                description="Quando houver gastos, a divisão por categoria aparece aqui."
              />
            ) : (
              <div className="flex flex-1 flex-col items-center gap-5 sm:flex-row lg:flex-col 2xl:flex-row">
                <Donut slices={slices} total={m.expense} active={activeSlice} onActive={setActiveSlice} size={188} />
                <ul className="w-full min-w-0 flex-1 space-y-0.5">
                  {slices.map((s) => {
                    const share = m.expense > 0 ? Math.round((s.value / m.expense) * 100) : 0;
                    const active = activeSlice === s.id;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onMouseEnter={() => setActiveSlice(s.id)}
                          onMouseLeave={() => setActiveSlice(null)}
                          onClick={() => setActiveSlice(active ? null : s.id)}
                          className={`flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2.5 text-left transition-colors ${
                            active ? "bg-fg/[0.06]" : "hover:bg-fg/[0.04]"
                          }`}
                        >
                          <i className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: s.color }} />
                          <span className="min-w-0 flex-1 truncate text-[13px] text-fg-muted">{s.label}</span>
                          <span className="text-[12px] text-fg-subtle tabular-nums">{share}%</span>
                          <span className="min-w-[68px] shrink-0 text-right font-display text-[13px] font-medium text-fg tabular-nums">
                            {fmt(s.value)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </Item>
      </div>

      {/* --------------------- orçamentos + metas + recentes --------------------- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5 xl:grid-cols-3">
        <Item i={7} id="orcamentos">
          <section aria-labelledby="budget-title" className="card card-pad h-full">
            <CardHeader
              id="budget-title"
              title="Orçamentos"
              sub="Limites mensais por categoria"
              right={
                data.budgets.length > 0 ? (
                  <button type="button" onClick={() => onManage("orcamentos")} className="btn btn-ghost -mt-2 -mr-2 min-h-10 px-2.5">
                    <Plus size={15} /> Novo
                  </button>
                ) : undefined
              }
            />
            {data.budgets.length === 0 ? (
              <EmptyState
                compact
                icon={<ListChecks size={20} />}
                title="Nenhum orçamento ainda"
                description="Defina um limite por categoria e acompanhe quanto ainda pode gastar."
                action={
                  <button type="button" onClick={() => onManage("orcamentos")} className="btn btn-secondary">
                    <Plus size={15} /> Criar orçamento
                  </button>
                }
              />
            ) : (
              <ul className="space-y-4">
                {data.budgets.map((b) => {
                  const cat = catById.get(b.categoryId);
                  if (!cat) return null;
                  const spent = m.spendByCat.get(b.categoryId) ?? 0;
                  const used = pct(spent, b.amountCents);
                  const over = spent > b.amountCents;
                  const warn = !over && used >= 80;

                  if (editBudgetId === b.id)
                    return (
                      <li key={b.id} className="flex items-center gap-2">
                        <CategoryIcon icon={cat.icon} color={cat.color} />
                        <input
                          autoFocus
                          inputMode="numeric"
                          aria-label={`Novo limite para ${cat.name}`}
                          value={budgetInput}
                          onChange={(e) => setBudgetInput(formatCurrencyInput(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void submitBudget(b);
                            if (e.key === "Escape") setEditBudgetId(null);
                          }}
                          placeholder="Novo limite"
                          className="field min-w-0"
                        />
                        <button
                          type="button"
                          onClick={() => void submitBudget(b)}
                          disabled={busy || !parseAmount(budgetInput)}
                          className="btn btn-primary h-11 w-11 shrink-0 p-0"
                          aria-label="Salvar limite"
                        >
                          <Check size={16} strokeWidth={2.6} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditBudgetId(null)}
                          className="icon-btn border border-line"
                          aria-label="Cancelar"
                        >
                          <X size={16} />
                        </button>
                      </li>
                    );

                  return (
                    <li key={b.id} className="group flex items-center gap-3">
                      <CategoryIcon icon={cat.icon} color={cat.color} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="min-w-0 truncate text-[13.5px] font-medium text-fg">{cat.name}</p>
                          <p
                            className={`shrink-0 font-display text-[12.5px] font-semibold tabular-nums ${
                              over ? "text-negative" : warn ? "text-warning" : "text-fg-muted"
                            }`}
                          >
                            {used}%
                          </p>
                        </div>
                        <div
                          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fg/[0.08]"
                          role="progressbar"
                          aria-label={`Orçamento de ${cat.name}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.min(100, used)}
                        >
                          <motion.div
                            className={`h-full w-full origin-left rounded-full ${over ? "bg-negative" : warn ? "bg-warning" : "bg-accent"}`}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: Math.min(100, used) / 100 }}
                            transition={{ duration: light ? 0.5 : 0.9, delay: light ? 0.12 : 0.3, ease: "easeOut" }}
                          />
                        </div>
                        <div className="mt-1 flex items-baseline justify-between gap-2 text-[12px]">
                          <span className="min-w-0 truncate font-display text-fg-muted tabular-nums">
                            {fmt(spent)} <span className="text-fg-subtle">de {fmt(b.amountCents)}</span>
                          </span>
                          <span className={`shrink-0 ${over ? "font-medium text-negative" : warn ? "text-warning" : "text-fg-subtle"}`}>
                            {over ? `${fmt(spent - b.amountCents)} acima` : `restam ${fmt(b.amountCents - spent)}`}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditBudgetId(b.id);
                          setBudgetInput(centsToInput(b.amountCents));
                        }}
                        className="hover-reveal icon-btn -mr-2 h-10 w-10 self-start transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0"
                        aria-label={`Editar limite de ${cat.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </Item>

        <Item i={8} id="metas">
          <section aria-labelledby="goals-title" className="card card-pad h-full">
            <CardHeader
              id="goals-title"
              title="Metas"
              sub="Por que você está juntando"
              right={
                data.goals.length > 0 ? (
                  <button type="button" onClick={() => onManage("metas")} className="btn btn-ghost -mt-2 -mr-2 min-h-10 px-2.5">
                    <Plus size={15} /> Nova
                  </button>
                ) : undefined
              }
            />
            {data.goals.length === 0 ? (
              <EmptyState
                compact
                icon={<Target size={20} />}
                title="Nenhuma meta criada"
                description="Uma viagem, a reserva de emergência, um carro: crie metas e registre aportes."
                action={
                  <button type="button" onClick={() => onManage("metas")} className="btn btn-secondary">
                    <Plus size={15} /> Criar meta
                  </button>
                }
              />
            ) : (
              <ul className="space-y-5">
                {data.goals.map((g, gi) => {
                  const p = g.targetCents > 0 ? g.currentCents / g.targetCents : 0;
                  const open = depositId === g.id;
                  const done = g.currentCents >= g.targetCents;
                  return (
                    <li key={g.id}>
                      <div className="flex items-center gap-3.5">
                        <div className="relative grid shrink-0 place-items-center">
                          <ProgressRing
                            value={p}
                            size={60}
                            stroke={6}
                            color={g.color}
                            delay={Math.min(0.25 + gi * 0.1, light ? 0.35 : 0.65)}
                          />
                          <span className="absolute font-display text-[11.5px] font-semibold text-fg">{Math.round(p * 100)}%</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-fg">{g.name}</p>
                          <p className="mt-0.5 font-display text-[12.5px] text-fg-muted tabular-nums">
                            {fmt(g.currentCents)} <span className="text-fg-subtle">de {fmt(g.targetCents)}</span>
                          </p>
                          <p className={`mt-0.5 text-[12px] ${done ? "font-medium text-accent" : "text-fg-subtle"}`}>
                            {done ? "Meta alcançada" : `Faltam ${fmt(g.targetCents - g.currentCents)}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDepositId(open ? null : g.id);
                            setDepositInput("");
                          }}
                          aria-expanded={open}
                          className={`icon-btn border ${open ? "border-accent/50 bg-accent/10 text-accent" : "border-line"}`}
                          aria-label={open ? `Fechar aporte em ${g.name}` : `Fazer aporte em ${g.name}`}
                        >
                          {open ? <X size={16} /> : <Plus size={16} strokeWidth={2.4} />}
                        </button>
                      </div>
                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: light ? 0.2 : 0.28, ease: "easeOut" }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 rounded-2xl border border-line bg-fg/[0.02] p-2.5">
                              <p className="mb-2 px-0.5 text-[12px] text-fg-subtle">Quanto você guardou?</p>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[10000, 50000, 100000].map((v) => (
                                  <button
                                    key={v}
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void submitDeposit(g, v)}
                                    className="btn btn-secondary min-h-11 px-1 text-[12.5px]"
                                  >
                                    +{fmt(v)}
                                  </button>
                                ))}
                              </div>
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <input
                                  inputMode="numeric"
                                  aria-label={`Outro valor para ${g.name}`}
                                  placeholder="Outro valor"
                                  value={depositInput}
                                  onChange={(e) => setDepositInput(formatCurrencyInput(e.target.value))}
                                  onKeyDown={(e) => e.key === "Enter" && void submitDeposit(g)}
                                  className="field min-w-0"
                                />
                                <button
                                  type="button"
                                  disabled={busy || !parseAmount(depositInput)}
                                  onClick={() => void submitDeposit(g)}
                                  className="btn btn-primary h-11 w-11 shrink-0 p-0"
                                  aria-label="Confirmar aporte"
                                >
                                  {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={16} strokeWidth={2.6} />}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </Item>

        <Item i={9} id="recentes" className="md:col-span-2 xl:col-span-1">
          <section aria-labelledby="recent-title" className="card card-pad flex h-full flex-col">
            <CardHeader
              id="recent-title"
              title="Transações recentes"
              right={
                recent.length > 0 ? (
                  <button type="button" onClick={onSeeAll} className="btn btn-ghost -mt-2 -mr-2 min-h-10 px-2.5 text-accent hover:text-accent">
                    Ver todas <ArrowRight size={14} />
                  </button>
                ) : undefined
              }
            />
            {recent.length === 0 ? (
              <EmptyState
                compact
                icon={<ReceiptText size={20} />}
                title={`Nada lançado em ${monthName}`}
                description="Registre receitas e despesas para ver o mês tomar forma."
                action={
                  <button type="button" onClick={onNew} className="btn btn-primary">
                    <Plus size={15} strokeWidth={2.6} /> Nova transação
                  </button>
                }
              />
            ) : (
              <ul className="-mx-2 flex-1 space-y-0.5">
                {recent.map((t) => (
                  <li key={t.id} className="flex items-center gap-1 rounded-2xl pl-1 transition-colors hover:bg-fg/[0.04]">
                    <PaidToggle
                      paid={t.isPaid}
                      kind={t.type}
                      label={t.description}
                      busy={togglingId === t.id}
                      onToggle={() => void toggle(t)}
                    />
                    <button
                      type="button"
                      onClick={() => onEdit(t)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-2.5 pr-2 text-left"
                    >
                      <CategoryIcon icon={t.category.icon} color={t.category.color} chip={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-fg">{t.description}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-fg-subtle">
                          <span className="shrink-0">{dayLabel(t.date)}</span>
                          {t.isRecurring && <Repeat2 size={12} aria-label="fixa" className="shrink-0 text-accent" />}
                          <span aria-hidden>·</span>
                          <span className="truncate">{t.category.name}</span>
                        </span>
                      </span>
                      <span
                        className={`shrink-0 font-display text-[13.5px] font-medium whitespace-nowrap tabular-nums ${
                          t.type === "income" ? "text-accent" : t.isPaid ? "text-fg" : "text-warning"
                        }`}
                      >
                        {fmtSigned(t.amountCents, t.type)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Item>
      </div>
    </div>
  );
});
