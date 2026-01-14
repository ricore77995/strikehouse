-- Migration: Add current_subscription_id to members table
-- Links member to their active subscription for quick access validation

ALTER TABLE members
ADD COLUMN IF NOT EXISTS current_subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL;

-- Create index for subscription lookups
CREATE INDEX IF NOT EXISTS idx_members_subscription ON members(current_subscription_id)
    WHERE current_subscription_id IS NOT NULL;

COMMENT ON COLUMN members.current_subscription_id IS 'Reference to the member active subscription (for access validation)';

-- Note: Existing members will have NULL current_subscription_id
-- They will continue to work with legacy access_type/access_expires_at fields
-- New enrollments should create subscriptions and set this reference
