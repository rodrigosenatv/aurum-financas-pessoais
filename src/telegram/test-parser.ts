import { parseNaturalLanguage } from "../lib/telegram/parser";
import type { Category } from "../db/schema";

const mockCategories: Category[] = [
  { id: 1, userId: 1, name: "Alimentação", icon: "Utensils", color: "#FFB020", type: "expense" },
  { id: 2, userId: 1, name: "Transporte", icon: "Car", color: "#4E7BFF", type: "expense" },
  { id: 3, userId: 1, name: "Moradia", icon: "Home", color: "#9B51E0", type: "expense" },
  { id: 4, userId: 1, name: "Saúde", icon: "HeartPulse", color: "#FF4D4F", type: "expense" },
  { id: 5, userId: 1, name: "Lazer", icon: "Gamepad2", color: "#00C48C", type: "expense" },
  { id: 6, userId: 1, name: "Salário", icon: "Briefcase", color: "#B7F34B", type: "income" },
  { id: 7, userId: 1, name: "Freelance", icon: "Laptop", color: "#54C4F0", type: "income" },
];

const testCases = [
  {
    input: "Almoço 45,90 alimentação",
    expectedAmount: 4590,
    expectedType: "expense",
    expectedCategory: "Alimentação",
    expectedPaid: true,
  },
  {
    input: "Uber 28,50 transporte pendente",
    expectedAmount: 2850,
    expectedType: "expense",
    expectedCategory: "Transporte",
    expectedPaid: false,
  },
  {
    input: "Salário 4800",
    expectedAmount: 480000,
    expectedType: "income",
    expectedCategory: "Salário",
    expectedPaid: true,
  },
  {
    input: "Notebook 3000 em 10x",
    expectedAmount: 300000,
    expectedInstallments: 10,
    expectedType: "expense",
  },
  {
    input: "Internet 119 recorrente dia 15",
    expectedAmount: 11900,
    expectedRecurring: true,
  },
  {
    input: "R$ 1.250,00 aluguel pendente",
    expectedAmount: 125000,
    expectedType: "expense",
    expectedCategory: "Moradia",
    expectedPaid: false,
  },
  {
    input: "5k freela",
    expectedAmount: 500000,
    expectedType: "income",
  },
  {
    input: "/despesa 50 mercado",
    expectedAmount: 5000,
    expectedType: "expense",
    expectedCategory: "Alimentação",
  },
  {
    input: "/receita 350 venda",
    expectedAmount: 35000,
    expectedType: "income",
  },
];

console.log("=== Testando Parser Léxico de Linguagem Natural ===");
let passed = 0;

for (const tc of testCases) {
  const result = parseNaturalLanguage(tc.input, mockCategories);
  if (!result) {
    console.error(`❌ Falha: "${tc.input}" retornou null`);
    continue;
  }

  let ok = true;
  if (result.amountCents !== tc.expectedAmount) {
    console.error(`❌ Valor incorreto para "${tc.input}": esperado ${tc.expectedAmount}, obteve ${result.amountCents}`);
    ok = false;
  }
  if (tc.expectedType && result.type !== tc.expectedType) {
    console.error(`❌ Tipo incorreto para "${tc.input}": esperado ${tc.expectedType}, obteve ${result.type}`);
    ok = false;
  }
  if (tc.expectedCategory && result.categoryName !== tc.expectedCategory) {
    console.error(`❌ Categoria incorreta para "${tc.input}": esperado ${tc.expectedCategory}, obteve ${result.categoryName}`);
    ok = false;
  }
  if (tc.expectedPaid !== undefined && result.isPaid !== tc.expectedPaid) {
    console.error(`❌ Status de pago incorreto para "${tc.input}": esperado ${tc.expectedPaid}, obteve ${result.isPaid}`);
    ok = false;
  }
  if (tc.expectedInstallments && result.installments !== tc.expectedInstallments) {
    console.error(`❌ Parcelas incorretas para "${tc.input}": esperado ${tc.expectedInstallments}, obteve ${result.installments}`);
    ok = false;
  }
  if (tc.expectedRecurring && !result.isRecurring) {
    console.error(`❌ Recorrência não detectada para "${tc.input}"`);
    ok = false;
  }

  if (ok) {
    console.log(`✅ [OK] "${tc.input}" -> Desc: "${result.description}" | Valor: R$ ${(result.amountCents / 100).toFixed(2)} | Tipo: ${result.type} | Cat: ${result.categoryName} | Pago: ${result.isPaid} | Parc: ${result.installments ?? 1}x | Data: ${result.date}`);
    passed++;
  }
}

console.log(`\nResultado: ${passed}/${testCases.length} testes passaram com sucesso!\n`);
