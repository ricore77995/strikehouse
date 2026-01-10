
-- =============================================
-- BOXEMASTER PRO - DATABASE SCHEMA
-- Version: 1.7.1
-- =============================================

-- Habilitar extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PLANOS
-- =============================================

CREATE TABLE plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(100) NOT NULL,
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('SUBSCRIPTION', 'CREDITS', 'DAILY_PASS')),
    preco_cents     INTEGER NOT NULL CHECK (preco_cents > 0),
    duracao_dias    INTEGER,
    creditos        INTEGER,
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO plans (nome, tipo, preco_cents, duracao_dias, creditos) VALUES
('Mensal', 'SUBSCRIPTION', 6900, 30, NULL),
('Trimestral', 'SUBSCRIPTION', 17900, 90, NULL),
('Anual', 'SUBSCRIPTION', 59900, 365, NULL),
('Pack 10 Aulas', 'CREDITS', 6500, 90, 10),
('Pack 20 Aulas', 'CREDITS', 11900, 180, 20),
('Diária', 'DAILY_PASS', 1200, 1, NULL);

CREATE INDEX idx_plans_tipo ON plans(tipo);
CREATE INDEX idx_plans_ativo ON plans(ativo);

-- =============================================
-- MEMBROS
-- =============================================

CREATE TABLE members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                VARCHAR(255) NOT NULL,
    email               VARCHAR(255),
    telefone            VARCHAR(20) NOT NULL,
    qr_code             VARCHAR(20) UNIQUE NOT NULL,
    status              VARCHAR(15) DEFAULT 'LEAD' 
                        CHECK (status IN ('LEAD', 'ATIVO', 'BLOQUEADO', 'CANCELADO')),
    access_type         VARCHAR(20) CHECK (access_type IN ('SUBSCRIPTION', 'CREDITS', 'DAILY_PASS')),
    access_expires_at   DATE,
    credits_remaining   INTEGER DEFAULT 0,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_telefone ON members(telefone);
CREATE INDEX idx_members_qr ON members(qr_code);
CREATE INDEX idx_members_expires ON members(access_expires_at);
CREATE INDEX idx_members_nome_lower ON members(LOWER(nome));

-- =============================================
-- IBANS DOS MEMBROS
-- =============================================

CREATE TABLE member_ibans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    iban        VARCHAR(34) NOT NULL,
    label       VARCHAR(50),
    is_primary  BOOLEAN DEFAULT false,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_member_ibans_member ON member_ibans(member_id);
CREATE INDEX idx_member_ibans_iban ON member_ibans(iban);

-- =============================================
-- ÁREAS DA ACADEMIA
-- =============================================

CREATE TABLE areas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(100) NOT NULL,
    capacidade_pts  INTEGER NOT NULL DEFAULT 1,
    is_exclusive    BOOLEAN DEFAULT false,
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO areas (nome, capacidade_pts, is_exclusive) VALUES
('Ringue', 1, false),
('Área de Sacos', 3, false),
('Funcional', 2, false),
('Espaço Completo', 1, true);

CREATE INDEX idx_areas_ativo ON areas(ativo);

-- =============================================
-- COACHES EXTERNOS (Partners)
-- =============================================

CREATE TABLE external_coaches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(255) NOT NULL,
    email           VARCHAR(255),
    telefone        VARCHAR(20),
    modalidade      VARCHAR(100),
    fee_type        VARCHAR(15) NOT NULL CHECK (fee_type IN ('FIXED', 'PERCENTAGE')),
    fee_value       INTEGER NOT NULL,
    credits_balance INTEGER DEFAULT 0,
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coaches_ativo ON external_coaches(ativo);

-- =============================================
-- CRÉDITOS DE COACHES
-- =============================================

CREATE TABLE coach_credits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id        UUID NOT NULL REFERENCES external_coaches(id) ON DELETE CASCADE,
    amount          INTEGER NOT NULL,
    reason          VARCHAR(50) NOT NULL 
                    CHECK (reason IN ('CANCELLATION', 'USED', 'EXPIRED', 'ADJUSTMENT')),
    rental_id       UUID,
    expires_at      DATE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coach_credits_coach ON coach_credits(coach_id);
CREATE INDEX idx_coach_credits_expires ON coach_credits(expires_at);

-- =============================================
-- RENTALS (Sublocação)
-- =============================================

CREATE TABLE rentals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id        UUID NOT NULL REFERENCES external_coaches(id),
    area_id         UUID NOT NULL REFERENCES areas(id),
    rental_date     DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    is_recurring    BOOLEAN DEFAULT false,
    series_id       UUID,
    status          VARCHAR(15) DEFAULT 'SCHEDULED' 
                    CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
    guest_count     INTEGER DEFAULT 0,
    fee_charged_cents INTEGER,
    cancelled_at    TIMESTAMP WITH TIME ZONE,
    cancelled_by    UUID,
    credit_generated BOOLEAN DEFAULT false,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by      UUID
);

CREATE INDEX idx_rentals_coach ON rentals(coach_id);
CREATE INDEX idx_rentals_area ON rentals(area_id);
CREATE INDEX idx_rentals_date ON rentals(rental_date);
CREATE INDEX idx_rentals_status ON rentals(status);
CREATE INDEX idx_rentals_series ON rentals(series_id);
CREATE INDEX idx_rentals_date_area ON rentals(rental_date, area_id);

-- =============================================
-- CHECK-INS
-- =============================================

CREATE TABLE check_ins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       UUID REFERENCES members(id),
    guest_name      VARCHAR(255),
    type            VARCHAR(10) NOT NULL CHECK (type IN ('MEMBER', 'GUEST')),
    rental_id       UUID REFERENCES rentals(id),
    result          VARCHAR(20) NOT NULL 
                    CHECK (result IN ('ALLOWED', 'BLOCKED', 'EXPIRED', 'NO_CREDITS')),
    checked_in_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checked_in_by   UUID
);

CREATE INDEX idx_checkins_member ON check_ins(member_id);
CREATE INDEX idx_checkins_date ON check_ins(checked_in_at);
CREATE INDEX idx_checkins_type ON check_ins(type);
CREATE INDEX idx_checkins_rental ON check_ins(rental_id);

-- =============================================
-- CATEGORIAS FINANCEIRAS
-- =============================================

CREATE TABLE categories (
    code        VARCHAR(30) PRIMARY KEY,
    nome        VARCHAR(100) NOT NULL,
    type        VARCHAR(10) NOT NULL CHECK (type IN ('RECEITA', 'DESPESA'))
);

INSERT INTO categories (code, nome, type) VALUES
    ('SUBSCRIPTION', 'Mensalidade', 'RECEITA'),
    ('CREDITS', 'Pack de Créditos', 'RECEITA'),
    ('DAILY_PASS', 'Diária', 'RECEITA'),
    ('RENTAL_FIXED', 'Sublocação (Taxa Fixa)', 'RECEITA'),
    ('RENTAL_PERCENTAGE', 'Sublocação (Percentual)', 'RECEITA'),
    ('PRODUTOS', 'Venda de Produtos', 'RECEITA'),
    ('OUTROS_REC', 'Outras Receitas', 'RECEITA'),
    ('ALUGUEL', 'Aluguel', 'DESPESA'),
    ('LUZ', 'Energia Elétrica', 'DESPESA'),
    ('AGUA', 'Água', 'DESPESA'),
    ('INTERNET', 'Internet', 'DESPESA'),
    ('SALARIOS', 'Salários', 'DESPESA'),
    ('COACHES', 'Pagamento Coaches', 'DESPESA'),
    ('LIMPEZA', 'Limpeza', 'DESPESA'),
    ('EQUIPAMENTOS', 'Equipamentos', 'DESPESA'),
    ('MARKETING', 'Marketing', 'DESPESA'),
    ('MANUTENCAO', 'Manutenção', 'DESPESA'),
    ('OUTROS_DESP', 'Outras Despesas', 'DESPESA');

-- =============================================
-- PRODUTOS
-- =============================================

CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(100) NOT NULL,
    preco_cents     INTEGER NOT NULL CHECK (preco_cents > 0),
    categoria       VARCHAR(30) CHECK (categoria IN ('EQUIPAMENTO', 'VESTUARIO', 'SUPLEMENTO', 'ACESSORIO', 'OUTRO')),
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_ativo ON products(ativo);
CREATE INDEX idx_products_categoria ON products(categoria);
CREATE INDEX idx_products_nome_lower ON products(LOWER(nome));

INSERT INTO products (nome, preco_cents, categoria) VALUES
('Luvas de Boxe', 4500, 'EQUIPAMENTO'),
('Camiseta BoxeMaster', 2500, 'VESTUARIO'),
('Protetor Bucal', 1500, 'EQUIPAMENTO'),
('Bandagem (par)', 800, 'ACESSORIO'),
('Caneleira', 3500, 'EQUIPAMENTO'),
('Shorts Muay Thai', 3000, 'VESTUARIO');

-- =============================================
-- STAFF (Usuários do Sistema)
-- =============================================

CREATE TABLE staff (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nome            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'STAFF', 'PARTNER')),
    coach_id        UUID REFERENCES external_coaches(id),
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_staff_user ON staff(user_id);
CREATE INDEX idx_staff_role ON staff(role);
CREATE INDEX idx_staff_ativo ON staff(ativo);

-- =============================================
-- TRANSAÇÕES FINANCEIRAS
-- =============================================

CREATE TABLE transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type                VARCHAR(10) NOT NULL CHECK (type IN ('RECEITA', 'DESPESA')),
    amount_cents        INTEGER NOT NULL CHECK (amount_cents > 0),
    payment_method      VARCHAR(20) NOT NULL 
                        CHECK (payment_method IN ('DINHEIRO', 'MBWAY', 'TRANSFERENCIA', 'CARTAO')),
    category            VARCHAR(30) NOT NULL REFERENCES categories(code),
    description         TEXT,
    transaction_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    member_id           UUID REFERENCES members(id),
    reference_type      VARCHAR(20),
    reference_id        UUID,
    created_by          UUID NOT NULL REFERENCES staff(id),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_member ON transactions(member_id);

-- =============================================
-- VENDAS
-- =============================================

CREATE TABLE sales (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       UUID REFERENCES members(id),
    total_cents     INTEGER NOT NULL CHECK (total_cents > 0),
    payment_method  VARCHAR(20) NOT NULL 
                    CHECK (payment_method IN ('DINHEIRO', 'MBWAY', 'CARTAO')),
    transaction_id  UUID REFERENCES transactions(id),
    created_by      UUID NOT NULL REFERENCES staff(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sales_date ON sales(created_at);
CREATE INDEX idx_sales_member ON sales(member_id);

-- =============================================
-- ITENS DA VENDA
-- =============================================

CREATE TABLE sale_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id             UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id          UUID REFERENCES products(id),
    descricao           VARCHAR(100) NOT NULL,
    quantidade          INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
    preco_unit_cents    INTEGER NOT NULL CHECK (preco_unit_cents > 0),
    subtotal_cents      INTEGER NOT NULL CHECK (subtotal_cents > 0),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- =============================================
-- PAGAMENTOS PENDENTES
-- =============================================

CREATE TABLE pending_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       UUID NOT NULL REFERENCES members(id),
    plan_id         UUID REFERENCES plans(id),
    amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
    reference       VARCHAR(20) UNIQUE NOT NULL,
    payment_method  VARCHAR(20) NOT NULL 
                    CHECK (payment_method IN ('TRANSFERENCIA', 'MBWAY', 'STRIPE')),
    status          VARCHAR(15) DEFAULT 'PENDING' 
                    CHECK (status IN ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),
    stripe_session_id   VARCHAR(255),
    stripe_payment_id   VARCHAR(255),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    confirmed_at    TIMESTAMP WITH TIME ZONE,
    confirmed_by    UUID REFERENCES staff(id),
    transaction_id  UUID REFERENCES transactions(id),
    created_by      UUID REFERENCES staff(id)
);

CREATE INDEX idx_pending_status ON pending_payments(status);
CREATE INDEX idx_pending_reference ON pending_payments(reference);
CREATE INDEX idx_pending_member ON pending_payments(member_id);
CREATE INDEX idx_pending_expires ON pending_payments(expires_at);

-- =============================================
-- CONTROLE DE CAIXA
-- =============================================

CREATE TABLE cash_sessions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_date            DATE NOT NULL UNIQUE,
    opening_balance_cents   INTEGER NOT NULL,
    opened_by               UUID NOT NULL REFERENCES staff(id),
    opened_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expected_closing_cents  INTEGER,
    actual_closing_cents    INTEGER,
    difference_cents        INTEGER,
    closed_by               UUID REFERENCES staff(id),
    closed_at               TIMESTAMP WITH TIME ZONE,
    status                  VARCHAR(10) DEFAULT 'OPEN' 
                            CHECK (status IN ('OPEN', 'CLOSED'))
);

CREATE INDEX idx_cash_sessions_date ON cash_sessions(session_date);
CREATE INDEX idx_cash_sessions_status ON cash_sessions(status);

-- =============================================
-- AUDITORIA
-- =============================================

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES staff(id),
    user_role       VARCHAR(20) NOT NULL,
    action          VARCHAR(50) NOT NULL,
    entity_type     VARCHAR(30) NOT NULL,
    entity_id       UUID,
    description     TEXT NOT NULL,
    old_value       JSONB,
    new_value       JSONB,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_logs(created_at);
CREATE INDEX idx_audit_date_action ON audit_logs(created_at, action);

-- =============================================
-- ADICIONAR FKs CIRCULARES
-- =============================================

ALTER TABLE check_ins ADD CONSTRAINT fk_checkins_staff 
    FOREIGN KEY (checked_in_by) REFERENCES staff(id);

ALTER TABLE rentals ADD CONSTRAINT fk_rentals_created_by 
    FOREIGN KEY (created_by) REFERENCES staff(id);

ALTER TABLE rentals ADD CONSTRAINT fk_rentals_cancelled_by 
    FOREIGN KEY (cancelled_by) REFERENCES staff(id);

ALTER TABLE coach_credits ADD CONSTRAINT fk_coach_credits_rental 
    FOREIGN KEY (rental_id) REFERENCES rentals(id);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function: Gerar QR code único para membro
CREATE OR REPLACE FUNCTION generate_member_qr() 
RETURNS VARCHAR(20) AS $$
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
$$ LANGUAGE plpgsql;

-- Function: Gerar referência única para pagamento pendente
CREATE OR REPLACE FUNCTION generate_payment_reference() 
RETURNS VARCHAR(20) AS $$
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
$$ LANGUAGE plpgsql;

-- Function: Calcular expected_closing do caixa
CREATE OR REPLACE FUNCTION calculate_expected_closing(p_session_date DATE)
RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql;

-- =============================================
-- SECURITY DEFINER FUNCTION FOR ROLE CHECKING
-- =============================================

CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS VARCHAR(20)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM staff WHERE user_id = p_user_id AND ativo = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_staff_member(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff WHERE user_id = p_user_id AND ativo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_staff_role(p_user_id UUID, p_roles VARCHAR[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff 
    WHERE user_id = p_user_id 
      AND ativo = true 
      AND role = ANY(p_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_staff_coach_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coach_id FROM staff WHERE user_id = p_user_id AND role = 'PARTNER' AND ativo = true LIMIT 1;
$$;

-- =============================================
-- TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION trigger_generate_member_qr()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.qr_code IS NULL OR NEW.qr_code = '' THEN
        NEW.qr_code := generate_member_qr();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_member_qr
    BEFORE INSERT ON members
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_member_qr();

CREATE OR REPLACE FUNCTION trigger_generate_payment_ref()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reference IS NULL OR NEW.reference = '' THEN
        NEW.reference := generate_payment_reference();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_ref
    BEFORE INSERT ON pending_payments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_payment_ref();

CREATE OR REPLACE FUNCTION trigger_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_member_updated
    BEFORE UPDATE ON members
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_timestamp();

CREATE OR REPLACE FUNCTION trigger_update_cash_expected()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payment_method = 'DINHEIRO' THEN
        UPDATE cash_sessions
        SET expected_closing_cents = calculate_expected_closing(NEW.transaction_date)
        WHERE session_date = NEW.transaction_date
          AND status = 'OPEN';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transaction_cash
    AFTER INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_cash_expected();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_ibans ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - PUBLIC DATA (read-only for authenticated)
-- =============================================

-- Plans: qualquer usuário autenticado pode ver planos ativos
CREATE POLICY "Anyone can view active plans" ON plans
    FOR SELECT TO authenticated
    USING (ativo = true);

-- Staff com permissão pode gerenciar planos
CREATE POLICY "Admin can manage plans" ON plans
    FOR ALL TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

-- Categories: qualquer autenticado pode ver
CREATE POLICY "Anyone can view categories" ON categories
    FOR SELECT TO authenticated
    USING (true);

-- Areas: qualquer autenticado pode ver áreas ativas
CREATE POLICY "Anyone can view active areas" ON areas
    FOR SELECT TO authenticated
    USING (ativo = true);

CREATE POLICY "Admin can manage areas" ON areas
    FOR ALL TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

-- Products: qualquer autenticado pode ver produtos ativos
CREATE POLICY "Anyone can view active products" ON products
    FOR SELECT TO authenticated
    USING (ativo = true);

CREATE POLICY "Admin can manage products" ON products
    FOR ALL TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

-- =============================================
-- RLS POLICIES - MEMBERS (PII - dados sensíveis)
-- =============================================

CREATE POLICY "Staff can view members" ON members
    FOR SELECT TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

CREATE POLICY "Staff can insert members" ON members
    FOR INSERT TO authenticated
    WITH CHECK (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

CREATE POLICY "Admin can update members" ON members
    FOR UPDATE TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

CREATE POLICY "Admin can delete members" ON members
    FOR DELETE TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

-- Member IBANs: mesmas regras de members
CREATE POLICY "Staff can view member_ibans" ON member_ibans
    FOR SELECT TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

CREATE POLICY "Staff can manage member_ibans" ON member_ibans
    FOR ALL TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

-- =============================================
-- RLS POLICIES - CHECK-INS
-- =============================================

CREATE POLICY "Staff can view check_ins" ON check_ins
    FOR SELECT TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

CREATE POLICY "Staff can insert check_ins" ON check_ins
    FOR INSERT TO authenticated
    WITH CHECK (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

-- =============================================
-- RLS POLICIES - EXTERNAL COACHES
-- =============================================

CREATE POLICY "Staff can view coaches" ON external_coaches
    FOR SELECT TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

CREATE POLICY "Admin can manage coaches" ON external_coaches
    FOR ALL TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

-- Partner pode ver seus próprios dados
CREATE POLICY "Partner can view own coach data" ON external_coaches
    FOR SELECT TO authenticated
    USING (id = public.get_staff_coach_id(auth.uid()));

-- =============================================
-- RLS POLICIES - COACH CREDITS
-- =============================================

CREATE POLICY "Admin can view coach_credits" ON coach_credits
    FOR SELECT TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

CREATE POLICY "Partner can view own credits" ON coach_credits
    FOR SELECT TO authenticated
    USING (coach_id = public.get_staff_coach_id(auth.uid()));

CREATE POLICY "Admin can manage coach_credits" ON coach_credits
    FOR ALL TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

-- =============================================
-- RLS POLICIES - RENTALS
-- =============================================

CREATE POLICY "Staff can view rentals" ON rentals
    FOR SELECT TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

CREATE POLICY "Partner can view own rentals" ON rentals
    FOR SELECT TO authenticated
    USING (coach_id = public.get_staff_coach_id(auth.uid()));

CREATE POLICY "Admin can manage rentals" ON rentals
    FOR ALL TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

CREATE POLICY "Staff can insert rentals" ON rentals
    FOR INSERT TO authenticated
    WITH CHECK (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

-- =============================================
-- RLS POLICIES - TRANSACTIONS (dados financeiros sensíveis)
-- =============================================

CREATE POLICY "Admin can view transactions" ON transactions
    FOR SELECT TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

CREATE POLICY "Staff can insert transactions" ON transactions
    FOR INSERT TO authenticated
    WITH CHECK (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

CREATE POLICY "Admin can manage transactions" ON transactions
    FOR ALL TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

-- =============================================
-- RLS POLICIES - SALES
-- =============================================

CREATE POLICY "Staff can view sales" ON sales
    FOR SELECT TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

CREATE POLICY "Staff can insert sales" ON sales
    FOR INSERT TO authenticated
    WITH CHECK (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

CREATE POLICY "Admin can manage sales" ON sales
    FOR ALL TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

-- =============================================
-- RLS POLICIES - SALE ITEMS
-- =============================================

CREATE POLICY "Staff can view sale_items" ON sale_items
    FOR SELECT TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

CREATE POLICY "Staff can insert sale_items" ON sale_items
    FOR INSERT TO authenticated
    WITH CHECK (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

-- =============================================
-- RLS POLICIES - PENDING PAYMENTS
-- =============================================

CREATE POLICY "Staff can view pending_payments" ON pending_payments
    FOR SELECT TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

CREATE POLICY "Staff can insert pending_payments" ON pending_payments
    FOR INSERT TO authenticated
    WITH CHECK (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

CREATE POLICY "Admin can manage pending_payments" ON pending_payments
    FOR ALL TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

-- =============================================
-- RLS POLICIES - CASH SESSIONS
-- =============================================

CREATE POLICY "Staff can view cash_sessions" ON cash_sessions
    FOR SELECT TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

CREATE POLICY "Staff can manage cash_sessions" ON cash_sessions
    FOR ALL TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN', 'STAFF']));

-- =============================================
-- RLS POLICIES - AUDIT LOGS
-- =============================================

CREATE POLICY "Admin can view audit_logs" ON audit_logs
    FOR SELECT TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

CREATE POLICY "Staff can insert audit_logs" ON audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.is_staff_member(auth.uid()));

-- =============================================
-- RLS POLICIES - STAFF
-- =============================================

CREATE POLICY "Staff can view own record" ON staff
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admin can view all staff" ON staff
    FOR SELECT TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER', 'ADMIN']));

CREATE POLICY "Owner can manage staff" ON staff
    FOR ALL TO authenticated
    USING (public.has_staff_role(auth.uid(), ARRAY['OWNER']));

-- =============================================
-- VIEWS ÚTEIS
-- =============================================

CREATE OR REPLACE VIEW v_active_members AS
SELECT 
    m.*,
    p.nome as plano_nome,
    p.preco_cents as plano_preco
FROM members m
LEFT JOIN plans p ON p.tipo = m.access_type
WHERE m.status = 'ATIVO'
  AND (m.access_expires_at IS NULL OR m.access_expires_at >= CURRENT_DATE);

CREATE OR REPLACE VIEW v_expiring_members AS
SELECT 
    m.*,
    m.access_expires_at - CURRENT_DATE as dias_restantes
FROM members m
WHERE m.status = 'ATIVO'
  AND m.access_expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
ORDER BY m.access_expires_at;

CREATE OR REPLACE VIEW v_overdue_members AS
SELECT 
    m.*,
    CURRENT_DATE - m.access_expires_at as dias_atraso
FROM members m
WHERE m.status IN ('ATIVO', 'BLOQUEADO')
  AND m.access_expires_at < CURRENT_DATE
ORDER BY m.access_expires_at;

CREATE OR REPLACE VIEW v_today_rentals AS
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

CREATE OR REPLACE VIEW v_daily_summary AS
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

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE members IS 'Membros da academia (clientes)';
COMMENT ON TABLE member_ibans IS 'IBANs dos membros para identificação de pagamentos';
COMMENT ON TABLE check_ins IS 'Registro de entradas na academia';
COMMENT ON TABLE plans IS 'Planos disponíveis (mensalidade, créditos, diária)';
COMMENT ON TABLE areas IS 'Áreas da academia para sublocação';
COMMENT ON TABLE external_coaches IS 'Coaches externos (partners) que sublocam espaço';
COMMENT ON TABLE coach_credits IS 'Histórico de créditos dos coaches';
COMMENT ON TABLE rentals IS 'Sublocações de espaço para coaches';
COMMENT ON TABLE categories IS 'Categorias financeiras (receita/despesa)';
COMMENT ON TABLE transactions IS 'Transações financeiras (receitas e despesas)';
COMMENT ON TABLE products IS 'Catálogo de produtos para venda';
COMMENT ON TABLE sales IS 'Vendas realizadas';
COMMENT ON TABLE sale_items IS 'Itens de cada venda';
COMMENT ON TABLE pending_payments IS 'Pagamentos aguardando confirmação (transferência)';
COMMENT ON TABLE cash_sessions IS 'Controle de abertura/fechamento de caixa';
COMMENT ON TABLE audit_logs IS 'Log de auditoria de todas as ações';
COMMENT ON TABLE staff IS 'Usuários do sistema (admin, staff, partners)';
