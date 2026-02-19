-- Repair migration: Clean up partial migration and re-apply RLS policies
-- Date: 2026-02-16

-- ============================================
-- 1. DROP EXISTING POLICIES (safe if not exists)
-- ============================================

DROP POLICY IF EXISTS "Service role can insert stripe_events" ON stripe_events;
DROP POLICY IF EXISTS "Admins can view stripe_events" ON stripe_events;
DROP POLICY IF EXISTS "Staff can insert cash_transactions" ON cash_transactions;
DROP POLICY IF EXISTS "Staff can view cash_transactions" ON cash_transactions;

-- ============================================
-- 2. RE-CREATE RLS POLICIES WITH CORRECT COLUMN NAME
-- ============================================

-- stripe_events: Only service role can insert (from webhook), admins can read
CREATE POLICY "Service role can insert stripe_events"
  ON stripe_events FOR INSERT
  WITH CHECK (true);  -- Webhook uses service role

CREATE POLICY "Admins can view stripe_events"
  ON stripe_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role IN ('OWNER', 'ADMIN')
      AND staff.ativo = true
    )
  );

-- cash_transactions: Staff can insert, admins can view all
CREATE POLICY "Staff can insert cash_transactions"
  ON cash_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role IN ('OWNER', 'ADMIN', 'STAFF')
      AND staff.ativo = true
    )
  );

CREATE POLICY "Staff can view cash_transactions"
  ON cash_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role IN ('OWNER', 'ADMIN', 'STAFF')
      AND staff.ativo = true
    )
  );

-- ============================================
-- 3. TRIGGER (re-create if needed)
-- ============================================

CREATE OR REPLACE FUNCTION update_cash_session_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'IN' THEN
    UPDATE cash_sessions
    SET total_cash_in_cents = COALESCE(total_cash_in_cents, 0) + NEW.amount_cents
    WHERE id = NEW.session_id;
  ELSIF NEW.type = 'OUT' THEN
    UPDATE cash_sessions
    SET total_cash_out_cents = COALESCE(total_cash_out_cents, 0) + NEW.amount_cents
    WHERE id = NEW.session_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cash_transaction_update_session ON cash_transactions;
CREATE TRIGGER trg_cash_transaction_update_session
  AFTER INSERT ON cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_session_totals();

COMMENT ON FUNCTION update_cash_session_totals IS 'Auto-updates cash_sessions totals when a cash_transaction is inserted';
