-- =========================================================================
-- AURUM FINANÇAS PESSOAIS — SQL DE HARDENING DE SEGURANÇA E RLS (SUPABASE)
-- =========================================================================

-- 1. Criação do índice de otimização para pareamento do Telegram
CREATE INDEX IF NOT EXISTS "users_telegram_pair_code_idx" ON "users" ("telegram_pair_code");

-- 2. Habilitação de Row-Level Security (RLS) em todas as tabelas sensíveis
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Isolamento Multi-Tenant (Supabase Auth / Service Role)

-- Tabela USERS
DROP POLICY IF EXISTS "users_isolation_policy" ON "users";
CREATE POLICY "users_isolation_policy" ON "users"
  FOR ALL
  USING (
    auth.role() = 'service_role' OR
    (auth.uid() IS NOT NULL AND id = (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::integer))
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    (auth.uid() IS NOT NULL AND id = (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::integer))
  );

-- Tabela SESSIONS
DROP POLICY IF EXISTS "sessions_service_role_policy" ON "sessions";
CREATE POLICY "sessions_service_role_policy" ON "sessions"
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Tabela CATEGORIES
DROP POLICY IF EXISTS "categories_isolation_policy" ON "categories";
CREATE POLICY "categories_isolation_policy" ON "categories"
  FOR ALL
  USING (
    auth.role() = 'service_role' OR
    user_id = (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::integer)
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    user_id = (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::integer)
  );

-- Tabela TRANSACTIONS
DROP POLICY IF EXISTS "transactions_isolation_policy" ON "transactions";
CREATE POLICY "transactions_isolation_policy" ON "transactions"
  FOR ALL
  USING (
    auth.role() = 'service_role' OR
    user_id = (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::integer)
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    user_id = (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::integer)
  );

-- Tabela BUDGETS
DROP POLICY IF EXISTS "budgets_isolation_policy" ON "budgets";
CREATE POLICY "budgets_isolation_policy" ON "budgets"
  FOR ALL
  USING (
    auth.role() = 'service_role' OR
    user_id = (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::integer)
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    user_id = (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::integer)
  );

-- Tabela GOALS
DROP POLICY IF EXISTS "goals_isolation_policy" ON "goals";
CREATE POLICY "goals_isolation_policy" ON "goals"
  FOR ALL
  USING (
    auth.role() = 'service_role' OR
    user_id = (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::integer)
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    user_id = (NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::integer)
  );

-- 4. Constraints de Consistência e Integridade de Valores
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_amount_positive') THEN
    ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_positive" CHECK ("amount_cents" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_amount_positive') THEN
    ALTER TABLE "budgets" ADD CONSTRAINT "budgets_amount_positive" CHECK ("amount_cents" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_target_positive') THEN
    ALTER TABLE "goals" ADD CONSTRAINT "goals_target_positive" CHECK ("target_cents" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_current_non_negative') THEN
    ALTER TABLE "goals" ADD CONSTRAINT "goals_current_non_negative" CHECK ("current_cents" >= 0);
  END IF;
END $$;
