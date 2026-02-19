-- Migration: Update get_member_by_qr to include weekly_limit and modalities_count
-- Date: 2026-02-17
-- Description: Adds weekly_limit and modalities_count to the RPC function for check-in validation

-- Must DROP first because return type is changing
DROP FUNCTION IF EXISTS get_member_by_qr(TEXT);

-- Recreate with new columns
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
        m.nome,
        m.telefone,
        m.email,
        m.status,
        m.access_type,
        m.access_expires_at,
        m.credits_remaining,
        m.qr_code,
        m.weekly_limit,
        m.modalities_count
    FROM members m
    WHERE m.qr_code = UPPER(qr_code_input);
END;
$$;

-- Permissions remain the same (already granted)
COMMENT ON FUNCTION get_member_by_qr IS 'Retorna dados do membro pelo QR code incluindo limites de acesso. Usado na pagina publica do membro e no quiosque de check-in.';
