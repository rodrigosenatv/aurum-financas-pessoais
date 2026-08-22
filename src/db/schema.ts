import { boolean, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    telegramChatId: text("telegram_chat_id"),
    telegramUsername: text("telegram_username"),
    telegramPairCode: text("telegram_pair_code"),
    telegramPairExpires: timestamp("telegram_pair_expires", { withTimezone: true }),
    telegramNotifyDueBills: boolean("telegram_notify_due_bills").default(true).notNull(),
    telegramNotifyBudgetLimit: boolean("telegram_notify_budget_limit").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_telegram_chat_id_unique").on(table.telegramChatId),
  ],
);

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  categoryId: integer("category_id")
    .references(() => categories.id)
    .notNull(),
  date: text("date").notNull(), // ISO yyyy-mm-dd
  isPaid: boolean("is_paid").default(true).notNull(),
  isRecurring: boolean("is_recurring").default(false).notNull(),
  seriesId: text("series_id"),
  installmentNumber: integer("installment_number"),
  installmentTotal: integer("installment_total"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  categoryId: integer("category_id")
    .references(() => categories.id)
    .notNull(),
  amountCents: integer("amount_cents").notNull(),
}, (table) => [uniqueIndex("budgets_user_category_unique").on(table.userId, table.categoryId)]);

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  targetCents: integer("target_cents").notNull(),
  currentCents: integer("current_cents").notNull().default(0),
});

export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type User = typeof users.$inferSelect;
