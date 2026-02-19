-- Migration: Add stripe_subscription_id to subscriptions table
-- This links local subscription records to Stripe subscriptions

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(100);

-- Index for Stripe subscription lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe
ON subscriptions(stripe_subscription_id)
WHERE stripe_subscription_id IS NOT NULL;

-- Also add stripe_price_id for reference to the price used
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(100);

COMMENT ON COLUMN subscriptions.stripe_subscription_id IS 'Stripe Subscription ID (sub_xxx) for tracking';
COMMENT ON COLUMN subscriptions.stripe_price_id IS 'Stripe Price ID (price_xxx) used for this subscription';
