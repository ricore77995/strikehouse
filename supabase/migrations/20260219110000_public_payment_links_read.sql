-- Migration: Allow public read of payment links
-- Date: 2026-02-19
-- Description: Adds RLS policy to allow anonymous users to read active payment links
--              for self-service enrollment via public /membership page

-- Allow anonymous users to SELECT active payment links with enrollment fee
CREATE POLICY "Public can view enrollment payment links"
ON stripe_payment_links FOR SELECT
TO anon
USING (
  ativo = true
  AND includes_enrollment_fee = true
);

COMMENT ON POLICY "Public can view enrollment payment links" ON stripe_payment_links IS
'Allows /membership page to display enrollment plans to visitors.';
