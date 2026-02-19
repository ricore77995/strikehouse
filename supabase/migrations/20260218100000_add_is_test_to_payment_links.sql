-- Migration: Add is_test column to stripe_payment_links
-- Purpose: Separate TEST and PRODUCTION Payment Links for safe development
--
-- SAFETY: This migration only ADDS a new column and marks existing rows as production.
-- It does NOT modify or delete any existing data.

-- Add is_test column (default false = production)
ALTER TABLE stripe_payment_links
ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing links as PRODUCTION (they were created before this distinction)
-- This is explicit and safe - we know current links are production URLs
UPDATE stripe_payment_links SET is_test = false WHERE is_test IS NULL;

-- Create index for efficient filtering by environment
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_is_test
ON stripe_payment_links(is_test);

-- Drop old unique constraint that doesn't include is_test
DROP INDEX IF EXISTS idx_payment_links_unique_config;

-- Create NEW unique constraint that includes is_test
-- This allows both TEST and PRODUCTION links with the same config to coexist
CREATE UNIQUE INDEX idx_payment_links_unique_config
ON stripe_payment_links(frequencia, compromisso, includes_enrollment_fee, is_family_friends, is_test)
WHERE ativo = true;

-- Drop old function version (different parameter signature = different function in PostgreSQL)
DROP FUNCTION IF EXISTS get_payment_link(VARCHAR, VARCHAR, BOOLEAN, BOOLEAN);

-- Update the helper function to include is_test filter
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

COMMENT ON FUNCTION get_payment_link(VARCHAR, VARCHAR, BOOLEAN, BOOLEAN, BOOLEAN) IS 'Returns the appropriate Payment Link based on configuration and test mode';

-- Add comment for documentation
COMMENT ON COLUMN stripe_payment_links.is_test IS
'TRUE = Test mode Payment Link (sk_test_*), FALSE = Production (sk_live_*)';
