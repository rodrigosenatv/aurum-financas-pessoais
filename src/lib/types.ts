export type TxnType = "income" | "expense";

export interface CategoryDTO {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: TxnType;
}

export interface TransactionDTO {
  id: number;
  description: string;
  amountCents: number;
  type: TxnType;
  categoryId: number;
  date: string; // ISO yyyy-mm-dd
  isPaid: boolean;
  isRecurring: boolean;
  seriesId: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  category: { name: string; icon: string; color: string };
}

export interface BudgetDTO {
  id: number;
  categoryId: number;
  amountCents: number;
}

export interface GoalDTO {
  id: number;
  name: string;
  icon: string;
  color: string;
  targetCents: number;
  currentCents: number;
}

export interface FinanceData {
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  budgets: BudgetDTO[];
  goals: GoalDTO[];
}

export interface UserDTO {
  id: number;
  name: string;
  email: string;
  telegramChatId?: string | null;
  telegramUsername?: string | null;
  telegramNotifyDueBills?: boolean;
  telegramNotifyBudgetLimit?: boolean;
}

export interface TelegramConnectInfo {
  connected: boolean;
  username?: string | null;
  chatId?: string | null;
  pairCode?: string | null;
  pairExpires?: string | null;
  notifyDueBills?: boolean;
  notifyBudgetLimit?: boolean;
  botUsername?: string | null;
}

export interface TxnPayload {
  description: string;
  amountCents: number;
  type: TxnType;
  categoryId: number;
  date: string;
  isPaid?: boolean;
  isRecurring?: boolean;
  repeat?: "none" | "monthly";
  installments?: number;
}
