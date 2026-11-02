"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "@/lib/theme";

const OPTIONS: { id: ThemePreference; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Escuro", icon: Moon },
  { id: "system", label: "Sistema", icon: Monitor },
];

/** Seletor Claro / Escuro / Sistema. */
export function ThemeSegmented({ className = "", dense = false }: { className?: string; dense?: boolean }) {
  const { preference, setPreference } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Aparência"
      className={`grid grid-cols-3 gap-1 rounded-2xl border border-line bg-fg/[0.03] p-1 ${className}`}
    >
      {OPTIONS.map((option) => {
        const active = preference === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(option.id)}
            className={`flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors ${
              dense ? "min-h-9 px-1.5 text-[12px]" : "min-h-11 px-2 text-[13px]"
            } ${
              active
                ? "bg-surface text-fg shadow-[0_1px_2px_rgb(0_0_0/0.12),inset_0_0_0_1px_var(--line-strong)]"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            <option.icon size={dense ? 14 : 15} strokeWidth={2} className={active ? "text-accent" : ""} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Botão único que alterna entre claro e escuro (usado na tela de login). */
export function ThemeQuickToggle({ className = "" }: { className?: string }) {
  const { theme, setPreference } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={next === "light" ? "Usar tema claro" : "Usar tema escuro"}
      title={next === "light" ? "Tema claro" : "Tema escuro"}
      className={`icon-btn border border-line bg-surface/70 ${className}`}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
