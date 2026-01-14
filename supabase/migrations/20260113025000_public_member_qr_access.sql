-- Migration: Permitir acesso público a dados do membro via QR code
-- Necessário para:
-- 1. Página pública /m/MBR-XXXXXXXX (membro vê seu próprio QR)
-- 2. Quiosque de check-in (acesso sem login de staff)

-- Função que retorna dados do membro pelo QR code (sem expor dados sensíveis)
CREATE OR REPLACE FUNCTION get_member_by_qr(qr_code_input TEXT)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    telefone TEXT,
    email TEXT,
    status TEXT,
    access_type TEXT,
    access_expires_at DATE,
    credits_remaining INTEGER,
    qr_code TEXT
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
        m.qr_code
    FROM members m
    WHERE m.qr_code = UPPER(qr_code_input);
END;
$$;

-- Permitir acesso anônimo e autenticado à função
GRANT EXECUTE ON FUNCTION get_member_by_qr(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_member_by_qr(TEXT) TO authenticated;

-- Comentário
COMMENT ON FUNCTION get_member_by_qr IS 'Retorna dados do membro pelo QR code. Usado na página pública do membro e no quiosque de check-in.';
