"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import type { TxnType } from "@/lib/types";

/**
 * Caixa "pago / pendente" com alvo de toque de 44px (o visual tem 24px).
 * Exposta como checkbox para leitores de tela.
 */
export function PaidToggle({
  paid,
  kind,
  label,
  busy = false,
  onToggle,
}: {
  paid: boolean;
  kind: TxnType;
  label: string;
  busy?: boolean;
  onToggle: () => void;
}) {
  const done = kind === "income" ? "recebida" : "paga";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={paid}
      aria-label={`${label} — ${paid ? done : "pendente"}`}
      title={paid ? "Marcar como pendente" : `Marcar como ${done}`}
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className="group/paid -m-1 grid h-11 w-11 shrink-0 place-items-center rounded-xl disabled:opacity-60"
    >
      <span
        className={`grid h-6 w-6 place-items-center rounded-lg transition-colors ${
          paid
            ? "bg-accent/15 text-accent ring-1 ring-accent/35 group-hover/paid:bg-accent/25"
            : "border-2 border-warning/80 bg-warning/10 group-hover/paid:bg-warning/20"
        }`}
      >
        {paid ? <Check size={14} strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-warning" />}
      </span>
    </button>
  );
}

/** Linha com interruptor (role="switch"), alvo de toque generoso. */
export function SwitchRow({
  checked,
  onChange,
  title,
  description,
  icon,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-fg/[0.02] px-3.5 py-3 text-left transition-colors hover:border-line-strong disabled:opacity-50"
    >
      {icon && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-fg/[0.05] text-fg-muted">{icon}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-fg">{title}</span>
        {description && <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-subtle">{description}</span>}
      </span>
      <span
        aria-hidden
        className={`relative h-[26px] w-11 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-primary" : "bg-fg/20"
        }`}
      >
        <span
          className={`absolute top-[3px] left-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-200 ${
            checked ? "translate-x-[18px]" : ""
          }`}
        />
      </span>
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center px-4 text-center ${compact ? "py-6" : "py-12"}`}>
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-fg/[0.03] text-fg-subtle">
        {icon}
      </span>
      <p className="mt-3.5 font-display text-[15px] font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-[34ch] text-[13px] leading-relaxed text-fg-muted">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
