"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Pencil,
  PiggyBank,
  Plus,
  Repeat2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  dayLabel,
  fmt,
  fmtSigned,
  keyFromISO,
  monthKey,
  parseAmount,
  pct,
  shiftMonth,
  shortMonthLabel,
} from "@/lib/format";
import { CategoryIcon } from "@/lib/icons";
import type { BudgetDTO, FinanceData, GoalDTO, TransactionDTO } from "@/lib/types";
import { Donut, FlowChart, Money, Percent, ProgressRing, Sparkline, type DonutSlice, type FlowPoint } from "./charts";

/* ------------------------------ primitives ------------------------------ */

function Item({ i, children, className, id }: { i: number; children: ReactNode; className?: string; id?: string }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.05 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function CardHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-[15.5px] font-semibold tracking-tight text-cream">{title}</h2>
        {sub && <p className="mt-0.5 text-[11.5px] text-faint">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Delta({ value, invert = false, suffix = "vs. mês anterior" }: { value: number | null; invert?: boolean; suffix?: string }) {
  if (value === null || !Number.isFinite(value))
    return <span className="text-[10.5px] text-faint">sem histórico</span>;
  const positive = value >= 0;
  const good = invert ? !positive : positive;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10.5px] font-semibold ${
        good ? "bg-accent/12 text-accent" : "bg-coral/12 text-coral"
      }`}
      title={suffix}
    >
      <Icon size={11} strokeWidth={2.6} />
      {`${positive ? "+" : ""}${Math.abs(value) >= 100 ? Math.round(value) : value.toFixed(0)}%`}
    </span>
  );
}

/* --------------------------------- main --------------------------------- */

export function Overview({
  data,
  month,
  onEdit,
  onSeeAll,
  onTogglePaid,
  onEditBudget,
  onDepositGoal,
}: {
  data: FinanceData;
  month: { y: number; m: number };
  onEdit: (t: TransactionDTO) => void;
  onSeeAll: () => void;
  onTogglePaid: (id: number, currentPaid: boolean) => Promise<void>;
  onEditBudget: (b: BudgetDTO, amountCents: number) => Promise<void>;
  onDepositGoal: (id: number, addCents: number) => Promise<void>;
}) {
  const key = monthKey(month.y, month.m);
  const [activeSlice, setActiveSlice] = useState<string | null>(null);
  const [editBudgetId, setEditBudgetId] = useState<number | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [depositId, setDepositId] = useState<number | null>(null);
  const [depositInput, setDepositInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const catById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);

  const m = useMemo(() => {
    const monthTxns = data.transactions.filter((t) => keyFromISO(t.date) === key);
    const income = monthTxns.reduce((s, t) => (t.type === "income" ? s + t.amountCents : s), 0);
    const expense = monthTxns.reduce((s, t) => (t.type === "expense" ? s + t.amountCents : s), 0);

    const paidExpense = monthTxns.reduce(
      (s, t) => (t.type === "expense" && t.isPaid ? s + t.amountCents : s),
      0,
    );
    const pendingExpense = monthTxns.reduce(
      (s, t) => (t.type === "expense" && !t.isPaid ? s + t.amountCents : s),
      0,
    );

    const prev = shiftMonth(month.y, month.m, -1);
    const prevKey = monthKey(prev.y, prev.m);
    const prevTxns = data.transactions.filter((t) => keyFromISO(t.date) === prevKey);
    const prevIncome = prevTxns.reduce((s, t) => (t.type === "income" ? s + t.amountCents : s), 0);
    const prevExpense = prevTxns.reduce((s, t) => (t.type === "expense" ? s + t.amountCents : s), 0);

    // balance & flow
    let balance = 0;
    const netByKey = new Map<string, number>();
    for (const t of data.transactions) {
      const k = keyFromISO(t.date);
      netByKey.set(k, (netByKey.get(k) ?? 0) + (t.type === "income" ? t.amountCents : -t.amountCents));
      if (k <= key) balance += t.type === "income" ? t.amountCents : -t.amountCents;
    }

    const flow: FlowPoint[] = [];
    const balanceSeries: number[] = [];
    const sumBy: (k: string, type: "income" | "expense") => number = (k, type) =>
      data.transactions
        .filter((t) => keyFromISO(t.date) === k && t.type === type)
        .reduce((s, t) => s + t.amountCents, 0);

    let rolling = 0;
    for (let i = 11; i >= 0; i--) {
      const d = shiftMonth(month.y, month.m, -i);
      rolling += netByKey.get(monthKey(d.y, d.m)) ?? 0;
      if (i < 6) balanceSeries.push(rolling);
    }
    for (let i = 5; i >= 0; i--) {
      const d = shiftMonth(month.y, month.m, -i);
      const k = monthKey(d.y, d.m);
      flow.push({ label: shortMonthLabel(d.y, d.m), income: sumBy(k, "income"), expense: sumBy(k, "expense") });
    }

    // category spend
    const spendByCat = new Map<number, number>();
    for (const t of monthTxns) {
      if (t.type !== "expense") continue;
      spendByCat.set(t.categoryId, (spendByCat.get(t.categoryId) ?? 0) + t.amountCents);
    }
    const sorted = [...spendByCat.entries()].sort((a, b) => b[1] - a[1]);

    // Fixed & pending bills checklist
    const bills = monthTxns
      .filter((t) => t.type === "expense" && (t.isRecurring || !t.isPaid))
      .sort((a, b) => {
        if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
        return a.date.localeCompare(b.date);
      });

    const billsPaidCount = bills.filter((t) => t.isPaid).length;
    const billsTotalCount = bills.length;

    return {
      monthTxns,
      income,
      expense,
      paidExpense,
      pendingExpense,
      prevIncome,
      prevExpense,
      balance,
      flow,
      balanceSeries,
      spendByCat,
      sorted,
      bills,
      billsPaidCount,
      billsTotalCount,
    };
  }, [data.transactions, key, month]);

  const savingsRate = m.income > 0 ? Math.max(0, ((m.income - m.expense) / m.income) * 100) : 0;

  const slices: DonutSlice[] = useMemo(() => {
    const base = m.sorted.slice(0, 6).map(([catId, value]) => {
      const c = catById.get(catId);
      return { id: String(catId), label: c?.name ?? "—", value, color: c?.color ?? "#888" };
    });
    const rest = m.sorted.slice(6).reduce((s, [, v]) => s + v, 0);
    if (rest > 0) base.push({ id: "outros", label: "Outros", value: rest, color: "#3d4436" });
    return base;
  }, [m.sorted, catById]);

  const recent = m.monthTxns.slice(0, 7);

  const submitBudget = async (b: BudgetDTO) => {
    const cents = parseAmount(budgetInput);
    if (!cents) return;
    setBusy(true);
    try {
      await onEditBudget(b, cents);
      setEditBudgetId(null);
      setBudgetInput("");
    } finally {
      setBusy(false);
    }
  };

  const submitDeposit = async (goal: GoalDTO, value?: number) => {
    const cents = value ?? parseAmount(depositInput);
    if (!cents) return;
    setBusy(true);
    try {
      await onDepositGoal(goal.id, cents);
      setDepositInput("");
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (e: React.MouseEvent, t: TransactionDTO) => {
    e.stopPropagation();
    setTogglingId(t.id);
    try {
      await onTogglePaid(t.id, t.isPaid);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ------------------------------ KPI row ----------------------------- */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        <Item i={0} className="col-span-2 xl:col-span-1">
          <div className="relative h-full overflow-hidden rounded-[22px] bg-[linear-gradient(140deg,#cdf96f,#a9e22c)] p-5 text-ink shadow-[0_20px_70px_-30px_rgba(182,242,68,0.45)]">
            <div className="flex items-start justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/55">Saldo acumulado</p>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink/10">
                <Wallet size={15} strokeWidth={2.2} />
              </span>
            </div>
            <p className="mt-4 font-display text-[clamp(1.9rem,2.6vw,2.5rem)] font-semibold leading-none tracking-tight">
              <Money cents={m.balance} />
            </p>
            <div className="mt-4 -mb-1 text-ink">
              <Sparkline values={m.balanceSeries} color="#233309" height={40} />
            </div>
            <p className="mt-1 text-[11px] font-medium text-ink/55">evolução dos últimos 6 meses</p>
          </div>
        </Item>

        <Item i={1}>
          <div className="card h-full p-5">
            <div className="flex items-start justify-between">
              <p className="eyebrow">Receitas no mês</p>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
                <TrendingUp size={15} strokeWidth={2.2} />
              </span>
            </div>
            <p className="mt-4 font-display text-[clamp(1.5rem,2vw,1.9rem)] font-semibold leading-none tracking-tight text-cream">
              <Money cents={m.income} />
            </p>
            <div className="mt-3">
              <Delta value={m.prevIncome > 0 ? ((m.income - m.prevIncome) / m.prevIncome) * 100 : null} />
            </div>
          </div>
        </Item>

        <Item i={2}>
          <div className="card h-full p-5">
            <div className="flex items-start justify-between">
              <p className="eyebrow">Despesas no mês</p>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-coral/10 text-coral">
                <TrendingDown size={15} strokeWidth={2.2} />
              </span>
            </div>
            <p className="mt-4 font-display text-[clamp(1.5rem,2vw,1.9rem)] font-semibold leading-none tracking-tight text-cream">
              <Money cents={m.expense} />
            </p>
            <div className="mt-2.5 flex items-center justify-between text-[11.5px]">
              <span className="text-accent font-medium">{fmt(m.paidExpense)} pagas</span>
              <span className={m.pendingExpense > 0 ? "text-amber-400 font-semibold" : "text-faint"}>
                {m.pendingExpense > 0 ? `${fmt(m.pendingExpense)} pendente` : "tudo pago"}
              </span>
            </div>
          </div>
        </Item>

        <Item i={3} className="col-span-2 xl:col-span-1">
          <div className="card flex h-full items-center gap-5 p-5">
            <div className="relative grid shrink-0 place-items-center">
              <ProgressRing value={savingsRate / 100} size={84} stroke={8} delay={0.3} />
              <span className="absolute font-display text-[15px] font-semibold">
                <Percent value={savingsRate} />
              </span>
            </div>
            <div>
              <p className="eyebrow">Taxa de poupança</p>
              <p className="mt-1.5 font-display text-[14.5px] font-medium leading-snug text-cream">
                {fmt(Math.max(0, m.income - m.expense))} guardados
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-faint">
                <PiggyBank size={12} /> do que entrou este mês
              </p>
            </div>
          </div>
        </Item>
      </div>

      {/* ------------------------- checklist gastos fixos ------------------------ */}
      {m.bills.length > 0 && (
        <Item i={3.5}>
          <div className="card border-accent/20 bg-panel/90 p-5 sm:p-6 shadow-[0_10px_40px_-20px_rgba(182,242,68,0.15)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent">
                  <CheckCircle2 size={19} strokeWidth={2.4} />
                </span>
                <div>
                  <h3 className="font-display text-[16px] font-semibold text-cream">
                    Controle de Gastos Fixos & Contas do Mês
                  </h3>
                  <p className="text-[12px] text-faint">
                    {m.billsPaidCount} de {m.billsTotalCount} contas liquidadas ({m.billsTotalCount > 0 ? Math.round((m.billsPaidCount / m.billsTotalCount) * 100) : 0}%)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[11px] text-faint">Restante a Pagar</p>
                  <p className={`font-display text-[15px] font-bold tabular-nums ${m.pendingExpense > 0 ? "text-amber-400" : "text-accent"}`}>
                    {fmt(m.pendingExpense)}
                  </p>
                </div>
                <button
                  onClick={onSeeAll}
                  className="rounded-xl border border-line px-3 py-2 text-xs font-medium text-mute hover:border-accent/40 hover:text-cream"
                >
                  Ver todas
                </button>
              </div>
            </div>

            {/* Quick checklist row */}
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {m.bills.slice(0, 8).map((bill) => (
                <div
                  key={bill.id}
                  onClick={(e) => handleToggle(e, bill)}
                  className={`group flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                    bill.isPaid
                      ? "border-line bg-cream/[0.02] text-mute hover:bg-cream/[0.04]"
                      : "border-amber-500/30 bg-amber-500/[0.04] text-cream hover:border-amber-400/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      disabled={togglingId === bill.id}
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md transition-all ${
                        bill.isPaid
                          ? "bg-accent text-ink"
                          : "border border-amber-400 text-amber-400"
                      }`}
                    >
                      {bill.isPaid ? <Check size={11} strokeWidth={3} /> : null}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[12.5px] font-medium ${bill.isPaid ? "line-through text-faint" : "text-cream"}`}>
                        {bill.description}
                      </p>
                      <p className="text-[10px] text-faint">
                        Dia {bill.date.split("-")[2]} · {bill.category.name}
                      </p>
                    </div>
                  </div>

                  <span className={`font-display text-[12px] font-semibold tabular-nums shrink-0 ${bill.isPaid ? "text-faint" : "text-amber-300"}`}>
                    {fmt(bill.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Item>
      )}

      {/* ------------------------- cash flow + donut ------------------------ */}
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Item i={4} id="fluxo" className="scroll-mt-28">
          <div className="card h-full p-6">
            <CardHeader
              title="Fluxo de caixa"
              sub="receitas e despesas dos últimos 6 meses"
              right={
                <div className="flex items-center gap-4 text-[11px] text-mute">
                  <span className="flex items-center gap-1.5">
                    <i className="h-[7px] w-[7px] rounded-full bg-accent" /> Receitas
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="h-[7px] w-[7px] rounded-full bg-coral" /> Despesas
                  </span>
                </div>
              }
            />
            <FlowChart data={m.flow} seriesKey={key} height={292} />
          </div>
        </Item>

        <Item i={5} id="categorias" className="scroll-mt-28">
          <div className="card flex h-full flex-col p-6">
            <CardHeader title="Despesas por categoria" sub="distribuição do mês selecionado" />
            <div className="flex flex-1 flex-col items-center gap-6 sm:flex-row xl:flex-col 2xl:flex-row">
              <Donut slices={slices} total={m.expense} active={activeSlice} onActive={setActiveSlice} size={196} />
              <div className="w-full min-w-0 flex-1 space-y-1">
                {slices.length === 0 && (
                  <p className="py-8 text-center text-[12.5px] text-faint">Nenhuma despesa neste mês.</p>
                )}
                {slices.map((s) => (
                  <button
                    key={s.id}
                    onMouseEnter={() => setActiveSlice(s.id)}
                    onMouseLeave={() => setActiveSlice(null)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-[7px] text-left transition-colors hover:bg-cream/4"
                  >
                    <i className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-mute">{s.label}</span>
                    <span className="text-[11px] tabular-nums text-faint">
                      {m.expense > 0 ? Math.round((s.value / m.expense) * 100) : 0}%
                    </span>
                    <span className="w-[74px] text-right font-display text-[12px] font-medium tabular-nums text-cream">
                      {fmt(s.value)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Item>
      </div>

      {/* --------------------- budgets + goals + recent --------------------- */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Item i={6} id="orcamentos" className="scroll-mt-28">
          <div className="card h-full p-6">
            <CardHeader
              title="Orçamentos"
              sub="limites mensais por categoria"
              right={
                <span className="rounded-lg border border-line px-2 py-1 text-[10.5px] font-medium text-mute">
                  {data.budgets.length} ativos
                </span>
              }
            />
            <div className="max-h-[408px] space-y-4 overflow-y-auto pr-1 [mask-image:linear-gradient(to_bottom,black_88%,transparent)]">
              {data.budgets.map((b) => {
                const cat = catById.get(b.categoryId);
                if (!cat) return null;
                const spent = m.spendByCat.get(b.categoryId) ?? 0;
                const used = pct(spent, b.amountCents);
                const over = spent > b.amountCents;
                const warn = !over && used >= 80;
                const barColor = over ? "#ff6e82" : warn ? "#eccb6b" : "#b6f244";

                if (editBudgetId === b.id)
                  return (
                    <div key={b.id} className="flex items-center gap-2">
                      <CategoryIcon icon={cat.icon} color={cat.color} />
                      <input
                        autoFocus
                        inputMode="decimal"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitBudget(b)}
                        placeholder="novo limite"
                        className="field !py-2 text-[13px]"
                      />
                      <button
                        onClick={() => submitBudget(b)}
                        disabled={busy}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-ink disabled:opacity-50"
                        aria-label="Confirmar"
                      >
                        <Check size={14} strokeWidth={2.6} />
                      </button>
                      <button
                        onClick={() => setEditBudgetId(null)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-mute hover:text-cream"
                        aria-label="Cancelar"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );

                return (
                  <div key={b.id} className="group flex items-center gap-3">
                    <CategoryIcon icon={cat.icon} color={cat.color} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-[13px] font-medium text-cream">{cat.name}</p>
                        <p className="font-display text-[12px] tabular-nums text-cream">
                          {fmt(spent)} <span className="text-faint">/ {fmt(b.amountCents)}</span>
                        </p>
                      </div>
                      <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-cream/7">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: barColor }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, used)}%` }}
                          transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
                        />
                      </div>
                      <p className="mt-1 text-[10.5px]" style={{ color: over ? "#ff6e82" : warn ? "#eccb6b" : "#5c6154" }}>
                        {over ? `${fmt(spent - b.amountCents)} acima do limite` : `restam ${fmt(b.amountCents - spent)}`}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditBudgetId(b.id);
                        setBudgetInput((b.amountCents / 100).toFixed(0));
                      }}
                      className="grid h-7 w-7 shrink-0 place-items-center self-start rounded-md text-faint opacity-0 transition-all hover:bg-cream/6 hover:text-cream group-hover:opacity-100"
                      aria-label={`Editar limite de ${cat.name}`}
                    >
                      <Pencil size={12.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </Item>

        <Item i={7} id="metas" className="scroll-mt-28">
          <div className="card h-full p-6">
            <CardHeader title="Metas" sub="por que você está juntando" />
            <div className="space-y-5">
              {data.goals.map((g, gi) => {
                const p = g.targetCents > 0 ? g.currentCents / g.targetCents : 0;
                const open = depositId === g.id;
                return (
                  <div key={g.id}>
                    <div className="flex items-center gap-3.5">
                      <div className="relative grid shrink-0 place-items-center">
                        <ProgressRing value={p} size={62} stroke={6} color={g.color} delay={0.25 + gi * 0.1} />
                        <span className="absolute font-display text-[10.5px] font-semibold text-cream">
                          {Math.round(p * 100)}%
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-cream">{g.name}</p>
                        <p className="mt-0.5 font-display text-[12px] tabular-nums text-mute">
                          {fmt(g.currentCents)} <span className="text-faint">de {fmt(g.targetCents)}</span>
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-faint">
                          faltam {fmt(Math.max(0, g.targetCents - g.currentCents))}
                        </p>
                      </div>
                      <button
                        onClick={() => setDepositId(open ? null : g.id)}
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-all ${
                          open
                            ? "border-accent/50 bg-accent/10 text-accent"
                            : "border-line text-mute hover:border-line-strong hover:text-cream"
                        }`}
                        aria-label={`Fazer aporte em ${g.name}`}
                      >
                        <Plus size={14} strokeWidth={2.4} />
                      </button>
                    </div>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-[76px]">
                            {[10000, 50000, 100000].map((v) => (
                              <button
                                key={v}
                                disabled={busy}
                                onClick={() => submitDeposit(g, v)}
                                className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-medium text-mute transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
                              >
                                +{fmt(v)}
                              </button>
                            ))}
                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                              <input
                                inputMode="decimal"
                                placeholder="outro valor"
                                value={depositInput}
                                onChange={(e) => setDepositInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && submitDeposit(g)}
                                className="field !rounded-lg !px-2.5 !py-1.5 text-[11.5px]"
                              />
                              <button
                                disabled={busy}
                                onClick={() => submitDeposit(g)}
                                className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-accent text-ink disabled:opacity-50"
                                aria-label="Confirmar aporte"
                              >
                                <Check size={13} strokeWidth={2.6} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </Item>

        <Item i={8} id="recentes">
          <div className="card flex h-full flex-col p-6">
            <CardHeader
              title="Transações recentes"
              right={
                <button
                  onClick={onSeeAll}
                  className="flex items-center gap-1 text-[12px] font-medium text-mute transition-colors hover:text-accent"
                >
                  ver todas <ArrowRight size={13} />
                </button>
              }
            />
            <div className="flex-1 space-y-0.5">
              {recent.length === 0 && (
                <p className="py-10 text-center text-[12.5px] text-faint">
                  Nenhuma movimentação neste mês.
                </p>
              )}
              {recent.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onEdit(t)}
                  className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-cream/4"
                >
                  {/* Status indicator button */}
                  <span
                    onClick={(e) => handleToggle(e, t)}
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-md transition-all ${
                      t.isPaid
                        ? "bg-accent/15 text-accent hover:bg-accent hover:text-ink"
                        : "border border-amber-400 bg-amber-400/10 text-amber-400 hover:bg-amber-400 hover:text-ink"
                    }`}
                    title={t.isPaid ? "Pago" : "Pendente"}
                  >
                    {t.isPaid ? <Check size={11} strokeWidth={3} /> : <Clock size={11} />}
                  </span>

                  <CategoryIcon icon={t.category.icon} color={t.category.color} chip={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="block truncate text-[13px] font-medium text-cream">{t.description}</span>
                      {t.isRecurring && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-accent/10 px-1 py-0.2 text-[8.5px] font-medium text-accent">
                          <Repeat2 size={9} /> fixa
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-faint">
                      {t.category.name} · {dayLabel(t.date)}
                    </span>
                  </span>
                  <span
                    className={`font-display text-[13px] font-medium tabular-nums ${
                      t.type === "income" ? "text-accent" : t.isPaid ? "text-cream" : "text-amber-300"
                    }`}
                  >
                    {fmtSigned(t.amountCents, t.type)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Item>
      </div>
    </div>
  );
}
