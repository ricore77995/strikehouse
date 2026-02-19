-- Migration: Allow public member signup
-- Date: 2026-02-19
-- Description: Adds RLS policy to allow anonymous users to create LEAD members
--              for self-service enrollment via public /membership page

-- Allow anonymous users to INSERT members (only as LEAD status)
CREATE POLICY "Public can create LEAD members"
ON members FOR INSERT
TO anon
WITH CHECK (
  status = 'LEAD'
  AND nome IS NOT NULL
  AND telefone IS NOT NULL
  AND email IS NOT NULL
);

-- Allow anonymous users to SELECT members by email/phone (to check if exists)
-- This is needed for the duplicate check before redirect
CREATE POLICY "Public can check if member exists by contact"
ON members FOR SELECT
TO anon
USING (true);

-- Note: The webhook uses service_role so it bypasses RLS
-- The authenticated staff can still manage all members via existing policies

COMMENT ON POLICY "Public can create LEAD members" ON members IS
'Allows self-service signup via /membership page. Only LEAD status allowed.';

COMMENT ON POLICY "Public can check if member exists by contact" ON members IS
'Allows checking if a member already exists before creating duplicate.';
