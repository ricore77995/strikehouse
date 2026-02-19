-- Migration: Add STRIPE payment method and stripe_session_id to transactions
-- This enables tracking Stripe payments in the financial system

-- 1. Add STRIPE to transactions.payment_method CHECK constraint
-- First drop the existing constraint, then add new one with STRIPE
ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_payment_method_check;

ALTER TABLE transactions
ADD CONSTRAINT transactions_payment_method_check
CHECK (payment_method IN ('DINHEIRO', 'MBWAY', 'TRANSFERENCIA', 'CARTAO', 'STRIPE'));

-- 2. Add stripe_session_id column for linking to Stripe Checkout Sessions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(100);

-- 3. Add index for stripe_session_id lookups
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_session
ON transactions(stripe_session_id)
WHERE stripe_session_id IS NOT NULL;

-- 4. Also update sales.payment_method to include STRIPE
ALTER TABLE sales
DROP CONSTRAINT IF EXISTS sales_payment_method_check;

ALTER TABLE sales
ADD CONSTRAINT sales_payment_method_check
CHECK (payment_method IN ('DINHEIRO', 'MBWAY', 'CARTAO', 'STRIPE'));

-- 5. Add comments
COMMENT ON COLUMN transactions.stripe_session_id IS 'Stripe Checkout Session ID (cs_xxx) for linking payment to Stripe';
