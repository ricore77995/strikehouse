-- Create gym_settings table for configurable system parameters
CREATE TABLE IF NOT EXISTS gym_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES staff(id)
);

-- Enable RLS
ALTER TABLE gym_settings ENABLE ROW LEVEL SECURITY;

-- Policies: OWNER and ADMIN can read/write, STAFF can only read
CREATE POLICY "Staff can view settings" ON gym_settings
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Admin can update settings" ON gym_settings
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff
            WHERE staff.user_id = auth.uid()
            AND staff.role IN ('OWNER', 'ADMIN')
        )
    );

CREATE POLICY "Admin can insert settings" ON gym_settings
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM staff
            WHERE staff.user_id = auth.uid()
            AND staff.role IN ('OWNER', 'ADMIN')
        )
    );

-- Insert default settings
INSERT INTO gym_settings (key, value, description) VALUES
    ('cancellation_hours_threshold', '24', 'Horas mínimas de antecedência para cancelamento com crédito'),
    ('credit_expiry_days', '90', 'Dias até expirar créditos de cancelamento'),
    ('min_rental_duration', '60', 'Duração mínima de rental em minutos'),
    ('max_advance_booking_days', '30', 'Máximo de dias para reserva antecipada')
ON CONFLICT (key) DO NOTHING;

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_gym_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS gym_settings_updated_at ON gym_settings;
CREATE TRIGGER gym_settings_updated_at
    BEFORE UPDATE ON gym_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_gym_settings_timestamp();
