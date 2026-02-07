-- Drop existing stripe_payment_ledger if it exists (cleanup from previous version)
DROP TABLE IF EXISTS stripe_payment_ledger CASCADE;

-- Create stripe_payment_ledger table
-- Immutable log of all Stripe payment events
CREATE TABLE stripe_payment_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stripe identifiers
  stripe_session_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_invoice_id TEXT,

  -- Customer info
  customer_email TEXT NOT NULL,
  customer_name TEXT,

  -- Payment details
  amount_total INTEGER NOT NULL, -- in cents
  currency TEXT DEFAULT 'eur',
  payment_status TEXT, -- 'paid', 'unpaid', 'no_payment_required'
  payment_method TEXT,

  -- Product info
  product_type TEXT, -- 'subscription', 'payment', 'subscription_renewal'
  is_new_member BOOLEAN DEFAULT false,

  -- Matching and confirmation
  matched_member_id UUID REFERENCES members(id),
  auto_matched BOOLEAN DEFAULT false,
  confirmed BOOLEAN DEFAULT false,
  confirmed_by UUID REFERENCES staff(id),
  confirmed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB,
  event_type TEXT NOT NULL, -- 'checkout.session.completed', 'invoice.payment_succeeded', etc.
  event_id TEXT UNIQUE NOT NULL, -- for idempotency

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stripe_ledger_confirmed ON stripe_payment_ledger(confirmed) WHERE confirmed = false;
CREATE INDEX IF NOT EXISTS idx_stripe_ledger_customer_email ON stripe_payment_ledger(customer_email);
CREATE INDEX IF NOT EXISTS idx_stripe_ledger_matched_member ON stripe_payment_ledger(matched_member_id);
CREATE INDEX IF NOT EXISTS idx_stripe_ledger_session ON stripe_payment_ledger(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_stripe_ledger_created_at ON stripe_payment_ledger(created_at DESC);

-- Row Level Security
ALTER TABLE stripe_payment_ledger ENABLE ROW LEVEL SECURITY;

-- Admin/Staff can view all stripe payments
CREATE POLICY "Admin/Staff can view stripe payments"
  ON stripe_payment_ledger FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role IN ('ADMIN', 'STAFF')
    )
  );

-- Only admin can update (confirm payments)
CREATE POLICY "Admin can update stripe payments"
  ON stripe_payment_ledger FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role = 'ADMIN'
    )
  );

-- Service role (webhook) can insert
CREATE POLICY "Service role can insert stripe payments"
  ON stripe_payment_ledger FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE stripe_payment_ledger IS 'Immutable log of all Stripe payment events. Populated by webhook, confirmed by staff.';
