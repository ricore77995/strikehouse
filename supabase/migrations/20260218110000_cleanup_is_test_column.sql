-- Migration: Cleanup is_test column and restore original structure
-- Purpose: Environment separation is handled by separate Supabase projects, not column
--
-- Context:
-- - This database (cgdshqmqsqwgwpjfmesr) is designated for DEVELOPMENT
-- - LIVE/PROD will use a separate Supabase project
-- - is_test column is no longer needed - environment separation via .env files
--
-- This migration:
-- 1. Deletes PRODUCTION links (is_test=false) - they don't belong in DEV
-- 2. Removes the is_test column
-- 3. Restores original unique constraint (without is_test)
-- 4. Restores original function signature (4 parameters, no is_test)

-- Step 1: Delete PRODUCTION links (they don't belong in DEV database)
-- These were inserted via populate-payment-links.ts (LIVE Stripe API)
DELETE FROM stripe_payment_links WHERE is_test = false;

-- Step 2: Drop the is_test index
DROP INDEX IF EXISTS idx_stripe_payment_links_is_test;

-- Step 3: Drop existing unique constraint that includes is_test
DROP INDEX IF EXISTS idx_payment_links_unique_config;

-- Step 4: Remove is_test column (no longer needed)
ALTER TABLE stripe_payment_links DROP COLUMN IF EXISTS is_test;

-- Step 5: Restore original unique constraint (without is_test)
-- This ensures only one active link per configuration
CREATE UNIQUE INDEX idx_payment_links_unique_config
ON stripe_payment_links(frequencia, compromisso, includes_enrollment_fee, is_family_friends)
WHERE ativo = true;

-- Step 6: Drop the 5-parameter function
DROP FUNCTION IF EXISTS get_payment_link(VARCHAR(20), VARCHAR(20), BOOLEAN, BOOLEAN, BOOLEAN);

-- Step 7: Restore original 4-parameter function
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

COMMENT ON FUNCTION get_payment_link(VARCHAR(20), VARCHAR(20), BOOLEAN, BOOLEAN)
IS 'Returns the appropriate Payment Link based on configuration (environment separation via separate Supabase projects)';

-- Remove comment about is_test since column no longer exists
-- (The previous migration added a comment to the is_test column)
