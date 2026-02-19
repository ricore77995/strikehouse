-- Migration: Fix unique constraint to include is_test
-- Purpose: Allow TEST and PRODUCTION links with same config to coexist
--
-- This migration:
-- 1. Drops the old unique index (without is_test)
-- 2. Creates new unique index (with is_test)
-- 3. Updates helper function to support is_test parameter

-- Drop old unique constraint that doesn't include is_test
DROP INDEX IF EXISTS idx_payment_links_unique_config;

-- Create NEW unique constraint that includes is_test
-- This allows both TEST and PRODUCTION links with the same config to coexist
CREATE UNIQUE INDEX idx_payment_links_unique_config
ON stripe_payment_links(frequencia, compromisso, includes_enrollment_fee, is_family_friends, is_test)
WHERE ativo = true;

-- Drop old function (4 parameters)
DROP FUNCTION IF EXISTS get_payment_link(VARCHAR(20), VARCHAR(20), BOOLEAN, BOOLEAN);

-- Create new function with is_test parameter (5 parameters)
CREATE OR REPLACE FUNCTION get_payment_link(
  p_frequencia VARCHAR(20),
  p_compromisso VARCHAR(20),
  p_is_new_member BOOLEAN,
  p_is_family_friends BOOLEAN DEFAULT false,
  p_is_test BOOLEAN DEFAULT false
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
    AND spl.is_test = p_is_test
    AND spl.ativo = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_payment_link(VARCHAR(20), VARCHAR(20), BOOLEAN, BOOLEAN, BOOLEAN)
IS 'Returns the appropriate Payment Link based on configuration and test mode';
