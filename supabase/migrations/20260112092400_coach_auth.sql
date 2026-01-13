-- Migration: Coach Independent Authentication
-- Allows coaches to login directly via external_coaches table, not through staff

-- 1. Add user_id column to external_coaches
ALTER TABLE external_coaches
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add unique constraint
ALTER TABLE external_coaches
ADD CONSTRAINT unique_coach_user_id UNIQUE (user_id);

-- 2. Create RLS policies for direct coach access

-- Coach can view own data
CREATE POLICY "Coach can view own data (direct)" ON external_coaches
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Coach can view own rentals
CREATE POLICY "Coach can view own rentals (direct)" ON rentals
    FOR SELECT TO authenticated
    USING (coach_id = (SELECT id FROM external_coaches WHERE user_id = auth.uid()));

-- Coach can update own rentals (for cancellation)
CREATE POLICY "Coach can update own rentals (direct)" ON rentals
    FOR UPDATE TO authenticated
    USING (coach_id = (SELECT id FROM external_coaches WHERE user_id = auth.uid()));

-- Coach can view own credits
CREATE POLICY "Coach can view own credits (direct)" ON coach_credits
    FOR SELECT TO authenticated
    USING (coach_id = (SELECT id FROM external_coaches WHERE user_id = auth.uid()));

-- Coach can view areas (for rental booking display)
CREATE POLICY "Coach can view areas" ON areas
    FOR SELECT TO authenticated
    USING (true);

-- 3. Helper function to get coach_id from auth.uid()
CREATE OR REPLACE FUNCTION public.get_coach_id_from_auth()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT id FROM external_coaches WHERE user_id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Remove PARTNER from staff (cleanup old data if any)
-- Note: This deletes any existing PARTNER staff members
DELETE FROM staff WHERE role = 'PARTNER';
