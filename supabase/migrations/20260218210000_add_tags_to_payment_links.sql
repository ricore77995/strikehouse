-- Migration: Add tags array to stripe_payment_links
-- Date: 2026-02-18
-- Description: Replace boolean flags with flexible tags array

-- ============================================
-- 1. ADD TAGS COLUMN
-- ============================================

ALTER TABLE stripe_payment_links
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- ============================================
-- 2. MIGRATE EXISTING DATA TO TAGS
-- ============================================

-- Convert existing boolean flags to tags
UPDATE stripe_payment_links
SET tags = ARRAY_REMOVE(
  ARRAY[
    CASE WHEN includes_enrollment_fee THEN 'matricula' END,
    CASE WHEN is_family_friends THEN 'family_friends' END
  ],
  NULL
)
WHERE tags = '{}' OR tags IS NULL;

-- ============================================
-- 3. ADD INDEX FOR TAG SEARCHES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_payment_links_tags
ON stripe_payment_links USING GIN(tags);

-- ============================================
-- 4. UPDATE UNIQUE INDEX (include tags in grouping)
-- ============================================

-- Drop old unique index
DROP INDEX IF EXISTS idx_payment_links_unique_config;

-- Create new unique index without boolean flags
-- Each payment_link_id should be unique anyway
CREATE UNIQUE INDEX idx_payment_links_stripe_id_unique
ON stripe_payment_links(payment_link_id);

-- ============================================
-- 5. COMMENTS
-- ============================================

COMMENT ON COLUMN stripe_payment_links.tags IS 'Flexible tags: matricula, family_friends, promocao, staff, etc.';

-- Note: Keeping includes_enrollment_fee and is_family_friends columns
-- for backwards compatibility. They will be deprecated in favor of tags.
