-- Migration: Create subscriptions table
-- Immutable snapshot of member's plan at time of purchase

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id),

    -- Snapshot of selected options
    modalities UUID[] NOT NULL DEFAULT '{}',
    commitment_months INTEGER NOT NULL DEFAULT 1,

    -- Discount references
    commitment_discount_id UUID REFERENCES discounts(id),
    promo_discount_id UUID REFERENCES discounts(id),

    -- Price snapshot (immutable - captures pricing at time of purchase)
    calculated_price_cents INTEGER NOT NULL,  -- Base price before discounts
    commitment_discount_pct INTEGER NOT NULL DEFAULT 0,
    promo_discount_pct INTEGER NOT NULL DEFAULT 0,
    final_price_cents INTEGER NOT NULL,  -- Final price after all discounts
    enrollment_fee_cents INTEGER NOT NULL DEFAULT 0,

    -- Access period
    starts_at DATE NOT NULL DEFAULT CURRENT_DATE,
    expires_at DATE,
    credits_remaining INTEGER,

    -- Status
    status VARCHAR(15) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'cancelled')),

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES staff(id),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID REFERENCES staff(id),
    cancellation_reason TEXT
);

-- Indexes for common queries
CREATE INDEX idx_subscriptions_member ON subscriptions(member_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires ON subscriptions(expires_at) WHERE status = 'active';
CREATE INDEX idx_subscriptions_plan ON subscriptions(plan_id);

-- GIN index for modalities array
CREATE INDEX idx_subscriptions_modalities ON subscriptions USING GIN (modalities);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Staff can read all subscriptions
CREATE POLICY "subscriptions_read_policy" ON subscriptions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff
            WHERE staff.user_id = auth.uid()
            AND staff.role IN ('ADMIN', 'OWNER', 'STAFF')
        )
    );

-- Staff can create subscriptions
CREATE POLICY "subscriptions_insert_policy" ON subscriptions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM staff
            WHERE staff.user_id = auth.uid()
            AND staff.role IN ('ADMIN', 'STAFF')
        )
    );

-- Only admins can update/delete subscriptions
CREATE POLICY "subscriptions_update_policy" ON subscriptions
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff
            WHERE staff.user_id = auth.uid()
            AND staff.role IN ('ADMIN', 'OWNER')
        )
    );

COMMENT ON TABLE subscriptions IS 'Immutable snapshot of member plan subscription at time of purchase';
COMMENT ON COLUMN subscriptions.calculated_price_cents IS 'Base price from formula: B + (M-1) × E';
COMMENT ON COLUMN subscriptions.commitment_discount_pct IS 'Commitment discount percentage applied (snapshot)';
COMMENT ON COLUMN subscriptions.promo_discount_pct IS 'Promo code discount percentage applied (snapshot)';
COMMENT ON COLUMN subscriptions.final_price_cents IS 'Final monthly price after all discounts';
COMMENT ON COLUMN subscriptions.enrollment_fee_cents IS 'One-time fee charged at enrollment (only for LEAD->ATIVO)';
