-- Migration: Create discounts table
-- Unified table for commitment discounts and promo codes

CREATE TABLE discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('commitment', 'promo')),
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value INTEGER NOT NULL CHECK (discount_value >= 0),
    min_commitment_months INTEGER,
    valid_from DATE,
    valid_until DATE,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    new_members_only BOOLEAN DEFAULT false,
    referrer_credit_cents INTEGER,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES staff(id)
);

-- Insert default commitment discounts
INSERT INTO discounts (code, nome, category, discount_type, discount_value, min_commitment_months) VALUES
    ('MENSAL', 'Sem Compromisso', 'commitment', 'percentage', 0, 1),
    ('TRIMESTRAL', 'Desconto Trimestral', 'commitment', 'percentage', 10, 3),
    ('SEMESTRAL', 'Desconto Semestral', 'commitment', 'percentage', 15, 6),
    ('ANUAL', 'Desconto Anual', 'commitment', 'percentage', 20, 12);

-- Indexes for common queries
CREATE INDEX idx_discounts_category ON discounts(category) WHERE ativo = true;
CREATE INDEX idx_discounts_code ON discounts(code) WHERE ativo = true;
CREATE INDEX idx_discounts_commitment ON discounts(min_commitment_months)
    WHERE category = 'commitment' AND ativo = true;

-- Enable RLS
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- All authenticated users can read active discounts
CREATE POLICY "discounts_read_policy" ON discounts
    FOR SELECT
    TO authenticated
    USING (ativo = true);

-- Only admins and owners can manage discounts
CREATE POLICY "discounts_admin_policy" ON discounts
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff
            WHERE staff.user_id = auth.uid()
            AND staff.role IN ('ADMIN', 'OWNER')
        )
    );

COMMENT ON TABLE discounts IS 'Commitment discounts and promotional codes';
COMMENT ON COLUMN discounts.category IS 'commitment = auto-applies by period, promo = requires code input';
COMMENT ON COLUMN discounts.discount_type IS 'percentage = % off, fixed = flat amount off in cents';
COMMENT ON COLUMN discounts.discount_value IS 'Percentage (0-100) or cents depending on discount_type';
COMMENT ON COLUMN discounts.min_commitment_months IS 'Minimum commitment months required for discount (commitment category)';
COMMENT ON COLUMN discounts.new_members_only IS 'If true, only applies to LEAD status members';
COMMENT ON COLUMN discounts.referrer_credit_cents IS 'Credit given to referrer when this code is used (future referral feature)';
