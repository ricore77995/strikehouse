-- Migration: Stripe as Single Source of Truth - Phase 1
-- Date: 2026-02-16
-- Description: Create tables for webhook logging and cash transaction tracking

-- ============================================
-- 1. STRIPE_EVENTS - Webhook event log for idempotency and audit
-- ============================================

CREATE TABLE IF NOT EXISTS stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stripe event identifiers
  event_id TEXT UNIQUE NOT NULL,  -- Stripe event ID (evt_xxx)
  event_type TEXT NOT NULL,        -- checkout.session.completed, invoice.paid, etc.

  -- Processing metadata
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Full event payload for debugging/audit
  payload JSONB,

  -- Result tracking
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookup by event_id (idempotency checks)
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_events(event_id);

-- Index for querying by type
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type);

-- Index for querying recent failed events
CREATE INDEX IF NOT EXISTS idx_stripe_events_failed ON stripe_events(success) WHERE success = false;

COMMENT ON TABLE stripe_events IS 'Immutable log of all Stripe webhook events for idempotency and audit';
COMMENT ON COLUMN stripe_events.event_id IS 'Stripe event ID - used for idempotency check';
COMMENT ON COLUMN stripe_events.payload IS 'Full JSON payload from Stripe for debugging';

-- ============================================
-- 2. CASH_TRANSACTIONS - Log for DINHEIRO payments (local only)
-- ============================================

CREATE TABLE IF NOT EXISTS cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to cash session
  session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE RESTRICT,

  -- Member (optional - some cash transactions may not be member-related)
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,

  -- Transaction details
  amount_cents INTEGER NOT NULL CHECK (amount_cents != 0),
  type VARCHAR(10) NOT NULL CHECK (type IN ('IN', 'OUT')),  -- IN = revenue, OUT = expense
  category TEXT NOT NULL,  -- SUBSCRIPTION, TAXA_MATRICULA, PRODUTOS, etc.
  description TEXT,

  -- Audit
  created_by UUID NOT NULL REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Optional reference to what was purchased
  reference_type VARCHAR(20),  -- ENROLLMENT, RENEWAL, PRODUCT, etc.
  reference_id UUID
);

-- Index for session lookup
CREATE INDEX IF NOT EXISTS idx_cash_transactions_session ON cash_transactions(session_id);

-- Index for member lookup
CREATE INDEX IF NOT EXISTS idx_cash_transactions_member ON cash_transactions(member_id) WHERE member_id IS NOT NULL;

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_cash_transactions_created ON cash_transactions(created_at);

COMMENT ON TABLE cash_transactions IS 'Individual DINHEIRO transactions within a cash session';
COMMENT ON COLUMN cash_transactions.type IS 'IN = money received (revenue), OUT = money paid out (expense)';

-- ============================================
-- 3. ADD STRIPE LINKAGE TO MEMBERS
-- ============================================

-- Add stripe_customer_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE members ADD COLUMN stripe_customer_id TEXT UNIQUE;
    COMMENT ON COLUMN members.stripe_customer_id IS 'Stripe Customer ID (cus_xxx)';
  END IF;
END $$;

-- Add stripe_subscription_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE members ADD COLUMN stripe_subscription_id TEXT;
    COMMENT ON COLUMN members.stripe_subscription_id IS 'Active Stripe Subscription ID (sub_xxx)';
  END IF;
END $$;

-- Index for Stripe customer lookup
CREATE INDEX IF NOT EXISTS idx_members_stripe_customer ON members(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ============================================
-- 4. ADD STRIPE LINKAGE TO EXTERNAL_COACHES
-- ============================================

-- Add stripe_customer_id to coaches for PT fee subscriptions and rental invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_coaches' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE external_coaches ADD COLUMN stripe_customer_id TEXT UNIQUE;
    COMMENT ON COLUMN external_coaches.stripe_customer_id IS 'Stripe Customer ID for coach (billing)';
  END IF;
END $$;

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- Enable RLS on new tables
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;

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
-- 6. TRIGGER: Update cash_sessions totals on cash_transaction insert
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
