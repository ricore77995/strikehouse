-- Migration: Sync Plans with Stripe
-- Date: 2026-02-18
-- Description: Adds price_source tracking and Payment Link association for plan sync

-- ============================================
-- 1. ADD PRICE SOURCE TRACKING
-- ============================================

-- Add stripe_payment_link_id for direct 1:1 mapping
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS stripe_payment_link_id VARCHAR(100);

-- Add price_source to track where price comes from
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS price_source VARCHAR(20) DEFAULT 'LOCAL'
CHECK (price_source IN ('STRIPE', 'OVERRIDE', 'LOCAL'));

-- Add stripe_synced_at for tracking last sync
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS stripe_synced_at TIMESTAMPTZ;

-- ============================================
-- 2. CREATE INDEXES
-- ============================================

-- Unique index: only one plan per Payment Link (among active plans)
CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_unique_payment_link
ON plans(stripe_payment_link_id)
WHERE stripe_payment_link_id IS NOT NULL AND ativo = true;

-- Index for price_source queries
CREATE INDEX IF NOT EXISTS idx_plans_price_source
ON plans(price_source)
WHERE ativo = true;

-- ============================================
-- 3. UPDATE EXISTING DATA
-- ============================================

-- Set price_source = 'STRIPE' for plans that already have stripe_price_id
UPDATE plans
SET price_source = 'STRIPE'
WHERE stripe_price_id IS NOT NULL
  AND price_source = 'LOCAL';

-- ============================================
-- 4. ADD COMMENTS
-- ============================================

COMMENT ON COLUMN plans.stripe_payment_link_id IS 'Stripe Payment Link ID (plink_xxx) associated with this plan';
COMMENT ON COLUMN plans.price_source IS 'Price source: STRIPE (synced from Stripe), OVERRIDE (manual, differs from Stripe), LOCAL (no Stripe integration)';
COMMENT ON COLUMN plans.stripe_synced_at IS 'Timestamp of last price sync from Stripe';

-- ============================================
-- 5. HELPER FUNCTION: Check if plan is out of sync
-- ============================================

CREATE OR REPLACE FUNCTION check_plan_sync_status(p_plan_id UUID)
RETURNS TABLE (
  is_synced BOOLEAN,
  local_price_cents INTEGER,
  stripe_price_cents INTEGER,
  last_synced_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.preco_cents = COALESCE(spl.amount_cents, p.preco_cents) AS is_synced,
    p.preco_cents AS local_price_cents,
    spl.amount_cents AS stripe_price_cents,
    p.stripe_synced_at AS last_synced_at
  FROM plans p
  LEFT JOIN stripe_payment_links spl ON p.stripe_payment_link_id = spl.payment_link_id
  WHERE p.id = p_plan_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_plan_sync_status IS 'Check if a plan price is synced with its Stripe Payment Link';
