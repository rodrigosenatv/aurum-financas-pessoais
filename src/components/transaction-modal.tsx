"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  LoaderCircle,
  Plus,
  Repeat2,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { centsToInput, formatCurrencyInput, parseAmount, todayISO } from "@/lib/format";
import { BareIcon } from "@/lib/icons";
import type { CategoryDTO, TransactionDTO, TxnPayload, TxnType } from "@/lib/types";
import { Sheet } from "./sheet";
import { SwitchRow } from "./ui";

function shiftISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function TransactionModal({
  open,
  editing,
  categories,
  onClose,
  onSubmit,
  onDelete,
  onManageCategories,
}: {
  open: boolean;
  editing: TransactionDTO | null;
  categories: CategoryDTO[];
  onClose: () => void;
  onSubmit: (payload: TxnPayload, id?: number) => Promise<void>;
  onDelete?: (t: TransactionDTO) => void;
  onManageCategories?: () => void;
}) {
  const [type, setType] = useState<TxnType>(editing?.type ?? "expense");
  const [amount, setAmount] = useState(editing ? centsToInput(editing.amountCents) : "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(editing?.categoryId ?? null);
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [isPaid, setIsPaid] = useState<boolean>(editing ? editing.isPaid : true);
  const [isRecurring, setIsRecurring] = useState<boolean>(editing ? editing.isRecurring : false);
  const [repeat, setRepeat] = useState<"none" | "monthly">("none");
  const [installments, setInstallments] = useState(1);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const [today] = useState(todayISO);
  const yesterday = useMemo(() => shiftISO(today, -1), [today]);

  const visibleCategories = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);

  const switchType = (t: TxnType) => {
    setType(t);
    const current = categories.find((c) => c.id === categoryId);
    if (current && current.type !== t) setCategoryId(null);
  };

  const cents = parseAmount(amount);
  const errors = {
    amount: !cents ? "Informe um valor maior que zero." : null,
    description: description.trim().length === 0 ? "Dê um nome para a transação." : null,
    category: categoryId === null ? "Escolha uma categoria." : null,
  };
  const valid = !errors.amount && !errors.description && !errors.category;

  const submit = async () => {
    if (busy) return;
    if (!valid) {
      setTouched(true);
      const first = errors.amount ? "amount" : errors.description ? "description" : "category";
      formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(
        {
          description: description.trim(),
          amountCents: cents!,
          type,
          categoryId: categoryId!,
          date,
          isPaid,
          isRecurring,
          repeat,
          installments: type === "expense" ? installments : 1,
        },
        editing?.id,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo deu errado. Tente novamente.");
      setBusy(false);
    }
  };

  const onEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submit();
    }
  };

  const showError = (field: keyof typeof errors) => touched && errors[field];
  const income = type === "income";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={editing ? "editar" : "registrar"}
      title={editing ? "Editar transação" : "Nova transação"}
      initialFocus={editing ? undefined : "[data-field='amount']"}
      footer={
        <div className="space-y-2.5">
          {error && (
            <p role="alert" className="rounded-xl border border-negative/25 bg-negative/10 px-3 py-2 text-[13px] text-negative">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            {editing && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(editing);
                }}
                className="btn btn-danger min-h-12 px-3.5"
                aria-label="Excluir transação"
              >
                <Trash2 size={17} />
                <span className="hidden xs:inline">Excluir</span>
              </button>
            )}
            <button type="button" onClick={() => void submit()} disabled={busy} className="btn btn-primary min-h-12 flex-1 text-[14.5px]">
              {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} strokeWidth={2.8} />}
              {editing ? "Salvar alterações" : income ? "Adicionar receita" : "Adicionar despesa"}
            </button>
          </div>
        </div>
      }
    >
      <div ref={formRef} className="space-y-5">
        {/* tipo */}
        <div role="radiogroup" aria-label="Tipo de transação" className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "expense", label: "Despesa", icon: TrendingDown, on: "border-negative/50 bg-negative/10 text-negative" },
              { id: "income", label: "Receita", icon: TrendingUp, on: "border-accent/50 bg-accent/10 text-accent" },
            ] as const
          ).map((opt) => {
            const active = type === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => switchType(opt.id)}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-[14px] font-semibold transition-colors ${
                  active ? opt.on : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
                }`}
              >
                <opt.icon size={16} strokeWidth={2.4} />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* valor */}
        <div>
          <label htmlFor="txn-amount" className="eyebrow mb-1.5 block">
            Valor
          </label>
          <div
            className={`flex items-baseline gap-2 border-b-2 pb-2 transition-colors focus-within:border-accent/70 ${
              showError("amount") ? "border-negative/70" : "border-line-strong"
            }`}
          >
            <span className="font-display text-[17px] font-medium text-fg-subtle">R$</span>
            <input
              id="txn-amount"
              data-field="amount"
              inputMode="numeric"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(formatCurrencyInput(e.target.value))}
              onKeyDown={onEnter}
              placeholder="0,00"
              aria-invalid={Boolean(showError("amount"))}
              aria-describedby={showError("amount") ? "txn-amount-error" : undefined}
              className={`w-full min-w-0 bg-transparent font-display text-[clamp(1.9rem,9vw,2.4rem)] font-semibold tracking-tight outline-none placeholder:text-fg/20 ${
                income ? "text-accent" : "text-fg"
              }`}
            />
          </div>
          {showError("amount") && (
            <p id="txn-amount-error" className="mt-1.5 text-[12.5px] text-negative">
              {errors.amount}
            </p>
          )}
        </div>

        {/* descrição */}
        <div>
          <label htmlFor="txn-description" className="eyebrow mb-1.5 block">
            Descrição
          </label>
          <input
            id="txn-description"
            data-field="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={onEnter}
            placeholder={income ? "Ex.: salário, freela, reembolso" : "Ex.: mercado, aluguel, cinema"}
            autoComplete="off"
            enterKeyHint="done"
            className="field"
            maxLength={120}
            aria-invalid={Boolean(showError("description"))}
            aria-describedby={showError("description") ? "txn-description-error" : undefined}
          />
          {showError("description") && (
            <p id="txn-description-error" className="mt-1.5 text-[12.5px] text-negative">
              {errors.description}
            </p>
          )}
        </div>

        {/* categoria */}
        <div>
          <p id="txn-category-label" className="eyebrow mb-1.5">
            Categoria
          </p>
          {visibleCategories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong p-4 text-center">
              <p className="text-[13px] text-fg-muted">
                Você ainda não tem categorias de {income ? "receita" : "despesa"}.
              </p>
              {onManageCategories && (
                <button type="button" onClick={onManageCategories} className="btn btn-secondary mt-3">
                  <Plus size={15} /> Criar categoria
                </button>
              )}
            </div>
          ) : (
            <div
              role="radiogroup"
              aria-labelledby="txn-category-label"
              aria-describedby={showError("category") ? "txn-category-error" : undefined}
              className="grid max-h-[min(212px,34dvh)] grid-cols-3 gap-1.5 overflow-y-auto overscroll-contain p-0.5 xs:grid-cols-4"
            >
              {visibleCategories.map((c, index) => {
                const selected = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-field={index === 0 ? "category" : undefined}
                    onClick={() => setCategoryId(c.id)}
                    className={`flex min-h-[70px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-2.5 transition-colors ${
                      selected ? "" : "border-line hover:border-line-strong"
                    }`}
                    style={
                      selected
                        ? ({
                            "--cat": c.color,
                            borderColor: `color-mix(in srgb, ${c.color} 60%, transparent)`,
                            background: `color-mix(in srgb, ${c.color} 12%, transparent)`,
                          } as CSSProperties)
                        : ({ "--cat": c.color } as CSSProperties)
                    }
                  >
                    <span className="cat-fg">
                      <BareIcon icon={c.icon} size={18} />
                    </span>
                    <span
                      className={`line-clamp-2 max-w-full px-0.5 text-center text-[11.5px] leading-tight font-medium break-words ${
                        selected ? "text-fg" : "text-fg-muted"
                      }`}
                    >
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {showError("category") && visibleCategories.length > 0 && (
            <p id="txn-category-error" className="mt-1.5 text-[12.5px] text-negative">
              {errors.category}
            </p>
          )}
        </div>

        {/* data */}
        <div>
          <label htmlFor="txn-date" className="eyebrow mb-1.5 block">
            Data
          </label>
          <div className="flex gap-1.5">
            {[
              { label: "Hoje", value: today },
              { label: "Ontem", value: yesterday },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                aria-pressed={date === chip.value}
                onClick={() => setDate(chip.value)}
                className={`min-h-11 shrink-0 rounded-[14px] border px-3.5 text-[13px] font-semibold transition-colors ${
                  date === chip.value
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-line-strong text-fg-muted hover:text-fg"
                }`}
              >
                {chip.label}
              </button>
            ))}
            <div className="relative min-w-0 flex-1">
              <input
                id="txn-date"
                type="date"
                required
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="field min-w-0 pl-10"
              />
              <CalendarDays size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-subtle" />
            </div>
          </div>
        </div>

        {/* status */}
        <div className="space-y-2">
          <SwitchRow
            checked={isPaid}
            onChange={setIsPaid}
            icon={<CircleDollarSign size={18} />}
            title={income ? "Recebido" : "Pago"}
            description={
              isPaid
                ? income
                  ? "O dinheiro já entrou na conta."
                  : "O dinheiro já saiu da conta."
                : "Fica como pendente até você marcar."
            }
          />
          <SwitchRow
            checked={isRecurring}
            onChange={setIsRecurring}
            icon={<Repeat2 size={18} />}
            title="Lançamento fixo"
            description="Fica disponível para importar nos próximos meses."
          />
        </div>

        {!editing && !isRecurring && (
          <details className="group rounded-2xl border border-line">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3.5 text-[14px] font-medium text-fg [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2.5">
                <Repeat2 size={16} className="text-accent" />
                Repetir ou parcelar
                {(repeat !== "none" || installments > 1) && (
                  <span className="chip bg-accent/12 text-accent">
                    {repeat === "monthly" ? "12 meses" : `${installments}x`}
                  </span>
                )}
              </span>
              <ChevronDown size={17} className="text-fg-subtle transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid grid-cols-1 gap-3 border-t border-line p-3.5 xs:grid-cols-2">
              <label className="block">
                <span className="eyebrow mb-1.5 block">Repetição</span>
                <span className="relative block">
                  <select
                    className="field"
                    value={repeat}
                    onChange={(e) => {
                      const value = e.target.value as "none" | "monthly";
                      setRepeat(value);
                      if (value === "monthly") setInstallments(1);
                    }}
                  >
                    <option value="none">Não repetir</option>
                    <option value="monthly">Todo mês por 12 meses</option>
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-subtle" />
                </span>
              </label>
              <label className="block">
                <span className="eyebrow mb-1.5 block">Parcelas</span>
                <span className="relative block">
                  <select
                    className="field"
                    value={installments}
                    disabled={type !== "expense" || repeat === "monthly"}
                    onChange={(e) => setInstallments(Number(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, index) => index + 1).map((value) => (
                      <option key={value} value={value}>
                        {value === 1 ? "À vista" : `${value}x`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-subtle" />
                </span>
              </label>
              {type !== "expense" && (
                <p className="text-[12px] text-fg-subtle xs:col-span-2">Parcelamento disponível apenas para despesas.</p>
              )}
            </div>
          </details>
        )}
      </div>
    </Sheet>
  );
}
