-- Add UNIQUE constraints on telefone and email to prevent duplicate members
-- IMPORTANT: Run reset-dynamic-data.sql FIRST if you have duplicate members

-- Unique constraint on telefone (required field)
ALTER TABLE members ADD CONSTRAINT unique_member_telefone UNIQUE(telefone);

-- Unique partial index on email (only when not NULL since email is optional)
CREATE UNIQUE INDEX unique_member_email ON members(email) WHERE email IS NOT NULL;

COMMENT ON CONSTRAINT unique_member_telefone ON members IS 'Prevents duplicate members with same phone';
COMMENT ON INDEX unique_member_email IS 'Prevents duplicate members with same email (when email is provided)';
