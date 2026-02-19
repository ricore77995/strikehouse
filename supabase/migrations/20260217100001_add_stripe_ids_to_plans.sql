-- Migration: Add Stripe Price/Product IDs to plans table
-- This enables mapping between local plans and Stripe's pricing catalog

-- 1. Add stripe_price_id column
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(100);

-- 2. Add stripe_product_id column
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS stripe_product_id VARCHAR(100);

-- 3. Add index for stripe_price_id lookups
CREATE INDEX IF NOT EXISTS idx_plans_stripe_price
ON plans(stripe_price_id)
WHERE stripe_price_id IS NOT NULL;

-- 4. Add comments
COMMENT ON COLUMN plans.stripe_price_id IS 'Stripe Price ID (price_xxx) for this plan';
COMMENT ON COLUMN plans.stripe_product_id IS 'Stripe Product ID (prod_xxx) for this plan';
