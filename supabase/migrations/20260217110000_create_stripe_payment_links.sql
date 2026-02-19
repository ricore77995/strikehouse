-- Migration: Create stripe_payment_links table
-- Date: 2026-02-17
-- Description: Maps Stripe Payment Links to local plan configurations
-- Supports: Membership (with enrollment fee) and Discount (subscription only) links

-- ============================================
-- 1. STRIPE_PAYMENT_LINKS - Payment Link mapping
-- ============================================

CREATE TABLE IF NOT EXISTS stripe_payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plan configuration
  frequencia VARCHAR(20) NOT NULL,  -- '1x', '2x', '3x', 'unlimited'
  compromisso VARCHAR(20) NOT NULL,  -- 'mensal', 'trimestral', 'semestral', 'anual'
  includes_enrollment_fee BOOLEAN NOT NULL DEFAULT false,
  is_family_friends BOOLEAN NOT NULL DEFAULT false,

  -- Stripe IDs
  payment_link_id VARCHAR(100) NOT NULL,   -- plink_xxx
  payment_link_url VARCHAR(500) NOT NULL,  -- https://buy.stripe.com/xxx
  price_id VARCHAR(100) NOT NULL,          -- price_xxx (plan)
  enrollment_price_id VARCHAR(100),        -- price_xxx (enrollment fee, if applicable)

  -- Reference to local plan
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,

  -- Display
  display_name VARCHAR(100),
  amount_cents INTEGER NOT NULL,

  -- Status
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint: only one active link per configuration
CREATE UNIQUE INDEX idx_payment_links_unique_config
ON stripe_payment_links(frequencia, compromisso, includes_enrollment_fee, is_family_friends)
WHERE ativo = true;

-- Index for quick lookup by config
CREATE INDEX idx_payment_links_config
ON stripe_payment_links(frequencia, compromisso, includes_enrollment_fee)
WHERE ativo = true;

-- Index for Stripe IDs
CREATE INDEX idx_payment_links_stripe_id ON stripe_payment_links(payment_link_id);
CREATE INDEX idx_payment_links_price_id ON stripe_payment_links(price_id);

-- Comments
COMMENT ON TABLE stripe_payment_links IS 'Maps Stripe Payment Links to local plan configurations';
COMMENT ON COLUMN stripe_payment_links.frequencia IS 'Weekly frequency: 1x, 2x, 3x, or unlimited';
COMMENT ON COLUMN stripe_payment_links.compromisso IS 'Commitment period: mensal, trimestral, semestral, anual';
COMMENT ON COLUMN stripe_payment_links.includes_enrollment_fee IS 'True for Membership links (plano + matrícula), false for Discount links (só plano)';
COMMENT ON COLUMN stripe_payment_links.is_family_friends IS 'True for Family & Friends special pricing';
COMMENT ON COLUMN stripe_payment_links.payment_link_id IS 'Stripe Payment Link ID (plink_xxx)';
COMMENT ON COLUMN stripe_payment_links.price_id IS 'Stripe Price ID for the plan (price_xxx)';
COMMENT ON COLUMN stripe_payment_links.enrollment_price_id IS 'Stripe Price ID for enrollment fee (price_xxx), only for membership links';

-- ============================================
-- 2. RLS POLICIES
-- ============================================

ALTER TABLE stripe_payment_links ENABLE ROW LEVEL SECURITY;

-- Staff and above can read payment links
CREATE POLICY "Staff can view stripe_payment_links"
  ON stripe_payment_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role IN ('OWNER', 'ADMIN', 'STAFF')
      AND staff.ativo = true
    )
  );

-- Only admins can modify payment links
CREATE POLICY "Admins can insert stripe_payment_links"
  ON stripe_payment_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role IN ('OWNER', 'ADMIN')
      AND staff.ativo = true
    )
  );

CREATE POLICY "Admins can update stripe_payment_links"
  ON stripe_payment_links FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role IN ('OWNER', 'ADMIN')
      AND staff.ativo = true
    )
  );

-- ============================================
-- 3. HELPER FUNCTION: Get payment link for configuration
-- ============================================

CREATE OR REPLACE FUNCTION get_payment_link(
  p_frequencia VARCHAR(20),
  p_compromisso VARCHAR(20),
  p_is_new_member BOOLEAN,
  p_is_family_friends BOOLEAN DEFAULT false
)
RETURNS TABLE (
  payment_link_url VARCHAR(500),
  payment_link_id VARCHAR(100),
  price_id VARCHAR(100),
  enrollment_price_id VARCHAR(100),
  amount_cents INTEGER,
  display_name VARCHAR(100)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    spl.payment_link_url,
    spl.payment_link_id,
    spl.price_id,
    spl.enrollment_price_id,
    spl.amount_cents,
    spl.display_name
  FROM stripe_payment_links spl
  WHERE spl.frequencia = p_frequencia
    AND spl.compromisso = p_compromisso
    AND spl.includes_enrollment_fee = p_is_new_member
    AND spl.is_family_friends = p_is_family_friends
    AND spl.ativo = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_payment_link IS 'Returns the appropriate Payment Link based on configuration';

-- ============================================
-- 4. TRIGGER: Update updated_at on changes
-- ============================================

CREATE OR REPLACE FUNCTION update_stripe_payment_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stripe_payment_links_updated_at
  BEFORE UPDATE ON stripe_payment_links
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_payment_links_updated_at();
