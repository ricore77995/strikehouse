-- Migration: Add subscription freeze/pause support
-- Gap 3: Subscription pause functionality

-- Add freeze columns to subscriptions
ALTER TABLE subscriptions ADD COLUMN
    frozen_at DATE;

ALTER TABLE subscriptions ADD COLUMN
    frozen_until DATE;

ALTER TABLE subscriptions ADD COLUMN
    freeze_reason TEXT;

ALTER TABLE subscriptions ADD COLUMN
    original_expires_at DATE;

-- Constraint: frozen_until must be after frozen_at
ALTER TABLE subscriptions ADD CONSTRAINT
    chk_freeze_dates CHECK (frozen_until IS NULL OR frozen_at IS NULL OR frozen_until > frozen_at);

-- Update members status check to include PAUSADO
-- First, check what constraint exists on members.status
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE members ADD CONSTRAINT members_status_check
    CHECK (status IS NULL OR status IN ('LEAD', 'ATIVO', 'BLOQUEADO', 'CANCELADO', 'PAUSADO'));

-- Index for finding frozen subscriptions
CREATE INDEX idx_subscriptions_frozen
    ON subscriptions(frozen_until)
    WHERE frozen_at IS NOT NULL AND frozen_until IS NOT NULL;

-- Comments
COMMENT ON COLUMN subscriptions.frozen_at IS 'Date when subscription was frozen/paused';
COMMENT ON COLUMN subscriptions.frozen_until IS 'Date when freeze ends and subscription resumes';
COMMENT ON COLUMN subscriptions.freeze_reason IS 'Reason for freezing (vacation, injury, etc.)';
COMMENT ON COLUMN subscriptions.original_expires_at IS 'Original expiry date before freeze (for restoration)';
