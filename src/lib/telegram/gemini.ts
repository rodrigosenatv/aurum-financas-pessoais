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

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function callGemini(contents: any[], systemInstruction?: string): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const url = `${GEMINI_API_URL}?key=${apiKey}`;
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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini API Error:", response.status, errText);
    return null;
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  return text ?? null;
}

function matchCategory(
  suggestedName: string | undefined,
  type: "income" | "expense",
  categories: Category[],
): { id: number; name: string } | undefined {
  if (!suggestedName) return undefined;
  const lower = suggestedName.toLowerCase().trim();

  // Exact or contains match for same type
  const match = categories.find(
    (c) => c.type === type && (c.name.toLowerCase() === lower || c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())),
  );
  if (match) return { id: match.id, name: match.name };

  // Fallback to first category of same type
  const firstOfType = categories.find((c) => c.type === type);
  if (firstOfType) return { id: firstOfType.id, name: firstOfType.name };

  return undefined;
}

export async function parseAudioWithGemini(
  audioBuffer: Buffer,
  mimeType: string,
  categories: Category[],
): Promise<ParsedTransactionResult | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const today = getTodayIso();
  const categoryList = categories.map((c) => `${c.name} (${c.type === "income" ? "Receita" : "Despesa"})`).join(", ");

  const systemInstruction = `Você é o assistente financeiro do app Aurum.
Seu objetivo é ouvir o áudio do usuário e extrair os dados da transação financeira (despesa ou receita).
Data de referência de hoje: ${today}.
Categorias disponíveis no app do usuário: [${categoryList}].

Retorne estritamente um JSON com a seguinte estrutura:
{
  "transcription": "transcrição do que o usuário falou",
  "description": "descrição limpa da transação (ex: Almoço no Restaurante, Salário, Uber)",
  "amountCents": 4550, // número inteiro em centavos (ex: R$ 45,50 -> 4550)
  "type": "expense" ou "income",
  "categoryName": "nome da categoria mais adequada entre as disponíveis",
  "date": "YYYY-MM-DD", // data informada ou a de hoje (${today})
  "isPaid": true ou false, // false se disser "pendente", "para pagar", "a vencer", "vence dia..."
  "isRecurring": false, // true se disser "fixo", "todo mês", "recorrente"
  "installments": 1 // total de parcelas se for parcelado (ex: 3x -> 3)
}`;

  const base64Audio = audioBuffer.toString("base64");

  const contents = [
    {
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType: mimeType || "audio/ogg",
            data: base64Audio,
          },
        },
        {
          text: "Transcreva este áudio e extraia os dados financeiros.",
        },
      ],
    },
  ];

  try {
    const rawJson = await callGemini(contents, systemInstruction);
    if (!rawJson) return null;

    const parsed = JSON.parse(rawJson);
    if (!parsed.amountCents || !parsed.description) return null;

    const type: "income" | "expense" = parsed.type === "income" ? "income" : "expense";
    const cat = matchCategory(parsed.categoryName, type, categories);

    return {
      description: String(parsed.description).trim(),
      amountCents: Math.round(Math.abs(Number(parsed.amountCents))),
      type,
      categoryId: cat?.id,
      categoryName: cat?.name,
      date: parsed.date || today,
      isPaid: typeof parsed.isPaid === "boolean" ? parsed.isPaid : true,
      isRecurring: Boolean(parsed.isRecurring),
      installments: parsed.installments && parsed.installments > 1 ? Number(parsed.installments) : undefined,
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
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const today = getTodayIso();
  const categoryList = categories.map((c) => `${c.name} (${c.type === "income" ? "Receita" : "Despesa"})`).join(", ");

  const systemInstruction = `Você é o assistente financeiro do app Aurum especializado em OCR de recibos, comprovantes de pagamento/PIX, cupons fiscais e faturas.
Analise a imagem e extraia os dados da transação financeira.
Data de referência de hoje: ${today}.
Categorias disponíveis no app: [${categoryList}].

Retorne estritamente um JSON com a seguinte estrutura:
{
  "establishment": "nome do estabelecimento, recebedor ou pagador",
  "description": "descrição sucinta (ex: Padaria Estrela, Posto Ipiranga, Supermercado Extra)",
  "amountCents": 12590, // valor total em centavos (ex: R$ 125,90 -> 12590)
  "type": "expense" ou "income", // "income" se for comprovante de transferência recebida
  "categoryName": "nome da categoria sugerida entre as disponíveis",
  "date": "YYYY-MM-DD", // data impressa no comprovante ou ${today}
  "isPaid": true, // comprovante de pagamento já efetuado = true, boleto a vencer = false
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
          text: "Analise este comprovante / nota fiscal e extraia os dados financeiros.",
        },
      ],
    },
  ];

  try {
    const rawJson = await callGemini(contents, systemInstruction);
    if (!rawJson) return null;

    const parsed = JSON.parse(rawJson);
    if (!parsed.amountCents) return null;

    const desc = parsed.description || parsed.establishment || "Compra / Pagamento";
    const type: "income" | "expense" = parsed.type === "income" ? "income" : "expense";
    const cat = matchCategory(parsed.categoryName, type, categories);

    return {
      description: String(desc).trim(),
      amountCents: Math.round(Math.abs(Number(parsed.amountCents))),
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
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const today = getTodayIso();
  const categoryList = categories.map((c) => `${c.name} (${c.type === "income" ? "Receita" : "Despesa"})`).join(", ");

  const systemInstruction = `Você é o parser financeiro do app Aurum.
Identifique se a mensagem do usuário representa o registro de uma transação financeira (despesa ou receita).
Data de referência de hoje: ${today}.
Categorias disponíveis: [${categoryList}].

Se a mensagem for uma intenção de lançar receita/despesa, retorne estritamente um JSON:
{
  "isTransaction": true,
  "description": "descrição limpa da transação",
  "amountCents": 4500, // valor em centavos
  "type": "expense" ou "income",
  "categoryName": "categoria mais adequada",
  "date": "YYYY-MM-DD",
  "isPaid": true ou false,
  "isRecurring": false,
  "installments": 1
}

Se a mensagem NÃO for um lançamento de transação (for uma pergunta, saudação, etc), retorne:
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
    if (!parsed.isTransaction || !parsed.amountCents || !parsed.description) return null;

    const type: "income" | "expense" = parsed.type === "income" ? "income" : "expense";
    const cat = matchCategory(parsed.categoryName, type, categories);

    return {
      description: String(parsed.description).trim(),
      amountCents: Math.round(Math.abs(Number(parsed.amountCents))),
      type,
      categoryId: cat?.id,
      categoryName: cat?.name,
      date: parsed.date || today,
      isPaid: typeof parsed.isPaid === "boolean" ? parsed.isPaid : true,
      isRecurring: Boolean(parsed.isRecurring),
      installments: parsed.installments && parsed.installments > 1 ? Number(parsed.installments) : undefined,
    };
  } catch (error) {
    console.error("Erro ao analisar texto com Gemini:", error);
    return null;
  }
}
