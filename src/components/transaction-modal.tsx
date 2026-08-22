"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, LoaderCircle, Repeat2, TrendingDown, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseAmount, todayISO } from "@/lib/format";
import { BareIcon } from "@/lib/icons";
import type { CategoryDTO, TransactionDTO, TxnPayload, TxnType } from "@/lib/types";

export function TransactionModal({
  open,
  editing,
  categories,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: TransactionDTO | null;
  categories: CategoryDTO[];
  onClose: () => void;
  onSubmit: (payload: TxnPayload, id?: number) => Promise<void>;
}) {
  const [type, setType] = useState<TxnType>(editing?.type ?? "expense");
  const [amount, setAmount] = useState(
    editing ? (editing.amountCents / 100).toFixed(2).replace(".", ",") : "",
  );
  const [description, setDescription] = useState(editing?.description ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(editing?.categoryId ?? null);
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [isPaid, setIsPaid] = useState<boolean>(editing ? editing.isPaid : true);
  const [isRecurring, setIsRecurring] = useState<boolean>(editing ? editing.isRecurring : false);
  const [repeat, setRepeat] = useState<"none" | "monthly">("none");
  const [installments, setInstallments] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => amountRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const visibleCategories = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);

  const switchType = (t: TxnType) => {
    setType(t);
    const current = categories.find((c) => c.id === categoryId);
    if (current && current.type !== t) setCategoryId(null);
  };

  const cents = parseAmount(amount);
  const valid = cents !== null && cents > 0 && description.trim().length > 0 && categoryId !== null;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(
        {
          description: description.trim(),
          amountCents: cents,
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
      setError(e instanceof Error ? e.message : "Algo deu errado.");
      setBusy(false);
    }
  };

  const accent = type === "income" ? "#b6f244" : "#ff6e82";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            aria-label="Fechar"
            className="absolute inset-0 bg-ink/70 backdrop-blur-md"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal
            className="relative max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-[26px] border border-line-strong bg-panel p-6 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] sm:p-7"
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="eyebrow mb-1.5">{editing ? "editar" : "registrar"}</p>
                <h2 className="font-serif text-[26px] leading-none text-cream">
                  {editing ? "Ajustar transação" : "Nova transação"}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-xl border border-line text-mute transition-colors hover:border-line-strong hover:text-cream"
                aria-label="Fechar modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* type segmented */}
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "expense", label: "Despesa", icon: TrendingDown, color: "#ff6e82" },
                  { id: "income", label: "Receita", icon: TrendingUp, color: "#b6f244" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => switchType(opt.id)}
                  className="flex items-center justify-center gap-2 rounded-2xl border py-3 text-[13.5px] font-semibold transition-all duration-200"
                  style={{
                    borderColor: type === opt.id ? `${opt.color}66` : "rgba(238,242,228,0.08)",
                    background: type === opt.id ? `${opt.color}14` : "transparent",
                    color: type === opt.id ? opt.color : "#878d7c",
                  }}
                >
                  <opt.icon size={15} strokeWidth={2.4} />
                  {opt.label}
                </button>
              ))}
            </div>

            {/* amount */}
            <div className="mt-6">
              <label className="eyebrow mb-2 block">Valor</label>
              <div className="flex items-baseline gap-2 border-b border-line pb-3 transition-colors focus-within:border-accent/50">
                <span className="font-display text-[15px] font-medium text-faint">R$</span>
                <input
                  ref={amountRef}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="0,00"
                  className="w-full bg-transparent font-display text-[34px] font-semibold tracking-tight text-cream outline-none placeholder:text-cream/15"
                />
              </div>
            </div>

            {/* description */}
            <div className="mt-5">
              <label className="eyebrow mb-2 block">Descrição</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder={type === "income" ? "Ex.: salário, freela, dividendos..." : "Ex.: mercado, aluguel, cinema..."}
                className="field"
                maxLength={120}
              />
            </div>

            {/* category */}
            <div className="mt-5">
              <label className="eyebrow mb-2 block">Categoria</label>
              <div className="grid max-h-[188px] grid-cols-3 gap-1.5 overflow-y-auto pr-1">
                {visibleCategories.map((c) => {
                  const selected = categoryId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCategoryId(c.id)}
                      className="flex flex-col items-center gap-1.5 rounded-2xl border py-3 transition-all duration-150"
                      style={{
                        borderColor: selected ? `${c.color}70` : "rgba(238,242,228,0.07)",
                        background: selected ? `${c.color}12` : "transparent",
                      }}
                    >
                      <span style={{ color: c.color }}>
                        <BareIcon icon={c.icon} size={17} />
                      </span>
                      <span
                        className={`max-w-full truncate px-1 text-[10.5px] font-medium ${
                          selected ? "text-cream" : "text-mute"
                        }`}
                      >
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* date */}
            <div className="mt-5">
              <label className="eyebrow mb-2 block">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
            </div>

            {/* status and fixed expense controls */}
            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {/* Payment status toggle */}
              <button
                type="button"
                onClick={() => setIsPaid((v) => !v)}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                  isPaid
                    ? "border-accent/40 bg-accent/10 text-cream"
                    : "border-coral/40 bg-coral/10 text-cream"
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${
                    isPaid ? "bg-accent text-ink" : "border border-coral text-coral"
                  }`}
                >
                  {isPaid ? <Check size={14} strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-coral" />}
                </span>
                <div>
                  <p className="text-[12.5px] font-semibold">{isPaid ? "Pago / Recebido" : "Pendente"}</p>
                  <p className="text-[10px] text-faint">
                    {isPaid ? "Lançamento liquidado" : "Aguardando pagamento"}
                  </p>
                </div>
              </button>

              {/* Recurring fixed expense toggle */}
              <button
                type="button"
                onClick={() => setIsRecurring((v) => !v)}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                  isRecurring
                    ? "border-accent/40 bg-accent/10 text-cream"
                    : "border-line bg-cream/[0.02] text-mute hover:border-line-strong hover:text-cream"
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${
                    isRecurring ? "bg-accent text-ink" : "border border-line text-faint"
                  }`}
                >
                  <Repeat2 size={13} strokeWidth={2.4} />
                </span>
                <div>
                  <p className="text-[12.5px] font-semibold">{isRecurring ? "Gasto Fixo Ativo" : "Gasto Fixo?"}</p>
                  <p className="text-[10px] text-faint">
                    {isRecurring ? "Recriar todo mês no dia" : "Repetir nos próximos meses"}
                  </p>
                </div>
              </button>
            </div>

            {!editing && !isRecurring && (
              <div className="mt-5 rounded-2xl border border-line p-4">
                <p className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-cream">
                  <Repeat2 size={14} className="text-accent" /> Parcelamento
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="eyebrow mb-2 block">Recorrência</span>
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
                      <option value="monthly">Mensal por 12 meses</option>
                    </select>
                  </label>
                  <label>
                    <span className="eyebrow mb-2 block">Parcelas</span>
                    <select
                      className="field"
                      value={installments}
                      disabled={type !== "expense" || repeat === "monthly"}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                    >
                      {Array.from({ length: 24 }, (_, index) => index + 1).map((value) => (
                        <option key={value} value={value}>{value === 1 ? "À vista" : `${value}x`}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}

            {error && <p className="mt-4 text-[12.5px] text-coral">{error}</p>}

            <button
              onClick={submit}
              disabled={!valid || busy}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-bold text-ink transition-all duration-200 enabled:hover:brightness-110 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
              style={{ background: accent }}
            >
              {busy ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Check size={16} strokeWidth={2.8} />
              )}
              {editing
                ? "Salvar alterações"
                : type === "income"
                  ? "Adicionar receita"
                  : "Adicionar despesa"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
