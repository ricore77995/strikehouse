-- Migration: Add access limits to members table
-- Date: 2026-02-17
-- Description: Add weekly_limit and modalities_count fields for controlling member access based on Stripe Payment Link metadata

-- ============================================
-- 1. ADD weekly_limit COLUMN
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'weekly_limit'
  ) THEN
    ALTER TABLE members ADD COLUMN weekly_limit INTEGER DEFAULT NULL;
    COMMENT ON COLUMN members.weekly_limit IS 'Max check-ins per rolling 7 days. NULL = unlimited. Derived from Stripe Payment Link metadata.';
  END IF;
END $$;

-- ============================================
-- 2. ADD modalities_count COLUMN
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'modalities_count'
  ) THEN
    ALTER TABLE members ADD COLUMN modalities_count INTEGER DEFAULT 1;
    COMMENT ON COLUMN members.modalities_count IS 'Number of modalities included in subscription. 99 = ALL. Derived from Stripe Payment Link metadata.';
  END IF;
END $$;

-- ============================================
-- 3. INDEX for efficient check-in queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_members_weekly_limit ON members(weekly_limit) WHERE weekly_limit IS NOT NULL;

-- ============================================
-- 4. ADD CONSTRAINT for valid values
-- ============================================

ALTER TABLE members DROP CONSTRAINT IF EXISTS chk_weekly_limit_positive;
ALTER TABLE members ADD CONSTRAINT chk_weekly_limit_positive
  CHECK (weekly_limit IS NULL OR weekly_limit > 0);

ALTER TABLE members DROP CONSTRAINT IF EXISTS chk_modalities_count_positive;
ALTER TABLE members ADD CONSTRAINT chk_modalities_count_positive
  CHECK (modalities_count > 0);
