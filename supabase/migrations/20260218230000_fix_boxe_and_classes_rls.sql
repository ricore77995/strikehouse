-- Fix: Enable Boxe modality
UPDATE modalities SET ativo = true WHERE code = 'boxe';

-- Fix: Classes RLS policy for authenticated users viewing active classes
-- The existing policy "Authenticated users can view active classes" only allows viewing
-- but there might be an issue with how policies overlap

-- Drop and recreate the view policy to ensure it works properly
DROP POLICY IF EXISTS "Authenticated users can view active classes" ON classes;

CREATE POLICY "Anyone authenticated can view active classes" ON classes
  FOR SELECT TO authenticated
  USING (ativo = true);

-- Also allow public read of modalities for the enrollment page
-- (modalities don't need RLS restrictions for reading)
DROP POLICY IF EXISTS "Anyone can view active modalities" ON modalities;
CREATE POLICY "Anyone can view active modalities" ON modalities
  FOR SELECT TO authenticated
  USING (ativo = true);
