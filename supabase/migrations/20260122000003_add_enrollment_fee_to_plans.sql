-- Migration: Add enrollment_fee_cents to plans table
-- Description: Adiciona campo para taxa de matrícula por plano
-- Related: UC-001 (Matrícula LEAD), IMPLEMENTATION_PLAN.md Phase 2

-- Add enrollment_fee_cents column to plans
ALTER TABLE plans ADD COLUMN IF NOT EXISTS enrollment_fee_cents INTEGER DEFAULT 1500 CHECK (enrollment_fee_cents >= 0);

-- Set default enrollment fee (€15.00 = 1500 cents) for existing plans
UPDATE plans SET enrollment_fee_cents = 1500 WHERE enrollment_fee_cents IS NULL;

-- Add NOT NULL constraint after setting defaults
ALTER TABLE plans ALTER COLUMN enrollment_fee_cents SET NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN plans.enrollment_fee_cents IS 'Taxa de matrícula em cents (ex: 1500 = €15.00). Cobrada apenas para novos membros (LEAD) ou reativações (CANCELADO com decisão de staff)';
