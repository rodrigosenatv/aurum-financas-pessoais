"use client";

import {
  Bell,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  ListChecks,
  LoaderCircle,
  Mic,
  Pencil,
  Plus,
  RefreshCw,
  Repeat2,
  Send,
  Sparkles,
  Tags,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { fmt, formatCurrencyInput, parseAmount } from "@/lib/format";
import { BareIcon, CategoryIcon, ICON_MAP } from "@/lib/icons";
import type { CategoryDTO, FinanceData, TxnType, UserDTO } from "@/lib/types";
import { useConfirm } from "./confirm";
import { Sheet } from "./sheet";
import { useToast } from "./toast";
import { EmptyState, SwitchRow } from "./ui";

export type ManageTab = "categorias" | "orcamentos" | "metas" | "fixos" | "telegram";

type CategoryInput = { name: string; icon: string; color: string; type: TxnType };
type GoalInput = { name: string; targetCents: number; color: string; icon: string };

const TABS: { id: ManageTab; label: string; icon: typeof Tags }[] = [
  { id: "categorias", label: "Categorias", icon: Tags },
  { id: "orcamentos", label: "Orçamentos", icon: ListChecks },
  { id: "metas", label: "Metas", icon: Target },
  { id: "fixos", label: "Fixos", icon: Repeat2 },
  { id: "telegram", label: "Telegram", icon: Bot },
];

const PRESET_COLORS = [
  "#b6f244",
  "#4ade80",
  "#14b8a6",
  "#06b6d4",
  "#38bdf8",
  "#6366f1",
  "#a78bfa",
  "#ec4899",
  "#ff6e82",
  "#f97316",
  "#f59e0b",
  "#eab308",
];

const AVAILABLE_ICONS = Object.keys(ICON_MAP);

const errorText = (error: unknown) => (error instanceof Error ? error.message : undefined);

/* -------------------------------------------------------------------------- */
/* peças compartilhadas                                                        */
/* -------------------------------------------------------------------------- */

function PanelHeader({ title, sub, right }: { title: string; sub: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 className="font-display text-[17px] font-semibold tracking-tight text-fg">{title}</h2>
        <p className="mt-0.5 text-[13px] text-fg-muted">{sub}</p>
      </div>
      {right}
    </div>
  );
}

function TypeToggle({ value, onChange }: { value: TxnType; onChange: (t: TxnType) => void }) {
  return (
    <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-1 rounded-[16px] border border-line bg-fg/[0.03] p-1">
      {(
        [
          { id: "expense", label: "Despesa", icon: TrendingDown, on: "bg-surface text-negative shadow-[inset_0_0_0_1px_var(--line-strong)]" },
          { id: "income", label: "Receita", icon: TrendingUp, on: "bg-surface text-accent shadow-[inset_0_0_0_1px_var(--line-strong)]" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="radio"
          aria-checked={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition-colors ${
            value === opt.id ? opt.on : "text-fg-muted hover:text-fg"
          }`}
        >
          <opt.icon size={14} strokeWidth={2.4} />
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ColorSwatches({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const custom = !PRESET_COLORS.includes(value.toLowerCase());
  return (
    <div role="radiogroup" aria-label="Cor" className="flex flex-wrap items-center gap-2">
      {PRESET_COLORS.map((color) => {
        const selected = value.toLowerCase() === color;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Cor ${color}`}
            onClick={() => onChange(color)}
            className={`grid h-9 w-9 place-items-center rounded-full transition-transform hover:scale-105 ${
              selected ? "ring-2 ring-fg ring-offset-2 ring-offset-surface" : ""
            }`}
            style={{ background: color }}
          >
            {selected && <Check size={15} strokeWidth={3} className="text-[#0a0c03]" />}
          </button>
        );
      })}
      <label
        className={`relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-line-strong ${
          custom ? "ring-2 ring-fg ring-offset-2 ring-offset-surface" : ""
        }`}
        style={custom ? { background: value } : undefined}
        title="Cor personalizada"
      >
        {!custom && <Plus size={15} className="text-fg-muted" />}
        <input
          type="color"
          aria-label="Cor personalizada"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

function IconGrid({ value, color, onChange }: { value: string; color: string; onChange: (icon: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Ícone" className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
      {AVAILABLE_ICONS.map((icon) => {
        const selected = value === icon;
        return (
          <button
            key={icon}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={icon}
            title={icon}
            onClick={() => onChange(icon)}
            className={`grid aspect-square min-h-11 place-items-center rounded-xl border transition-colors ${
              selected ? "" : "border-transparent text-fg-muted hover:bg-fg/[0.06] hover:text-fg"
            }`}
            style={
              selected
                ? {
                    borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
                    background: `color-mix(in srgb, ${color} 14%, transparent)`,
                  }
                : undefined
            }
          >
            <span className={selected ? "cat-fg" : undefined} style={selected ? ({ "--cat": color } as CSSProperties) : undefined}>
              <BareIcon icon={icon} size={19} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="eyebrow mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* view                                                                        */
/* -------------------------------------------------------------------------- */

export const ManageView = memo(function ManageView({
  data,
  user,
  tab,
  onTabChange,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onCreateBudget,
  onDeleteBudget,
  onCreateGoal,
  onDeleteGoal,
}: {
  data: FinanceData;
  user?: UserDTO;
  tab: ManageTab;
  onTabChange: (tab: ManageTab) => void;
  onCreateCategory: (input: CategoryInput) => Promise<void>;
  onUpdateCategory: (id: number, input: Partial<CategoryInput>) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
  onCreateBudget: (categoryId: number, amountCents: number) => Promise<void>;
  onDeleteBudget: (id: number) => Promise<void>;
  onCreateGoal: (input: GoalInput) => Promise<void>;
  onDeleteGoal: (id: number) => Promise<void>;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const tabRefs = useRef(new Map<ManageTab, HTMLButtonElement>());

  const [busy, setBusy] = useState<string | null>(null);

  const [category, setCategory] = useState<CategoryInput>({ name: "", icon: "Wallet", color: "#b6f244", type: "expense" });
  const [showCreateIcons, setShowCreateIcons] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryDTO | null>(null);
  const [editForm, setEditForm] = useState<CategoryInput>({ name: "", icon: "Wallet", color: "#b6f244", type: "expense" });

  const [budgetCategory, setBudgetCategory] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [goalName, setGoalName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goalColor, setGoalColor] = useState("#b6f244");

  const run = async (key: string, action: () => Promise<void>, success?: string, after?: () => void) => {
    setBusy(key);
    try {
      await action();
      after?.();
      if (success) toast.show({ tone: "success", title: success });
      return true;
    } catch (error) {
      toast.show({ tone: "error", title: "Não foi possível concluir", description: errorText(error) });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const budgeted = useMemo(() => new Set(data.budgets.map((budget) => budget.categoryId)), [data.budgets]);
  const availableBudgetCategories = useMemo(
    () => data.categories.filter((item) => item.type === "expense" && !budgeted.has(item.id)),
    [data.categories, budgeted],
  );
  const categoryById = useMemo(() => new Map(data.categories.map((item) => [item.id, item])), [data.categories]);
  const expenseCategories = data.categories.filter((c) => c.type === "expense");
  const incomeCategories = data.categories.filter((c) => c.type === "income");

  const recurringItems = useMemo(() => {
    const map = new Map<string, (typeof data.transactions)[number]>();
    for (const t of data.transactions) {
      if (!t.isRecurring) continue;
      const key = `${t.type}:${t.categoryId}:${t.description.trim().toLowerCase()}`;
      if (!map.has(key)) map.set(key, t);
    }
    return [...map.values()].sort((a, b) => b.amountCents - a.amountCents);
  }, [data]);

  const totalFixedExpenses = recurringItems.filter((t) => t.type === "expense").reduce((s, t) => s + t.amountCents, 0);
  const totalFixedIncome = recurringItems.filter((t) => t.type === "income").reduce((s, t) => s + t.amountCents, 0);

  const counts: Partial<Record<ManageTab, number>> = {
    categorias: data.categories.length,
    orcamentos: data.budgets.length,
    metas: data.goals.length,
    fixos: recurringItems.length,
  };

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    event.preventDefault();
    onTabChange(TABS[next].id);
    tabRefs.current.get(TABS[next].id)?.focus();
  };

  /* ------------------------------ categorias ----------------------------- */

  const createCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (category.name.trim().length < 2) {
      toast.show({ tone: "error", title: "Dê um nome com pelo menos 2 letras." });
      return;
    }
    await run("category-new", () => onCreateCategory({ ...category, name: category.name.trim() }), "Categoria criada", () => {
      setCategory((value) => ({ ...value, name: "" }));
      setShowCreateIcons(false);
    });
  };

  const openEditCategory = (item: CategoryDTO) => {
    setEditingCategory(item);
    setEditForm({ name: item.name, icon: item.icon, color: item.color, type: item.type });
  };

  const removeCategory = async (item: CategoryDTO) => {
    const ok = await confirm({
      title: `Excluir “${item.name}”?`,
      description: "A categoria só pode ser excluída se não tiver transações nem orçamento vinculados.",
      confirmLabel: "Excluir categoria",
    });
    if (!ok) return false;
    return run(`category-${item.id}`, () => onDeleteCategory(item.id), "Categoria excluída");
  };

  const saveCategory = async () => {
    if (!editingCategory) return;
    if (editForm.name.trim().length < 2) {
      toast.show({ tone: "error", title: "Dê um nome com pelo menos 2 letras." });
      return;
    }
    await run(
      "category-edit",
      () => onUpdateCategory(editingCategory.id, { ...editForm, name: editForm.name.trim() }),
      "Categoria atualizada",
      () => setEditingCategory(null),
    );
  };

  /* -------------------------- orçamentos e metas -------------------------- */

  const createBudget = async (event: FormEvent) => {
    event.preventDefault();
    const cents = parseAmount(budgetAmount);
    if (!budgetCategory || !cents) {
      toast.show({ tone: "error", title: "Escolha a categoria e informe o limite." });
      return;
    }
    await run("budget-new", () => onCreateBudget(Number(budgetCategory), cents), "Orçamento criado", () => {
      setBudgetCategory("");
      setBudgetAmount("");
    });
  };

  const removeBudget = async (id: number, name: string) => {
    const ok = await confirm({ title: `Remover o orçamento de “${name}”?`, confirmLabel: "Remover" });
    if (ok) await run(`budget-${id}`, () => onDeleteBudget(id), "Orçamento removido");
  };

  const createGoal = async (event: FormEvent) => {
    event.preventDefault();
    const cents = parseAmount(goalAmount);
    if (goalName.trim().length < 2 || !cents) {
      toast.show({ tone: "error", title: "Informe o nome da meta e o valor do objetivo." });
      return;
    }
    await run(
      "goal-new",
      () => onCreateGoal({ name: goalName.trim(), targetCents: cents, color: goalColor, icon: "Target" }),
      "Meta criada",
      () => {
        setGoalName("");
        setGoalAmount("");
      },
    );
  };

  const removeGoal = async (id: number, name: string) => {
    const ok = await confirm({
      title: `Excluir a meta “${name}”?`,
      description: "O histórico de aportes desta meta será perdido.",
      confirmLabel: "Excluir meta",
    });
    if (ok) await run(`goal-${id}`, () => onDeleteGoal(id), "Meta excluída");
  };

  /* -------------------------------- render ------------------------------- */

  const categoryRow = (item: CategoryDTO) => (
    <li key={item.id} className="flex items-center gap-1 rounded-2xl border border-line pr-1 transition-colors hover:border-line-strong">
      <button
        type="button"
        onClick={() => openEditCategory(item)}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl py-2.5 pl-3 text-left"
        aria-label={`Editar ${item.name}`}
      >
        <CategoryIcon icon={item.icon} color={item.color} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-fg">{item.name}</span>
        <Pencil size={14} className="mr-1 hidden shrink-0 text-fg-subtle xs:block" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={`Excluir ${item.name}`}
        disabled={busy !== null}
        onClick={() => void removeCategory(item)}
        className="icon-btn hover:!bg-negative/10 hover:!text-negative"
      >
        {busy === `category-${item.id}` ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
      </button>
    </li>
  );

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Seções de cadastro"
        className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:px-0"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              ref={(el) => {
                if (el) tabRefs.current.set(item.id, el);
              }}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={active}
              aria-controls={`painel-${item.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onTabChange(item.id)}
              onKeyDown={onTabKey}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[13.5px] font-semibold transition-colors ${
                active
                  ? "border-transparent bg-primary text-ink"
                  : "border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg"
              }`}
            >
              <item.icon size={15} strokeWidth={2.2} />
              {item.label}
              {counts[item.id] !== undefined && (
                <span className={`text-[12px] tabular-nums ${active ? "text-ink/60" : "text-fg-subtle"}`}>{counts[item.id]}</span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`painel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-4">
        {/* ------------------------------ categorias ----------------------------- */}
        {tab === "categorias" && (
          <section className="card card-pad">
            <PanelHeader title="Categorias" sub="Organize receitas e despesas do seu jeito." />

            <form onSubmit={(e) => void createCategory(e)} className="rounded-[20px] border border-line bg-fg/[0.02] p-3.5 sm:p-4">
              <p className="eyebrow mb-3">Nova categoria</p>
              <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateIcons((v) => !v)}
                    aria-expanded={showCreateIcons}
                    aria-label="Escolher ícone"
                    title="Escolher ícone"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-line-strong"
                    style={{
                      background: `color-mix(in srgb, ${category.color} 14%, transparent)`,
                    }}
                  >
                    <span className="cat-fg" style={{ "--cat": category.color } as CSSProperties}>
                      <BareIcon icon={category.icon} size={19} />
                    </span>
                  </button>
                  <input
                    className="field min-w-0"
                    placeholder="Nome da categoria"
                    aria-label="Nome da categoria"
                    value={category.name}
                    maxLength={50}
                    onChange={(event) => setCategory((value) => ({ ...value, name: event.target.value }))}
                  />
                </div>
                <TypeToggle value={category.type} onChange={(type) => setCategory((value) => ({ ...value, type }))} />
              </div>

              {showCreateIcons && (
                <div className="mt-3 rounded-2xl border border-line bg-surface p-2.5">
                  <IconGrid
                    value={category.icon}
                    color={category.color}
                    onChange={(icon) => {
                      setCategory((cur) => ({ ...cur, icon }));
                      setShowCreateIcons(false);
                    }}
                  />
                </div>
              )}

              <div className="mt-3">
                <ColorSwatches value={category.color} onChange={(color) => setCategory((cur) => ({ ...cur, color }))} />
              </div>

              <button type="submit" disabled={busy !== null} className="btn btn-primary mt-4 w-full sm:w-auto">
                {busy === "category-new" ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={2.5} />}
                Adicionar categoria
              </button>
            </form>

            {data.categories.length === 0 ? (
              <EmptyState compact icon={<Tags size={20} />} title="Nenhuma categoria" description="Crie a primeira acima." />
            ) : (
              <div className="mt-6 space-y-5">
                {[
                  { label: "Despesas", items: expenseCategories },
                  { label: "Receitas", items: incomeCategories },
                ].map(
                  (group) =>
                    group.items.length > 0 && (
                      <div key={group.label}>
                        <h3 className="eyebrow mb-2.5">
                          {group.label} <span className="tracking-normal text-fg-subtle/80">· {group.items.length}</span>
                        </h3>
                        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{group.items.map(categoryRow)}</ul>
                      </div>
                    ),
                )}
              </div>
            )}
          </section>
        )}

        {/* ------------------------------ orçamentos ----------------------------- */}
        {tab === "orcamentos" && (
          <section className="card card-pad">
            <PanelHeader title="Orçamentos" sub="Defina um limite mensal de gastos por categoria." />
            {availableBudgetCategories.length > 0 ? (
              <form
                onSubmit={(e) => void createBudget(e)}
                className="grid gap-2.5 rounded-[20px] border border-line bg-fg/[0.02] p-3.5 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end sm:p-4"
              >
                <Field label="Categoria">
                  <span className="relative block">
                    <select className="field" value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)}>
                      <option value="">Escolha…</option>
                      {availableBudgetCategories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-subtle" />
                  </span>
                </Field>
                <Field label="Limite mensal">
                  <input
                    className="field"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(formatCurrencyInput(e.target.value))}
                  />
                </Field>
                <button type="submit" disabled={busy !== null} className="btn btn-primary">
                  {busy === "budget-new" ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={2.5} />}
                  Criar
                </button>
              </form>
            ) : (
              <p className="rounded-2xl border border-dashed border-line-strong px-4 py-3 text-[13px] text-fg-muted">
                Todas as categorias de despesa já têm orçamento.
              </p>
            )}

            {data.budgets.length === 0 ? (
              <EmptyState
                compact
                icon={<ListChecks size={20} />}
                title="Nenhum orçamento"
                description="Comece pelas categorias em que você mais gasta, como mercado e transporte."
              />
            ) : (
              <ul className="mt-5 space-y-2">
                {data.budgets.map((item) => {
                  const cat = categoryById.get(item.categoryId);
                  return (
                    <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-line py-2 pr-1 pl-3">
                      {cat && <CategoryIcon icon={cat.icon} color={cat.color} chip={36} />}
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-fg">{cat?.name ?? "Categoria"}</span>
                      <span className="shrink-0 font-display text-[14px] text-fg-muted tabular-nums">{fmt(item.amountCents)}</span>
                      <button
                        type="button"
                        aria-label={`Remover orçamento de ${cat?.name ?? "categoria"}`}
                        onClick={() => void removeBudget(item.id, cat?.name ?? "categoria")}
                        className="icon-btn hover:!bg-negative/10 hover:!text-negative"
                      >
                        {busy === `budget-${item.id}` ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* --------------------------------- metas -------------------------------- */}
        {tab === "metas" && (
          <section className="card card-pad">
            <PanelHeader title="Metas" sub="Objetivos para juntar dinheiro. Registre aportes na visão geral." />
            <form onSubmit={(e) => void createGoal(e)} className="rounded-[20px] border border-line bg-fg/[0.02] p-3.5 sm:p-4">
              <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_200px]">
                <Field label="Nome da meta">
                  <input
                    className="field"
                    placeholder="Ex.: viagem, reserva, carro"
                    value={goalName}
                    maxLength={60}
                    onChange={(e) => setGoalName(e.target.value)}
                  />
                </Field>
                <Field label="Objetivo">
                  <input
                    className="field"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={goalAmount}
                    onChange={(e) => setGoalAmount(formatCurrencyInput(e.target.value))}
                  />
                </Field>
              </div>
              <p className="eyebrow mt-3.5 mb-2">Cor</p>
              <ColorSwatches value={goalColor} onChange={setGoalColor} />
              <button type="submit" disabled={busy !== null} className="btn btn-primary mt-4 w-full sm:w-auto">
                {busy === "goal-new" ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={2.5} />}
                Criar meta
              </button>
            </form>

            {data.goals.length === 0 ? (
              <EmptyState compact icon={<Target size={20} />} title="Nenhuma meta" description="Crie a primeira acima." />
            ) : (
              <ul className="mt-5 space-y-2">
                {data.goals.map((item) => {
                  const p = item.targetCents > 0 ? Math.min(1, item.currentCents / item.targetCents) : 0;
                  return (
                    <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-line py-2.5 pr-1 pl-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate text-[14px] font-medium text-fg">{item.name}</span>
                          <span className="shrink-0 font-display text-[12.5px] text-fg-muted tabular-nums">
                            {fmt(item.currentCents)} / {fmt(item.targetCents)}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fg/[0.08]">
                          <div className="h-full rounded-full" style={{ width: `${p * 100}%`, background: item.color }} />
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`Excluir meta ${item.name}`}
                        onClick={() => void removeGoal(item.id, item.name)}
                        className="icon-btn hover:!bg-negative/10 hover:!text-negative"
                      >
                        {busy === `goal-${item.id}` ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* --------------------------------- fixos -------------------------------- */}
        {tab === "fixos" && (
          <section className="card card-pad">
            <PanelHeader
              title="Lançamentos fixos"
              sub="Marque uma transação como fixa e importe-a todo mês com um toque."
            />
            <dl className="mb-5 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-line px-3.5 py-3">
                <dt className="eyebrow">Despesas fixas</dt>
                <dd className="mt-1 font-display text-[17px] font-semibold text-negative tabular-nums">{fmt(totalFixedExpenses)}</dd>
              </div>
              <div className="rounded-2xl border border-line px-3.5 py-3">
                <dt className="eyebrow">Receitas fixas</dt>
                <dd className="mt-1 font-display text-[17px] font-semibold text-accent tabular-nums">{fmt(totalFixedIncome)}</dd>
              </div>
            </dl>
            {recurringItems.length === 0 ? (
              <EmptyState
                compact
                icon={<Repeat2 size={20} />}
                title="Nenhum lançamento fixo"
                description="Ao registrar aluguel, salário ou assinaturas, ative “Lançamento fixo”."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {recurringItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                    <CategoryIcon icon={item.category.icon} color={item.category.color} chip={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-fg">{item.description}</p>
                      <p className="truncate text-[12px] text-fg-subtle">
                        {item.category.name} · dia {item.date.split("-")[2]}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-display text-[13.5px] font-semibold tabular-nums ${
                        item.type === "income" ? "text-accent" : "text-fg"
                      }`}
                    >
                      {fmt(item.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ------------------------------- telegram ------------------------------- */}
        {tab === "telegram" && <TelegramPanel user={user} />}
      </div>

      {/* --------------------------- editar categoria --------------------------- */}
      <Sheet
        open={editingCategory !== null}
        onClose={() => setEditingCategory(null)}
        eyebrow="editar categoria"
        title={editForm.name.trim() || "Sem nome"}
        headerAside={<CategoryIcon icon={editForm.icon} color={editForm.color} chip={42} size={20} />}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                if (editingCategory && (await removeCategory(editingCategory))) setEditingCategory(null);
              }}
              className="btn btn-danger min-h-12 px-3.5"
              aria-label="Excluir categoria"
            >
              <Trash2 size={17} />
              <span className="hidden xs:inline">Excluir</span>
            </button>
            <button type="button" disabled={busy !== null} onClick={() => void saveCategory()} className="btn btn-primary min-h-12 flex-1">
              {busy === "category-edit" ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} strokeWidth={2.6} />}
              Salvar alterações
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <Field label="Nome">
            <input
              className="field"
              placeholder="Ex.: Alimentação, Saúde"
              value={editForm.name}
              maxLength={50}
              onChange={(e) => setEditForm((cur) => ({ ...cur, name: e.target.value }))}
            />
          </Field>
          <div>
            <p className="eyebrow mb-1.5">Tipo</p>
            <TypeToggle value={editForm.type} onChange={(type) => setEditForm((cur) => ({ ...cur, type }))} />
          </div>
          <div>
            <p className="eyebrow mb-2">Cor</p>
            <ColorSwatches value={editForm.color} onChange={(color) => setEditForm((cur) => ({ ...cur, color }))} />
          </div>
          <div>
            <p className="eyebrow mb-2">Ícone</p>
            <IconGrid value={editForm.icon} color={editForm.color} onChange={(icon) => setEditForm((cur) => ({ ...cur, icon }))} />
          </div>
        </div>
      </Sheet>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Telegram                                                                    */
/* -------------------------------------------------------------------------- */

interface TelegramState {
  loading: boolean;
  connected: boolean;
  chatId?: string | null;
  username?: string | null;
  pairCode?: string | null;
  pairExpires?: string | null;
  deepLink?: string | null;
  botUsername?: string | null;
  notifyDueBills: boolean;
  notifyBudgetLimit: boolean;
  botConfigured: boolean;
}

function TelegramPanel({ user }: { user?: UserDTO }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tg, setTg] = useState<TelegramState>({
    loading: true,
    connected: Boolean(user?.telegramChatId),
    chatId: user?.telegramChatId,
    username: user?.telegramUsername,
    notifyDueBills: user?.telegramNotifyDueBills ?? true,
    notifyBudgetLimit: user?.telegramNotifyBudgetLimit ?? true,
    botConfigured: true,
  });

  const applyStatus = (json: Partial<TelegramState> & { connected: boolean }) =>
    setTg((cur) => ({
      ...cur,
      loading: false,
      connected: json.connected,
      chatId: json.chatId,
      username: json.username,
      pairCode: json.pairCode,
      pairExpires: json.pairExpires,
      notifyDueBills: json.notifyDueBills ?? true,
      notifyBudgetLimit: json.notifyBudgetLimit ?? true,
      botUsername: json.botUsername,
      botConfigured: json.botConfigured ?? true,
    }));

  const refresh = async () => {
    setTg((cur) => ({ ...cur, loading: true }));
    try {
      const res = await fetch("/api/telegram/connect");
      if (!res.ok) throw new Error();
      applyStatus(await res.json());
    } catch {
      setTg((cur) => ({ ...cur, loading: false }));
      toast.show({ tone: "error", title: "Não foi possível consultar o Telegram" });
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/telegram/connect")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json) applyStatus(json);
        else if (active) setTg((cur) => ({ ...cur, loading: false }));
      })
      .catch(() => {
        if (active) setTg((cur) => ({ ...cur, loading: false }));
      });
    return () => {
      active = false;
    };
  }, []);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/telegram/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "Não foi possível concluir.");
    return json;
  };

  const generateCode = async () => {
    setBusy("code");
    try {
      const json = await post({ action: "generate_code" });
      setTg((cur) => ({
        ...cur,
        pairCode: json.pairCode,
        pairExpires: json.pairExpires,
        deepLink: json.deepLink,
        botUsername: json.botUsername,
      }));
    } catch (error) {
      toast.show({ tone: "error", title: "Erro ao gerar o código", description: errorText(error) });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    const ok = await confirm({
      title: "Desconectar o Telegram?",
      description: "Você deixa de receber lembretes e não poderá lançar transações pelo bot até conectar de novo.",
      confirmLabel: "Desconectar",
    });
    if (!ok) return;
    setBusy("disconnect");
    try {
      await post({ action: "disconnect" });
      setTg((cur) => ({ ...cur, connected: false, chatId: null, username: null, pairCode: null }));
      toast.show({ tone: "success", title: "Telegram desconectado" });
    } catch (error) {
      toast.show({ tone: "error", title: "Não foi possível desconectar", description: errorText(error) });
    } finally {
      setBusy(null);
    }
  };

  const updateSetting = async (field: "due" | "budget", value: boolean) => {
    const previous = { notifyDueBills: tg.notifyDueBills, notifyBudgetLimit: tg.notifyBudgetLimit };
    const next = {
      notifyDueBills: field === "due" ? value : tg.notifyDueBills,
      notifyBudgetLimit: field === "budget" ? value : tg.notifyBudgetLimit,
    };
    setTg((cur) => ({ ...cur, ...next }));
    try {
      await post({ action: "update_settings", ...next });
    } catch (error) {
      setTg((cur) => ({ ...cur, ...previous }));
      toast.show({ tone: "error", title: "Não foi possível salvar a preferência", description: errorText(error) });
    }
  };

  const sendTest = async () => {
    setBusy("test");
    try {
      await post({ action: "test_message" });
      toast.show({ tone: "success", title: "Mensagem de teste enviada", description: "Confira o seu Telegram." });
    } catch (error) {
      toast.show({ tone: "error", title: "Erro ao enviar o teste", description: errorText(error) });
    } finally {
      setBusy(null);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.show({ tone: "error", title: "Não foi possível copiar", description: "Selecione o texto e copie manualmente." });
    }
  };

  return (
    <section className="card card-pad relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 right-0 h-40 w-40 translate-x-12 -translate-y-12 rounded-full bg-accent/10 blur-3xl" />

      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-ink">
            <Bot size={22} strokeWidth={2.3} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-[17px] font-semibold tracking-tight text-fg">Assistente no Telegram</h2>
              {tg.connected ? (
                <span className="chip bg-accent/15 text-accent">
                  <CheckCircle2 size={12} /> Conectado
                </span>
              ) : (
                <span className="chip bg-fg/[0.07] text-fg-muted">Desconectado</span>
              )}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
              Lance gastos por texto, áudio ou foto de comprovante e receba lembretes de vencimento.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => void refresh()} className="icon-btn border border-line" aria-label="Atualizar status">
          <RefreshCw size={16} className={tg.loading ? "animate-spin" : ""} />
        </button>
      </div>

      {tg.connected ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-accent/[0.05] p-3.5">
            <div className="min-w-0">
              <p className="text-[12.5px] text-fg-subtle">Conta vinculada</p>
              <p className="truncate font-display text-[15px] font-semibold text-fg">
                {tg.username ? `@${tg.username}` : `Chat ${tg.chatId}`}
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 xs:flex xs:w-auto">
              <button type="button" disabled={busy !== null} onClick={() => void sendTest()} className="btn btn-secondary">
                {busy === "test" ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
                Enviar teste
              </button>
              <button type="button" disabled={busy !== null} onClick={() => void disconnect()} className="btn btn-danger">
                Desconectar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <SwitchRow
              checked={tg.notifyDueBills}
              onChange={(v) => void updateSetting("due", v)}
              icon={<Bell size={17} />}
              title="Lembretes de vencimento"
              description="Aviso diário sobre contas a pagar."
            />
            <SwitchRow
              checked={tg.notifyBudgetLimit}
              onChange={(v) => void updateSetting("budget", v)}
              icon={<Zap size={17} />}
              title="Alertas de orçamento"
              description="Aviso ao atingir 80% e 100% do limite."
            />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-fg/[0.02] p-4 sm:p-5">
          {tg.pairCode ? (
            <div className="space-y-3">
              <p className="text-[13px] text-fg-muted">Envie este comando para o bot no Telegram, ou abra o link direto:</p>
              <div className="flex flex-col gap-2 xs:flex-row xs:items-center">
                <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-line-strong bg-canvas/70 py-1.5 pr-1.5 pl-3.5 font-mono text-[15px] font-bold text-accent">
                  <span className="break-all">/conectar {tg.pairCode}</span>
                  <button
                    type="button"
                    onClick={() => void copyCode(`/conectar ${tg.pairCode}`)}
                    className="icon-btn h-10 w-10"
                    aria-label="Copiar comando"
                  >
                    {copied ? <CheckCircle2 size={17} className="text-accent" /> : <Copy size={17} />}
                  </button>
                </div>
                {tg.deepLink && (
                  <a href={tg.deepLink} target="_blank" rel="noreferrer" className="btn btn-primary">
                    <ExternalLink size={15} /> Abrir no Telegram
                  </a>
                )}
              </div>
              <p className="text-[12.5px] text-fg-subtle">O código expira em 15 minutos. Depois de enviar, toque em atualizar.</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-fg">Conecte seu Telegram em segundos</p>
                <p className="mt-0.5 text-[13px] text-fg-muted">Gere um código de pareamento exclusivo para o seu chat.</p>
              </div>
              <button type="button" disabled={busy !== null} onClick={() => void generateCode()} className="btn btn-primary w-full xs:w-auto">
                {busy === "code" ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}
                Gerar código
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 border-t border-line pt-4 sm:grid-cols-3">
        {[
          { icon: Send, title: "Texto", text: "“Almoço 45 alimentação”, “Salário 4500”, “Notebook 3000 10x”." },
          { icon: Mic, title: "Áudio", text: "Diga o que gastou e o assistente transcreve e lança." },
          { icon: Camera, title: "Fotos", text: "Notas, cupons e comprovantes Pix viram lançamentos." },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-line p-3">
            <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-fg">
              <item.icon size={14} className="text-accent" /> {item.title}
            </p>
            <p className="text-[12.5px] leading-relaxed text-fg-subtle">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
