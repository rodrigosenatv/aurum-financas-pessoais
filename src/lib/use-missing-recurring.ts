"use client";

import { useMemo } from "react";
import { keyFromISO } from "./format";
import type { TransactionDTO } from "./types";

const signature = (t: TransactionDTO) => `${t.type}:${t.categoryId}:${t.description.trim().toLowerCase()}`;

/**
 * Lançamentos marcados como fixos em algum mês que ainda não existem no mês
 * `key` (yyyy-mm) — o que o botão "Importar fixos" vai criar.
 */
export function useMissingRecurring(transactions: TransactionDTO[], key: string) {
  return useMemo(() => {
    const templates = new Map<string, TransactionDTO>();
    for (const item of transactions) {
      if (!item.isRecurring) continue;
      const k = signature(item);
      if (!templates.has(k)) templates.set(k, item);
    }
    if (templates.size === 0) return { items: [] as TransactionDTO[], expenses: 0, incomes: 0 };

    const present = new Set(transactions.filter((t) => keyFromISO(t.date) === key).map(signature));
    const items = [...templates.entries()].filter(([k]) => !present.has(k)).map(([, t]) => t);
    return {
      items,
      expenses: items.filter((t) => t.type === "expense").length,
      incomes: items.filter((t) => t.type === "income").length,
    };
  }, [transactions, key]);
}

/** "3 despesas e 1 receita" */
export function describeCounts(expenses: number, incomes: number): string {
  const parts: string[] = [];
  if (expenses > 0) parts.push(`${expenses} ${expenses === 1 ? "despesa" : "despesas"}`);
  if (incomes > 0) parts.push(`${incomes} ${incomes === 1 ? "receita" : "receitas"}`);
  return parts.join(" e ");
}
