import type { Category } from "@/db/schema";
import type { ParsedTransactionResult } from "./gemini";

const INCOME_KEYWORDS = [
  "salario",
  "salário",
  "recebi",
  "receita",
  "rendimento",
  "freela",
  "freelance",
  "prolabore",
  "pro-labore",
  "venda",
  "ganhei",
  "deposito",
  "depósito",
  "dividendos",
  "reembolso",
  "pix recebido",
  "cashback",
];

const EXPENSE_KEYWORDS = [
  "gastei",
  "comprei",
  "paguei",
  "despesa",
  "conta",
  "boleto",
  "almoco",
  "almoço",
  "jantar",
  "lanche",
  "mercado",
  "supermercado",
  "padaria",
  "farmacia",
  "farmácia",
  "uber",
  "99",
  "taxi",
  "gasolina",
  "combustivel",
  "combustível",
  "estacionamento",
  "aluguel",
  "condominio",
  "condomínio",
  "internet",
  "luz",
  "agua",
  "água",
  "cartao",
  "cartão",
  "fatura",
];

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseAmountToCents(amountStr: string): number | null {
  if (!amountStr) return null;
  // Replace R$, $, spaces
  let clean = amountStr.replace(/[R$\s]/gi, "").trim();

  // If format is like 1.250,50
  if (clean.includes(".") && clean.includes(",")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (clean.includes(",")) {
    // Format 45,50
    clean = clean.replace(",", ".");
  }

  // Handle 'k' multiplier e.g. 1.5k or 5k
  if (clean.toLowerCase().endsWith("k")) {
    const num = parseFloat(clean.slice(0, -1));
    if (!isNaN(num)) return Math.round(num * 1000 * 100);
  }

  const num = parseFloat(clean);
  if (isNaN(num) || num <= 0) return null;
  return Math.round(num * 100);
}

export function parseNaturalLanguage(text: string, categories: Category[]): ParsedTransactionResult | null {
  if (!text || typeof text !== "string") return null;
  const raw = text.trim();
  if (raw.startsWith("/") && !raw.startsWith("/despesa") && !raw.startsWith("/receita") && !raw.startsWith("/pendente")) {
    return null;
  }

  let cleaned = raw;

  // Check explicit command prefixes
  let forceType: "income" | "expense" | null = null;
  let forcePending = false;

  if (cleaned.startsWith("/despesa")) {
    forceType = "expense";
    cleaned = cleaned.replace(/^\/despesa\s*/i, "");
  } else if (cleaned.startsWith("/receita")) {
    forceType = "income";
    cleaned = cleaned.replace(/^\/receita\s*/i, "");
  } else if (cleaned.startsWith("/pendente")) {
    forceType = "expense";
    forcePending = true;
    cleaned = cleaned.replace(/^\/pendente\s*/i, "");
  }

  // 1. Detect installments (e.g. 3x, 12x, em 6x, 10 parcelas, 4 vezes)
  let installments: number | undefined;
  const instMatch = cleaned.match(/\b(?:em\s+)?(\d{1,2})\s*(?:x|vezes|parcelas)\b/i);
  if (instMatch) {
    const count = parseInt(instMatch[1], 10);
    if (count > 1 && count <= 48) {
      installments = count;
      cleaned = cleaned.replace(instMatch[0], " ").trim();
    }
  }

  // 2. Detect recurring (recorrente, fixo, fixa, todo mes, mensal)
  let isRecurring = false;
  const recurMatch = cleaned.match(/\b(recorrente|fixo|fixa|todo\s+m[eê]s|mensal)\b/i);
  if (recurMatch) {
    isRecurring = true;
    cleaned = cleaned.replace(recurMatch[0], " ").trim();
  }

  // 3. Detect payment status (pago, pendente, a pagar, a vencer)
  let isPaid = !forcePending;
  if (!forcePending) {
    if (/\b(pendente|a\s+vencer|a\s+pagar|n[aã]o\s+pago)\b/i.test(cleaned)) {
      isPaid = false;
      cleaned = cleaned.replace(/\b(pendente|a\s+vencer|a\s+pagar|n[aã]o\s+pago)\b/gi, " ").trim();
    } else if (/\b(pago|paga|liquidado|quitado)\b/i.test(cleaned)) {
      isPaid = true;
      cleaned = cleaned.replace(/\b(pago|paga|liquidado|quitado)\b/gi, " ").trim();
    }
  }

  // 4. Detect date (hoje, ontem, amanha, dia X, DD/MM, YYYY-MM-DD)
  let targetDate = getTodayIso();
  const now = new Date();

  if (/\b(hoje)\b/i.test(cleaned)) {
    cleaned = cleaned.replace(/\bhoje\b/gi, " ").trim();
  } else if (/\b(ontem)\b/i.test(cleaned)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    targetDate = d.toISOString().slice(0, 10);
    cleaned = cleaned.replace(/\bontem\b/gi, " ").trim();
  } else if (/\b(amanh[aã])\b/i.test(cleaned)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    targetDate = d.toISOString().slice(0, 10);
    cleaned = cleaned.replace(/\bamanh[aã]\b/gi, " ").trim();
  } else {
    // Matches "dia 15" or "dia 05"
    const dayMatch = cleaned.match(/\bdia\s+(\d{1,2})\b/i);
    if (dayMatch) {
      const dayNum = parseInt(dayMatch[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(dayNum).padStart(2, "0");
        targetDate = `${y}-${m}-${d}`;
        cleaned = cleaned.replace(dayMatch[0], " ").trim();
      }
    } else {
      // Matches "15/08" or "15/08/2026"
      const dateSlashMatch = cleaned.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
      if (dateSlashMatch) {
        const d = String(parseInt(dateSlashMatch[1], 10)).padStart(2, "0");
        const m = String(parseInt(dateSlashMatch[2], 10)).padStart(2, "0");
        let y = dateSlashMatch[3] ? parseInt(dateSlashMatch[3], 10) : now.getFullYear();
        if (y < 100) y += 2000;
        targetDate = `${y}-${m}-${d}`;
        cleaned = cleaned.replace(dateSlashMatch[0], " ").trim();
      }
    }
  }

  // 5. Extract amount in BRL (e.g., R$ 45,90, 45.90, 45,90, 120, 1500, 1.250,00)
  // Regex looks for R$ 45,90 or standalone numbers like 45,90 or 45
  const amountRegex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)(?:\s*(?:reais|k))?\b/i;
  const amountMatch = cleaned.match(amountRegex);

  if (!amountMatch) {
    return null;
  }

  const amountCents = parseAmountToCents(amountMatch[0]);
  if (!amountCents) return null;

  // Remove the matched amount string from the text to get remaining description + category
  cleaned = cleaned.replace(amountMatch[0], " ").replace(/\s+/g, " ").trim();

  // 6. Match category and determine transaction type
  const lowerAll = (raw + " " + cleaned).toLowerCase();

  let detectedType: "income" | "expense" = forceType ?? "expense";
  if (!forceType) {
    const isIncomeWord = INCOME_KEYWORDS.some((kw) => lowerAll.includes(kw));
    const isExpenseWord = EXPENSE_KEYWORDS.some((kw) => lowerAll.includes(kw));
    if (isIncomeWord && !isExpenseWord) {
      detectedType = "income";
    }
  }

  // Find best matching category by name or keywords
  let bestCategory: Category | undefined;

  // First check if any category name is explicitly typed
  for (const cat of categories) {
    if (cat.type === detectedType) {
      const catNameLower = cat.name.toLowerCase();
      if (cleaned.toLowerCase().includes(catNameLower)) {
        bestCategory = cat;
        // Remove category name from description
        cleaned = cleaned.replace(new RegExp(`\\b${catNameLower}\\b`, "gi"), " ").trim();
        break;
      }
    }
  }

  // If no direct category name match, infer category from keywords
  if (!bestCategory) {
    for (const cat of categories) {
      if (cat.type === detectedType) {
        const catName = cat.name.toLowerCase();
        if (catName.includes("alimenta") || catName.includes("comida") || catName.includes("refei")) {
          if (/(lanche|almo[cç]o|jantar|mercado|supermercado|padaria|restaurante|ifood|pizza|hamburguer)/i.test(lowerAll)) {
            bestCategory = cat;
            break;
          }
        } else if (catName.includes("transporte") || catName.includes("veiculo") || catName.includes("carro")) {
          if (/(uber|99|taxi|gasolina|combust[ií]vel|estacionamento|ped[aá]gio|metro|metr[oô]|onibus|[oô]nibus)/i.test(lowerAll)) {
            bestCategory = cat;
            break;
          }
        } else if (catName.includes("moradia") || catName.includes("casa") || catName.includes("habitac")) {
          if (/(aluguel|condom[ií]nio|luz|enel|agua|[aá]gua|sabesp|internet|iptu|gas|g[aá]s)/i.test(lowerAll)) {
            bestCategory = cat;
            break;
          }
        } else if (catName.includes("saude") || catName.includes("saúde")) {
          if (/(farm[aá]cia|remedio|rem[eé]dio|consulta|m[eé]dico|dentista|exame|hospital)/i.test(lowerAll)) {
            bestCategory = cat;
            break;
          }
        } else if (catName.includes("lazer") || catName.includes("entreten")) {
          if (/(cinema|streaming|netflix|spotify|jogo|bar|balada|passeio|viagem|show)/i.test(lowerAll)) {
            bestCategory = cat;
            break;
          }
        } else if (catName.includes("salario") || catName.includes("salário") || catName.includes("renda")) {
          if (/(sal[aá]rio|rendimento|prolabore|freela|pagamento\s+recebido)/i.test(lowerAll)) {
            bestCategory = cat;
            break;
          }
        }
      }
    }
  }

  // Fallback to first available category of matching type
  if (!bestCategory) {
    bestCategory = categories.find((c) => c.type === detectedType);
  }

  // 7. Clean up remaining description
  let description = cleaned
    .replace(/[,\-:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If description is empty or very short, use category name or a reasonable fallback
  if (!description || description.length < 2) {
    description = bestCategory ? bestCategory.name : detectedType === "income" ? "Receita" : "Despesa";
  } else {
    // Capitalize first letter
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  return {
    description,
    amountCents,
    type: detectedType,
    categoryId: bestCategory?.id,
    categoryName: bestCategory?.name,
    date: targetDate,
    isPaid,
    isRecurring,
    installments,
  };
}
