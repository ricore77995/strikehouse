-- Migration: Add Enrollment Fee System (Taxa de Matrícula)
-- Date: 2026-01-11
-- Description: Adds enrollment_fee_cents column to plans table and TAXA_MATRICULA category

-- Add enrollment_fee_cents column to plans table
ALTER TABLE plans
ADD COLUMN enrollment_fee_cents INTEGER DEFAULT 0
CHECK (enrollment_fee_cents >= 0);

-- Add comment for documentation
COMMENT ON COLUMN plans.enrollment_fee_cents IS
'Enrollment fee in cents (charged once for LEAD -> ATIVO transition). Can be zero for exemption. Staff can override value during enrollment process.';

-- Add TAXA_MATRICULA category for enrollment fee transactions
INSERT INTO categories (code, nome, type)
VALUES ('TAXA_MATRICULA', 'Taxa de Matrícula', 'RECEITA');

-- Set default enrollment fees for existing active plans (€25.00 = 2500 cents)
-- This is a reasonable default that can be adjusted per plan by admin
UPDATE plans
SET enrollment_fee_cents = 2500
WHERE ativo = true;

-- Inactive plans get €0 default (no fee unless explicitly set)
UPDATE plans
SET enrollment_fee_cents = 0
WHERE ativo = false;
