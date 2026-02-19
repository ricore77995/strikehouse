-- Migration: Fix get_member_by_qr type mismatch
-- Date: 2026-02-19
-- Description: Explicitly cast VARCHAR columns to TEXT to match return type declaration
-- Error was: "Returned type character varying(255) does not match expected type text in column 2"

-- Must DROP first because we're changing the function body
DROP FUNCTION IF EXISTS get_member_by_qr(TEXT);

-- Recreate with explicit casts to TEXT
CREATE FUNCTION get_member_by_qr(qr_code_input TEXT)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    telefone TEXT,
    email TEXT,
    status TEXT,
    access_type TEXT,
    access_expires_at DATE,
    credits_remaining INTEGER,
    qr_code TEXT,
    weekly_limit INTEGER,
    modalities_count INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.nome::TEXT,
        m.telefone::TEXT,
        m.email::TEXT,
        m.status::TEXT,
        m.access_type::TEXT,
        m.access_expires_at,
        m.credits_remaining,
        m.qr_code::TEXT,
        m.weekly_limit,
        m.modalities_count
    FROM members m
    WHERE m.qr_code = UPPER(qr_code_input);
END;
$$;

-- Re-grant permissions for anonymous access (public QR page)
GRANT EXECUTE ON FUNCTION get_member_by_qr(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_member_by_qr(TEXT) TO authenticated;

COMMENT ON FUNCTION get_member_by_qr IS 'Retorna dados do membro pelo QR code incluindo limites de acesso. Usado na pagina publica do membro e no quiosque de check-in.';
