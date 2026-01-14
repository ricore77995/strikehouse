-- Migration: Create pricing_config singleton table
-- Global pricing parameters for the gym (one row per gym)

CREATE TABLE pricing_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_price_cents INTEGER NOT NULL DEFAULT 6000,
    extra_modality_price_cents INTEGER NOT NULL DEFAULT 3000,
    single_class_price_cents INTEGER NOT NULL DEFAULT 1500,
    day_pass_price_cents INTEGER NOT NULL DEFAULT 2500,
    enrollment_fee_cents INTEGER NOT NULL DEFAULT 1500,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES staff(id)
);

-- Insert single row with default values
INSERT INTO pricing_config DEFAULT VALUES;

-- Singleton pattern: ensure only one row can exist
CREATE UNIQUE INDEX idx_pricing_config_singleton ON pricing_config ((true));

-- Enable RLS
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- All authenticated users can read pricing config
CREATE POLICY "pricing_config_read_policy" ON pricing_config
    FOR SELECT
    TO authenticated
    USING (true);

-- Only admins and owners can update pricing config
CREATE POLICY "pricing_config_update_policy" ON pricing_config
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff
            WHERE staff.user_id = auth.uid()
            AND staff.role IN ('ADMIN', 'OWNER')
        )
    );

COMMENT ON TABLE pricing_config IS 'Global pricing parameters (singleton table)';
COMMENT ON COLUMN pricing_config.base_price_cents IS 'Price for first modality in cents (default: €60.00)';
COMMENT ON COLUMN pricing_config.extra_modality_price_cents IS 'Price per additional modality in cents (default: €30.00)';
COMMENT ON COLUMN pricing_config.single_class_price_cents IS 'Price for single class drop-in in cents (default: €15.00)';
COMMENT ON COLUMN pricing_config.day_pass_price_cents IS 'Price for day pass in cents (default: €25.00)';
COMMENT ON COLUMN pricing_config.enrollment_fee_cents IS 'Default enrollment fee for new members in cents (default: €15.00)';
