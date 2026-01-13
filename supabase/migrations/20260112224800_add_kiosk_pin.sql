-- Add kiosk_pin setting (only OWNER can see/edit)

-- Insert default kiosk PIN
INSERT INTO gym_settings (key, value, description) VALUES
    ('kiosk_pin', '123456', 'PIN para acesso ao quiosque de check-in (apenas OWNER)')
ON CONFLICT (key) DO NOTHING;

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Staff can view settings" ON gym_settings;

-- Create new SELECT policy that hides kiosk_pin from non-OWNER
CREATE POLICY "Staff can view settings (restricted)" ON gym_settings
    FOR SELECT TO authenticated
    USING (
        -- OWNER can see everything
        EXISTS (
            SELECT 1 FROM staff
            WHERE staff.user_id = auth.uid()
            AND staff.role = 'OWNER'
        )
        OR
        -- Non-OWNER cannot see kiosk_pin
        key != 'kiosk_pin'
    );

-- Update existing UPDATE policy to only allow OWNER for kiosk_pin
DROP POLICY IF EXISTS "Admin can update settings" ON gym_settings;

CREATE POLICY "Admin can update settings (restricted)" ON gym_settings
    FOR UPDATE TO authenticated
    USING (
        CASE
            WHEN key = 'kiosk_pin' THEN
                -- Only OWNER can update kiosk_pin
                EXISTS (
                    SELECT 1 FROM staff
                    WHERE staff.user_id = auth.uid()
                    AND staff.role = 'OWNER'
                )
            ELSE
                -- OWNER and ADMIN can update other settings
                EXISTS (
                    SELECT 1 FROM staff
                    WHERE staff.user_id = auth.uid()
                    AND staff.role IN ('OWNER', 'ADMIN')
                )
        END
    );

-- Create function to validate kiosk PIN (can be called anonymously)
CREATE OR REPLACE FUNCTION validate_kiosk_pin(input_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    stored_pin TEXT;
BEGIN
    SELECT value INTO stored_pin
    FROM gym_settings
    WHERE key = 'kiosk_pin';

    RETURN stored_pin = input_pin;
END;
$$;

-- Allow anonymous access to the validation function
GRANT EXECUTE ON FUNCTION validate_kiosk_pin(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_kiosk_pin(TEXT) TO authenticated;
