-- Migration: Add auto-renewal support
-- Gap 2: Automatic subscription renewal system

-- Add auto-renewal columns to subscriptions
ALTER TABLE subscriptions ADD COLUMN
    auto_renew BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE subscriptions ADD COLUMN
    renewal_reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Add preferred payment method to members
ALTER TABLE members ADD COLUMN
    preferred_payment_method VARCHAR(20)
    CHECK (preferred_payment_method IS NULL OR preferred_payment_method IN ('DINHEIRO', 'CARTAO', 'MBWAY', 'TRANSFERENCIA'));

-- Index for finding subscriptions that need renewal reminders
CREATE INDEX idx_subscriptions_auto_renew_expires
    ON subscriptions(expires_at)
    WHERE auto_renew = true AND status = 'active';

-- Comments
COMMENT ON COLUMN subscriptions.auto_renew IS 'Whether this subscription should auto-renew at expiration';
COMMENT ON COLUMN subscriptions.renewal_reminder_sent_at IS 'Timestamp when renewal reminder was sent (7 days before expiry)';
COMMENT ON COLUMN members.preferred_payment_method IS 'Member preferred payment method for auto-renewals';
