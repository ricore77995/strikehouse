-- Migration: Add pricing engine columns to plans table
-- Plans can now specify modalities and override global pricing

-- Add new columns
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS modalities UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS commitment_months INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS pricing_override JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT true;

-- Add check constraint for commitment_months
ALTER TABLE plans
ADD CONSTRAINT plans_commitment_months_check
CHECK (commitment_months >= 1);

-- Create index for visible plans
CREATE INDEX IF NOT EXISTS idx_plans_visible ON plans(visible) WHERE ativo = true;

-- Add GIN index for modalities array queries
CREATE INDEX IF NOT EXISTS idx_plans_modalities ON plans USING GIN (modalities);

COMMENT ON COLUMN plans.modalities IS 'Array of modality UUIDs included in this plan';
COMMENT ON COLUMN plans.commitment_months IS 'Minimum commitment period in months (affects commitment discount)';
COMMENT ON COLUMN plans.pricing_override IS 'JSON object to override pricing_config values: {base_price_cents, extra_modality_price_cents, enrollment_fee_cents}';
COMMENT ON COLUMN plans.visible IS 'If false, plan is hidden from enrollment UI but still valid for existing subscribers';
