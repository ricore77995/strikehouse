-- Migration: Create modalities table for pricing engine
-- Modalities represent the martial arts disciplines available at the gym

CREATE TABLE modalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default modalities
INSERT INTO modalities (code, nome, sort_order) VALUES
    ('boxe', 'Boxe', 1),
    ('muay_thai', 'Muay Thai', 2),
    ('jiu_jitsu', 'Jiu-Jitsu', 3),
    ('mma', 'MMA', 4),
    ('kickboxing', 'Kickboxing', 5),
    ('wrestling', 'Wrestling', 6),
    ('funcional', 'Funcional', 7);

-- Create index for sorting
CREATE INDEX idx_modalities_sort ON modalities(sort_order) WHERE ativo = true;

-- Enable RLS
ALTER TABLE modalities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- All authenticated users can read active modalities
CREATE POLICY "modalities_read_policy" ON modalities
    FOR SELECT
    TO authenticated
    USING (ativo = true);

-- Only admins and owners can manage modalities
CREATE POLICY "modalities_admin_policy" ON modalities
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff
            WHERE staff.user_id = auth.uid()
            AND staff.role IN ('ADMIN', 'OWNER')
        )
    );

COMMENT ON TABLE modalities IS 'Martial arts disciplines available for subscription plans';
COMMENT ON COLUMN modalities.code IS 'Unique identifier for the modality (e.g., boxe, muay_thai)';
COMMENT ON COLUMN modalities.sort_order IS 'Display order in UI selections';
