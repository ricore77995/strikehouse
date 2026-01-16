-- Add metadata column to pending_payments
-- Stores subscription/plan data for later activation when payment is confirmed

ALTER TABLE pending_payments
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN pending_payments.metadata IS 'Stores subscription/plan data for enrollment activation';
