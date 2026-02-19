-- Migration: Fix weekly_limit and is_family_friends in stripe_payment_links
-- Date: 2026-02-19
-- Description: Corrects weekly_limit based on display_name patterns
--              and ensures is_family_friends flag is set correctly

-- Fix is_family_friends flag
UPDATE stripe_payment_links
SET is_family_friends = true
WHERE display_name ILIKE '%family%friends%'
  AND is_family_friends = false;

-- Set weekly_limit based on display_name pattern
-- 1x/semana = 1
UPDATE stripe_payment_links
SET weekly_limit = 1
WHERE display_name ILIKE '%1x%'
  AND weekly_limit IS NULL;

-- 2x/semana = 2
UPDATE stripe_payment_links
SET weekly_limit = 2
WHERE display_name ILIKE '%2x%'
  AND weekly_limit IS NULL;

-- 3x/semana = 3
UPDATE stripe_payment_links
SET weekly_limit = 3
WHERE display_name ILIKE '%3x%'
  AND weekly_limit IS NULL;

-- Ilimitado, Passe Livre, Trimestral, Semestral, Anual = unlimited (NULL)
-- These are already NULL, no action needed

-- Also update modalities_count if needed
-- Only "Passe Livre" and commitment plans (Trimestral, Semestral, Anual) have all modalities
UPDATE stripe_payment_links
SET modalities_count = NULL  -- NULL = all modalities
WHERE (display_name ILIKE '%passe livre%'
    OR display_name ILIKE '%trimestral%'
    OR display_name ILIKE '%semestral%'
    OR display_name ILIKE '%anual%')
  AND modalities_count IS NOT NULL;
