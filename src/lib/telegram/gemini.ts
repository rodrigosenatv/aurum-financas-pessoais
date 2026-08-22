import type { Category } from "@/db/schema";

export interface ParsedTransactionResult {
  description: string;
  amountCents: number;
  type: "income" | "expense";
  categoryId?: number;
  categoryName?: string;
  date?: string; // YYYY-MM-DD
  isPaid?: boolean;
  isRecurring?: boolean;
  installments?: number;
  confidence?: number;
  rawText?: string;
}

function getGeminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? null;
}

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Resilient list of fast models ordered by preference
const GEMINI_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
];

function cleanJson(raw: string): string {
  let cleaned = raw.trim();
  // Strip markdown code block if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return cleaned.trim();
}

function normalizeAudioMimeType(mimeType?: string): string {
  if (!mimeType) return "audio/ogg";
  const clean = mimeType.split(";")[0].trim().toLowerCase();
  if (clean === "audio/oga" || clean === "audio/opus") return "audio/ogg";
  if (clean === "audio/mp3") return "audio/mpeg";
  return clean;
}

async function callGemini(contents: any[], systemInstruction?: string): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    console.warn("Gemini API Key não encontrada no ambiente.");
    return null;
  }

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body: any = {
      contents,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Gemini API (${model}) Error ${response.status}:`, errText);
        // If 404 or 503 or 429, try next model in fallback list
        continue;
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      if (text) {
        return cleanJson(text);
      }
    } catch (err: any) {
      console.error(`Falha ao chamar Gemini model (${model}):`, err?.message || err);
      // Try next model
      continue;
    }
  }

  return null;
}

function buildCategoryContext(categories: Category[]): string {
  return categories
    .map(
      (c) =>
        `• ID ${c.id}: "${c.name}" [Tipo: ${c.type === "income" ? "RECEITA" : "DESPESA"}]`,
    )
    .join("\n");
}

export function matchCategory(
  suggestedId: number | undefined,
  suggestedName: string | undefined,
  type: "income" | "expense",
  categories: Category[],
  extraText = "",
): { id: number; name: string } | undefined {
  const typeCategories = categories.filter((c) => c.type === type);
  if (typeCategories.length === 0) return undefined;

  // 1. Direct ID match if valid for type
  if (suggestedId) {
    const byId = typeCategories.find((c) => c.id === suggestedId);
    if (byId) return { id: byId.id, name: byId.name };
  }

  // 2. Exact or substring match by suggested name
  if (suggestedName) {
    const sLower = suggestedName.toLowerCase().trim();
    const exact = typeCategories.find((c) => c.name.toLowerCase() === sLower);
    if (exact) return { id: exact.id, name: exact.name };

    const contains = typeCategories.find(
      (c) =>
        c.name.toLowerCase().includes(sLower) ||
        sLower.includes(c.name.toLowerCase()),
    );
    if (contains) return { id: contains.id, name: contains.name };

    // Partial word match (e.g., "Mercado" matching "Alimentação & Mercado")
    const words = sLower.split(/[\s&/,\-]+/).filter((w) => w.length > 2);
    for (const w of words) {
      const matchWord = typeCategories.find((c) => c.name.toLowerCase().includes(w));
      if (matchWord) return { id: matchWord.id, name: matchWord.name };
    }
  }

  // 3. Deep semantic keyword matching using combined text (description + context)
  const fullText = `${suggestedName || ""} ${extraText}`.toLowerCase();

  // Keyword-to-category semantic heuristics for Portuguese
  const semanticRules: { patterns: RegExp[]; matchFn: (name: string) => boolean }[] = [
    {
      patterns: [/(almo[cç]o|jantar|lanche|caf[eé]|mercado|supermercado|padaria|a[cç]ougue|hortifruti|feira|ifood|uber\s*eats|rappi|restaurante|pizzaria|hamburguer|comida|marmita|bebida)/i],
      matchFn: (name) => /(alimenta|mercado|comida|refei)/i.test(name),
    },
    {
      patterns: [/(gasolina|combust[ií]vel|etanol|diesel|posto|shell|ipiranga|petrobras|uber|99|t[aá]xi|estacionamento|ped[aá]gio|mec[aâ]nico|oficina|ipva|onibus|[oô]nibus|metr[oô]|passagem)/i],
      matchFn: (name) => /(transporte|auto|ve[ií]culo|carro|combust)/i.test(name),
    },
    {
      patterns: [/(aluguel|condom[ií]nio|iptu|reforma|pedreiro|eletricista|pintor|m[oó]veis|casa|imobili[aá]ria)/i],
      matchFn: (name) => /(moradia|habita[cç]|casa|im[oó]vel)/i.test(name),
    },
    {
      patterns: [/(luz|energia|enel|cpfl|cemig|copel|sabesp|embasa|[aá]gua|esgoto|g[aá]s|comg[aá]s|ultragaz|internet|claro|vivo|tim|oi|telefone|celular|netflix|spotify|amazon|prime|streaming|assinatura)/i],
      matchFn: (name) => /(contas|servi[cç]|utilidades)/i.test(name),
    },
    {
      patterns: [/(cart[aã]o|fatura|nubank|inter|c6|ita[uú]|bradesco|santander|empr[eé]stimo|financiamento|juros|parcela|d[ií]vida|consignado)/i],
      matchFn: (name) => /(d[ií]vidas|cart[oõ]es|empr[eé]stimo|banco)/i.test(name),
    },
    {
      patterns: [/(unha|sal[aã]o|barba|corte|cabelo|est[eé]tica|cosm[eé]tico|perfumaria|roupa|vestu[aá]rio|sapato|t[eê]nis|presente|filho|escola|mensalidade|m[aã]e|pai|fam[ií]lia|pessoal)/i],
      matchFn: (name) => /(fam[ií]lia|pessoal|cuidados|vestu[aá]rio)/i.test(name),
    },
    {
      patterns: [/(farm[aá]cia|rem[eé]dio|drogaria|drogasil|droga\s*raia|pague\s*menos|consulta|m[eé]dico|dentista|exame|hospital|plano\s*de\s*sa[uú]de|unimed|academia|smart\s*fit|gym|suplemento|cinema|teatro|show|passeio|viagem|hotel|praia|lazer|esporte|futebol)/i],
      matchFn: (name) => /(sa[uú]de|lazer|bem-estar|entreten)/i.test(name),
    },
    {
      patterns: [/(investimento|a[cç][oõ]es|fii|tesouro|selic|cdb|reserva|poupan[cç]a|cripto|bitcoin|aporte)/i],
      matchFn: (name) => /(investimento|reserva|aplica[cç])/i.test(name),
    },
    {
      patterns: [/(sal[aá]rio|holerite|pagamento|adicional|13[oº]|f[eé]rias|pr[oó]-?labore)/i],
      matchFn: (name) => /(sal[aá]rio|ordenado|folha)/i.test(name),
    },
    {
      patterns: [/(freela|freelance|projeto|consultoria|bico|prestador|servi[cç]o\s*prestado)/i],
      matchFn: (name) => /(freelance|freela|servi[cç]os|aut[oô]nomo)/i.test(name),
    },
    {
      patterns: [/(renda\s*extra|reembolso|cashback|venda|desapego|olx|enjoei|mercado\s*livre|dividendos|rendimento|presente\s*recebido|pix\s*recebido)/i],
      matchFn: (name) => /(renda\s*extra|reembolso|outras\s*receitas)/i.test(name),
    },
  ];

  for (const rule of semanticRules) {
    const isMatched = rule.patterns.some((p) => p.test(fullText));
    if (isMatched) {
      const found = typeCategories.find((c) => rule.matchFn(c.name));
      if (found) return { id: found.id, name: found.name };
    }
  }

  // 4. Fallback to general category or first category of type
  const fallback =
    typeCategories.find((c) => /(geral|outr|diversos)/i.test(c.name)) ||
    typeCategories[0];

  return fallback ? { id: fallback.id, name: fallback.name } : undefined;
}

function parseNumericAmount(val: any): number | null {
  if (typeof val === "number") {
    if (val <= 0) return null;
    // If it's already in cents (integer > 500 without decimals) or decimal (e.g. 45.5)
    // We expect amountCents in the prompt, but if model sends decimal (45.50), convert to 4550
    if (Number.isInteger(val) && val >= 100) return val;
    return Math.round(val * 100);
  }
  if (typeof val === "string") {
    const clean = val.replace(/[R$\s]/gi, "").replace(",", ".");
    const num = parseFloat(clean);
    if (!isNaN(num) && num > 0) {
      // If prompt asked for cents but model sent "4550"
      if (Number.isInteger(num) && num >= 100 && !val.includes(".")) {
        return Math.round(num);
      }
      return Math.round(num * 100);
    }
  }
  return null;
}

export async function parseAudioWithGemini(
  audioBuffer: Buffer,
  rawMimeType: string,
  categories: Category[],
): Promise<ParsedTransactionResult | null> {
  const today = getTodayIso();
  const mimeType = normalizeAudioMimeType(rawMimeType);
  const categoriesContext = buildCategoryContext(categories);

  const systemInstruction = `Você é o assistente de inteligência financeira de alta precisão do app Aurum.
Sua missão é ouvir o áudio de voz do usuário, transcrever o que ele disse e extrair os dados da transação financeira com precisão.

DATA DE HOJE: ${today}.

CATEGORIAS DO USUÁRIO (escolha estritamente o ID mais adequado):
${categoriesContext}

Regras:
1. "transcription": transcrição exata e fiel do que o usuário falou em português.
2. "description": descrição limpa, concisa e profissional da transação (ex: "Almoço", "Gasolina Posto Shell", "Unha", "Salário").
3. "amountCents": valor monetário convertido para CENTAVOS inteiros (ex: R$ 45,00 -> 4500; R$ 12,50 -> 1250; 50 reais -> 5000; "quarenta e cinco reais" -> 4500).
4. "type": "expense" para gastos/compras/pagamentos ou "income" para entradas/receitas/salário/recebimentos.
5. "categoryId": número inteiro do ID da categoria selecionada da lista acima.
6. "categoryName": nome exato da categoria selecionada.
7. "date": data informada no áudio (YYYY-MM-DD) ou a de hoje (${today}).
8. "isPaid": true se já foi pago, false se o áudio indicar que é pendente/boleto a pagar/vence dia...
9. "isRecurring": true se disser fixo/todo mês/mensal/recorrente.
10. "installments": número de parcelas se for parcelado (ex: "em 3x" -> 3).

Retorne ESTRITAMENTE um JSON com esta estrutura:
{
  "transcription": string,
  "description": string,
  "amountCents": number,
  "type": "expense" | "income",
  "categoryId": number,
  "categoryName": string,
  "date": string,
  "isPaid": boolean,
  "isRecurring": boolean,
  "installments"?: number
}`;

  const base64Audio = audioBuffer.toString("base64");

  const contents = [
    {
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Audio,
          },
        },
        {
          text: "Ouça e transcreva este áudio de finanças pessoais e extraia a transação financeira em JSON.",
        },
      ],
    },
  ];

  try {
    const rawJson = await callGemini(contents, systemInstruction);
    if (!rawJson) return null;

    const parsed = JSON.parse(rawJson);
    const amountCents = parseNumericAmount(parsed.amountCents ?? parsed.amount ?? parsed.valor);
    if (!amountCents) return null;

    const type: "income" | "expense" = parsed.type === "income" ? "income" : "expense";
    const cat = matchCategory(
      parsed.categoryId ? Number(parsed.categoryId) : undefined,
      parsed.categoryName,
      type,
      categories,
      `${parsed.description || ""} ${parsed.transcription || ""}`,
    );

    return {
      description: String(parsed.description || parsed.transcription || "Lançamento por Áudio").trim(),
      amountCents,
      type,
      categoryId: cat?.id,
      categoryName: cat?.name,
      date: parsed.date || today,
      isPaid: typeof parsed.isPaid === "boolean" ? parsed.isPaid : true,
      isRecurring: Boolean(parsed.isRecurring),
      installments: parsed.installments && Number(parsed.installments) > 1 ? Number(parsed.installments) : undefined,
      rawText: parsed.transcription,
    };
  } catch (error) {
    console.error("Erro ao processar áudio com Gemini:", error);
    return null;
  }
}

export async function parseReceiptWithGemini(
  imageBuffer: Buffer,
  mimeType: string,
  categories: Category[],
): Promise<ParsedTransactionResult | null> {
  const today = getTodayIso();
  const categoriesContext = buildCategoryContext(categories);

  const systemInstruction = `Você é o assistente financeiro do app Aurum especializado em OCR de notas fiscais, cupons, comprovantes de PIX, boletos e recibos.
Analise a imagem e extraia os dados financeiros com precisão.

DATA DE HOJE: ${today}.

CATEGORIAS DO USUÁRIO:
${categoriesContext}

Retorne estritamente um JSON com a seguinte estrutura:
{
  "description": "nome do estabelecimento ou descrição clara (ex: Supermercado Carrefour, Posto Ipiranga, Farmácia Raia)",
  "amountCents": 12590, // valor total em CENTAVOS inteiros
  "type": "expense" ou "income",
  "categoryId": number,
  "categoryName": "nome da categoria selecionada",
  "date": "YYYY-MM-DD",
  "isPaid": true,
  "confidence": 0.95
}`;

  const base64Image = imageBuffer.toString("base64");

  const contents = [
    {
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: base64Image,
          },
        },
        {
          text: "Analise este comprovante / nota fiscal e extraia os dados financeiros em JSON.",
        },
      ],
    },
  ];

  try {
    const rawJson = await callGemini(contents, systemInstruction);
    if (!rawJson) return null;

    const parsed = JSON.parse(rawJson);
    const amountCents = parseNumericAmount(parsed.amountCents ?? parsed.amount ?? parsed.valor);
    if (!amountCents) return null;

    const desc = parsed.description || parsed.establishment || "Comprovante / Recibo";
    const type: "income" | "expense" = parsed.type === "income" ? "income" : "expense";
    const cat = matchCategory(
      parsed.categoryId ? Number(parsed.categoryId) : undefined,
      parsed.categoryName,
      type,
      categories,
      desc,
    );

    return {
      description: String(desc).trim(),
      amountCents,
      type,
      categoryId: cat?.id,
      categoryName: cat?.name,
      date: parsed.date || today,
      isPaid: typeof parsed.isPaid === "boolean" ? parsed.isPaid : true,
      confidence: parsed.confidence,
    };
  } catch (error) {
    console.error("Erro ao analisar comprovante com Gemini:", error);
    return null;
  }
}

export async function parseTextWithGemini(
  text: string,
  categories: Category[],
): Promise<ParsedTransactionResult | null> {
  const today = getTodayIso();
  const categoriesContext = buildCategoryContext(categories);

  const systemInstruction = `Você é o parser financeiro de inteligência artificial do app Aurum.
Identifique se a mensagem do usuário representa o registro de uma transação financeira (despesa ou receita).

DATA DE REFERÊNCIA DE HOJE: ${today}.

CATEGORIAS DO USUÁRIO:
${categoriesContext}

Se a mensagem for uma intenção de registrar receita ou despesa, retorne estritamente um JSON:
{
  "isTransaction": true,
  "description": "descrição limpa e elegante",
  "amountCents": 4500, // valor em centavos
  "type": "expense" ou "income",
  "categoryId": number,
  "categoryName": "nome exato da categoria",
  "date": "YYYY-MM-DD",
  "isPaid": true ou false,
  "isRecurring": false,
  "installments": 1
}

Se a mensagem NÃO for um lançamento de transação (ex: saudação, pergunta genérica), retorne:
{
  "isTransaction": false
}`;

  const contents = [
    {
      role: "user",
      parts: [{ text }],
    },
  ];

  try {
    const rawJson = await callGemini(contents, systemInstruction);
    if (!rawJson) return null;

    const parsed = JSON.parse(rawJson);
    if (!parsed.isTransaction) return null;

    const amountCents = parseNumericAmount(parsed.amountCents ?? parsed.amount ?? parsed.valor);
    if (!amountCents) return null;

    const type: "income" | "expense" = parsed.type === "income" ? "income" : "expense";
    const cat = matchCategory(
      parsed.categoryId ? Number(parsed.categoryId) : undefined,
      parsed.categoryName,
      type,
      categories,
      `${parsed.description || ""} ${text}`,
    );

    return {
      description: String(parsed.description || text).trim(),
      amountCents,
      type,
      categoryId: cat?.id,
      categoryName: cat?.name,
      date: parsed.date || today,
      isPaid: typeof parsed.isPaid === "boolean" ? parsed.isPaid : true,
      isRecurring: Boolean(parsed.isRecurring),
      installments: parsed.installments && Number(parsed.installments) > 1 ? Number(parsed.installments) : undefined,
    };
  } catch (error) {
    console.error("Erro ao analisar texto com Gemini:", error);
    return null;
  }
}

