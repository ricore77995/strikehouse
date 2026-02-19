-- Migration: Create system staff for webhook operations
-- This staff entry is used as created_by for transactions created by the webhook
-- The user_id is NULL because this is a system user, not a real login

INSERT INTO staff (id, user_id, email, nome, role, ativo)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  NULL,  -- No auth.users entry needed for system user
  'system@boxemaster.internal',
  'Sistema',
  'STAFF',
  true
) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE staff IS 'Staff members including system user for automated operations';
