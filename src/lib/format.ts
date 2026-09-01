import type { TxnType } from "./types";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const brlCents = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format integer cents as R$ — round values without cents, others with. */
export function fmt(cents: number, withCents = false): string {
  return (withCents ? brlCents : brl).format(cents / 100);
}

export function fmtSigned(cents: number, type: TxnType): string {
  const v = brlCents.format(cents / 100);
  return type === "income" ? `+ ${v}` : `− ${v}`;
}

/** Compact axis labels: 12,3 mil / 1,2 mi */
export function fmtAxis(cents: number): string {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000)
    return `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(v) >= 1000)
    return `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${Math.round(v)}`;
}

export function monthKey(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function keyFromISO(date: string): string {
  return date.slice(0, 7);
}

/** Parse ISO date as LOCAL date (avoids timezone day-shift). */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function monthLabel(y: number, m: number): string {
  return capitalize(new Date(y, m, 1).toLocaleDateString("pt-BR", { month: "long" }));
}

export function fullMonthLabel(y: number, m: number): string {
  return `${monthLabel(y, m)} ${y}`;
}

export function shortMonthLabel(y: number, m: number): string {
  const raw = new Date(y, m, 1).toLocaleDateString("pt-BR", { month: "short" });
  return raw.replace(".", "");
}

export function dayLabel(iso: string): string {
  const d = parseISODate(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

export function fullDayLabel(iso: string): string {
  const d = parseISODate(iso);
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "long" });
  const base = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  return `${capitalize(weekday)}, ${base}`;
}

export function todayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(
    n.getDate(),
  ).padStart(2, "0")}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Boa noite";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function todayLong(): string {
  return capitalize(
    new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );
}

/** "1.234,56" or "1234.56" → 123456 */
export function parseAmount(str: string): number | null {
  const clean = str.trim().replace(/[^\d.,-]/g, "");
  const comma = clean.lastIndexOf(",");
  const dot = clean.lastIndexOf(".");
  let normalized: string;
  if (comma >= 0) {
    normalized =
      clean.slice(0, comma).replace(/[.,]/g, "") +
      "." +
      clean.slice(comma + 1).replace(/[.,]/g, "");
  } else if (dot >= 0) {
    normalized =
      clean.slice(0, dot).replace(/\./g, "") +
      "." +
      clean.slice(dot + 1).replace(/\./g, "");
  } else {
    normalized = clean;
  }
  const v = Number.parseFloat(normalized);
  if (Number.isNaN(v)) return null;
  return Math.max(0, Math.round(v * 100));
}

/**
 * Formats user input as Brazilian currency with auto-calculated decimal places and comma.
 * e.g. "9" -> "0,09", "90" -> "0,90", "900" -> "9,00", "9000" -> "90,00", "900000" -> "9.000,00".
 * Allows only digits and handles backspacing and typing seamlessly.
 */
export function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  const num = parseInt(digits, 10);
  if (num === 0) return "";
  return (num / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Formats integer cents directly to the masked input string format (e.g. 9000 -> "90,00") */
export function centsToInput(cents: number): string {
  if (!cents || cents <= 0) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const d = new Date(y, m + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}

export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(999, Math.round((part / whole) * 100));
}
