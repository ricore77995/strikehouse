
-- =============================================
-- CORREÇÕES DE SEGURANÇA
-- =============================================

-- Corrigir search_path nas funções de trigger
CREATE OR REPLACE FUNCTION trigger_generate_member_qr()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NEW.qr_code IS NULL OR NEW.qr_code = '' THEN
        NEW.qr_code := generate_member_qr();
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_generate_payment_ref()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NEW.reference IS NULL OR NEW.reference = '' THEN
        NEW.reference := generate_payment_reference();
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_update_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_update_cash_expected()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NEW.payment_method = 'DINHEIRO' THEN
        UPDATE cash_sessions
        SET expected_closing_cents = calculate_expected_closing(NEW.transaction_date)
        WHERE session_date = NEW.transaction_date
          AND status = 'OPEN';
    END IF;
    RETURN NEW;
END;
$$;

-- Corrigir search_path nas funções utilitárias
CREATE OR REPLACE FUNCTION generate_member_qr() 
RETURNS VARCHAR(20) 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    new_qr VARCHAR(20);
    exists_count INTEGER;
BEGIN
    LOOP
        new_qr := 'MBR-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
        SELECT COUNT(*) INTO exists_count FROM members WHERE qr_code = new_qr;
        IF exists_count = 0 THEN
            RETURN new_qr;
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION generate_payment_reference() 
RETURNS VARCHAR(20) 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    new_ref VARCHAR(20);
    seq INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM 4) AS INTEGER)), 0) + 1 
    INTO seq 
    FROM pending_payments;
    
    new_ref := 'BM-' || LPAD(seq::TEXT, 6, '0');
    RETURN new_ref;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_expected_closing(p_session_date DATE)
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    opening INTEGER;
    receitas INTEGER;
    despesas_dinheiro INTEGER;
BEGIN
    SELECT opening_balance_cents INTO opening
    FROM cash_sessions
    WHERE session_date = p_session_date;
    
    SELECT COALESCE(SUM(amount_cents), 0) INTO receitas
    FROM transactions
    WHERE transaction_date = p_session_date
      AND type = 'RECEITA'
      AND payment_method = 'DINHEIRO';
    
    SELECT COALESCE(SUM(amount_cents), 0) INTO despesas_dinheiro
    FROM transactions
    WHERE transaction_date = p_session_date
      AND type = 'DESPESA'
      AND payment_method = 'DINHEIRO';
    
    RETURN opening + receitas - despesas_dinheiro;
END;
$$;

-- Corrigir views para usar SECURITY INVOKER (padrão seguro)
DROP VIEW IF EXISTS v_active_members;
DROP VIEW IF EXISTS v_expiring_members;
DROP VIEW IF EXISTS v_overdue_members;
DROP VIEW IF EXISTS v_today_rentals;
DROP VIEW IF EXISTS v_daily_summary;

CREATE VIEW v_active_members 
WITH (security_invoker = true)
AS
SELECT 
    m.*,
    p.nome as plano_nome,
    p.preco_cents as plano_preco
FROM members m
LEFT JOIN plans p ON p.tipo = m.access_type
WHERE m.status = 'ATIVO'
  AND (m.access_expires_at IS NULL OR m.access_expires_at >= CURRENT_DATE);

CREATE VIEW v_expiring_members 
WITH (security_invoker = true)
AS
SELECT 
    m.*,
    m.access_expires_at - CURRENT_DATE as dias_restantes
FROM members m
WHERE m.status = 'ATIVO'
  AND m.access_expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
ORDER BY m.access_expires_at;

CREATE VIEW v_overdue_members 
WITH (security_invoker = true)
AS
SELECT 
    m.*,
    CURRENT_DATE - m.access_expires_at as dias_atraso
FROM members m
WHERE m.status IN ('ATIVO', 'BLOQUEADO')
  AND m.access_expires_at < CURRENT_DATE
ORDER BY m.access_expires_at;

CREATE VIEW v_today_rentals 
WITH (security_invoker = true)
AS
SELECT 
    r.*,
    c.nome as coach_nome,
    c.modalidade,
    a.nome as area_nome
FROM rentals r
JOIN external_coaches c ON c.id = r.coach_id
JOIN areas a ON a.id = r.area_id
WHERE r.rental_date = CURRENT_DATE
  AND r.status = 'SCHEDULED'
ORDER BY r.start_time;

CREATE VIEW v_daily_summary 
WITH (security_invoker = true)
AS
SELECT 
    transaction_date,
    SUM(CASE WHEN type = 'RECEITA' THEN amount_cents ELSE 0 END) as receita_cents,
    SUM(CASE WHEN type = 'DESPESA' THEN amount_cents ELSE 0 END) as despesa_cents,
    SUM(CASE WHEN type = 'RECEITA' THEN amount_cents ELSE -amount_cents END) as resultado_cents,
    COUNT(CASE WHEN type = 'RECEITA' THEN 1 END) as num_receitas,
    COUNT(CASE WHEN type = 'DESPESA' THEN 1 END) as num_despesas
FROM transactions
GROUP BY transaction_date
ORDER BY transaction_date DESC;
