-- Migration: Add modalities_count and weekly_limit to stripe_payment_links
-- Date: 2026-02-19
-- Description: Adds explicit columns for plan configuration
--              - modalities_count: 1 = single modality, NULL = all modalities
--              - weekly_limit: NULL = unlimited, 1/2/3 = limited per week

-- Add modalities_count column
ALTER TABLE stripe_payment_links
ADD COLUMN IF NOT EXISTS modalities_count INTEGER DEFAULT NULL;

-- Add weekly_limit column (NULL = unlimited)
ALTER TABLE stripe_payment_links
ADD COLUMN IF NOT EXISTS weekly_limit INTEGER DEFAULT NULL;

-- Comments
COMMENT ON COLUMN stripe_payment_links.modalities_count IS
'Number of modalities included. NULL = all modalities, 1 = single modality choice';

COMMENT ON COLUMN stripe_payment_links.weekly_limit IS
'Weekly training limit. NULL = unlimited, 1/2/3 = limited per week';

-- Update based on frequencia field
UPDATE stripe_payment_links
SET weekly_limit = CASE
  WHEN frequencia = '1x' THEN 1
  WHEN frequencia = '2x' THEN 2
  WHEN frequencia = '3x' THEN 3
  ELSE NULL  -- unlimited
END
WHERE weekly_limit IS NULL;

-- Update modalities_count based on pricing
-- Plans <= €75 total (€60 plan + €15 enrollment) = 1 modality
-- Plans > €75 = all modalities
UPDATE stripe_payment_links
SET modalities_count = CASE
  WHEN amount_cents <= 7500 THEN 1
  ELSE NULL  -- all modalities
END
WHERE modalities_count IS NULL;
