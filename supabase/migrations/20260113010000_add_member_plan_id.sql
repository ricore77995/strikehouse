-- Migration: Add current_plan_id to members
-- Tracks which plan the member is currently subscribed to

-- Add current_plan_id column to members
ALTER TABLE members
ADD COLUMN IF NOT EXISTS current_plan_id UUID REFERENCES plans(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_members_current_plan ON members(current_plan_id) WHERE current_plan_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN members.current_plan_id IS 'Reference to the current plan the member is subscribed to';
