-- Coach Guests Table
-- Stores persistent guest records per coach for CRUD management

CREATE TABLE coach_guests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id        UUID NOT NULL REFERENCES external_coaches(id) ON DELETE CASCADE,
    nome            VARCHAR(255) NOT NULL,
    telefone        VARCHAR(20),
    email           VARCHAR(255),
    notas           TEXT,                    -- Optional notes about the guest
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_coach_guests_coach ON coach_guests(coach_id);
CREATE INDEX idx_coach_guests_ativo ON coach_guests(ativo);
CREATE INDEX idx_coach_guests_nome ON coach_guests(nome);

-- Add guest_id reference to check_ins table for linking check-ins to persistent guests
ALTER TABLE check_ins ADD COLUMN guest_id UUID REFERENCES coach_guests(id) ON DELETE SET NULL;
CREATE INDEX idx_checkins_guest ON check_ins(guest_id);

-- RLS Policies
ALTER TABLE coach_guests ENABLE ROW LEVEL SECURITY;

-- Coaches can manage their own guests
CREATE POLICY "Coaches can view their own guests"
    ON coach_guests FOR SELECT
    USING (
        coach_id IN (
            SELECT id FROM external_coaches WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches can insert their own guests"
    ON coach_guests FOR INSERT
    WITH CHECK (
        coach_id IN (
            SELECT id FROM external_coaches WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches can update their own guests"
    ON coach_guests FOR UPDATE
    USING (
        coach_id IN (
            SELECT id FROM external_coaches WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches can delete their own guests"
    ON coach_guests FOR DELETE
    USING (
        coach_id IN (
            SELECT id FROM external_coaches WHERE user_id = auth.uid()
        )
    );

-- Staff can view all guests
CREATE POLICY "Staff can view all guests"
    ON coach_guests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM staff WHERE user_id = auth.uid() AND ativo = true
        )
    );

-- Staff can manage all guests (for admin purposes)
CREATE POLICY "Staff can manage all guests"
    ON coach_guests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM staff WHERE user_id = auth.uid() AND ativo = true AND role IN ('OWNER', 'ADMIN')
        )
    );
