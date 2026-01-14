# BoxeMaster Pro — Complete Spec v1.7.1

**Status:** Ready for Development
**Escopo:** Academia boutique (até 150 membros ativos)
**Objetivo:** Operação simples, controle financeiro real, sem fricção na recepção

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Princípios de Produto](#2-princípios-de-produto)
3. [Tipos de Usuário](#3-tipos-de-usuário)
4. [Modelo de Acesso](#4-modelo-de-acesso)
5. [Estados do Membro](#5-estados-do-membro)
6. [Modelo de Dados](#6-modelo-de-dados)
7. [Check-in Universal](#7-check-in-universal)
8. [Módulo Financeiro](#8-módulo-financeiro)
9. [Sistema de Pagamentos](#9-sistema-de-pagamentos)
10. [Dashboard de Cobranças](#10-dashboard-de-cobranças)
11. [Notificações Automáticas](#11-notificações-automáticas)
12. [Auditoria](#12-auditoria)
13. [Dashboard do OWNER](#13-dashboard-do-owner)
14. [Sublocação e Parcerias](#14-sublocação-e-parcerias)
15. [Relatórios](#15-relatórios)
16. [Interfaces](#16-interfaces)
17. [Regras de Negócio](#17-regras-de-negócio)
18. [Fora do Escopo](#18-fora-do-escopo)
19. [Stack Técnica](#19-stack-técnica)
20. [Roadmap](#20-roadmap)
21. [Prompt para IA](#21-prompt-para-ia)
22. [Pricing Engine](#22-pricing-engine)

---

## 1. Visão Geral

### 1.1 Problema

Academias de boxe/MMA precisam:
- Saber quem pode entrar agora
- Cobrar corretamente
- Evitar confusão na recepção
- Saber se dá lucro no fim do mês
- Monetizar sublocação de espaço
- Gerenciar professores externos com modelos de fee diferentes
- Controlar ocupação por área (quantos PTs cabem ao mesmo tempo)

Sistemas genéricos são complexos, lentos e pensados para fitness, não combate.

### 1.2 Solução

BoxeMaster Pro é um sistema **access-first** com **controle financeiro real**.

Duas perguntas centrais:

> **"Esta pessoa pode entrar agora?"**
> **"Quanto entrou e saiu hoje?"**

Tudo no sistema existe para responder isso com clareza, em segundos.

---

## 2. Princípios de Produto

### 2.1 Operação
1. Acesso > Aulas
2. Assinatura é o padrão
3. Créditos são exceção
4. **Check-in é universal** — todo mundo que entra passa pelo sistema
5. Sublocação é flat fee ou percentual, nunca por aluno individual
6. **Áreas têm capacidade** — sistema controla quantos PTs por área
7. Recepção resolve tudo em ≤ 3 cliques

### 2.2 Financeiro
8. Toda entrada vira transação
9. Toda saída vira transação
10. Sem categoria → não salva
11. Pagamento e acesso acontecem juntos
12. Caixa fecha todo dia
13. Sistema não faz contabilidade, faz verdade

---

## 3. Tipos de Usuário

### 3.1 Equipe Interna (Staff)

| Tipo | Quem | Permissões | Acesso |
|------|------|------------|--------|
| **OWNER** | Investidor | Visibilidade total, não opera | `/owner/*` |
| **ADMIN** | Sócio operacional | Tudo: config, financeiro, operação | `/admin/*` |
| **STAFF** | Recepção | Check-in, cadastro, receber pagamento | `/staff/*` |

> **ADMIN faz tudo, mas tudo fica registrado na Auditoria. OWNER vê o log completo.**

### 3.2 Usuários Externos

| Tipo | Quem | Permissões | Acesso |
|------|------|------------|--------|
| **Coach** | Coach Externo | Ver/cancelar próprios rentals, ver créditos | `/coach/*` |
| **Membro** | Cliente | Ver QR, treinar | `/m/[qr]` (público) |

> **Coaches têm sistema de autenticação separado** via `external_coaches.user_id`. Não fazem parte da tabela `staff`.

---

## 4. Modelo de Acesso

Todo membro tem apenas **UM acesso ativo por vez**.

### 4.1 Tipos de Acesso

| Tipo | Descrição | Validade |
|------|-----------|----------|
| `SUBSCRIPTION` | Acesso ilimitado | 30/90/180 dias |
| `CREDITS` | 1 check-in = 1 crédito | 90 dias |
| `DAILY_PASS` | Válido no dia da compra | Até 23:59 |

---

## 5. Estados do Membro

| Estado | Descrição | Pode entrar? |
|--------|-----------|--------------|
| `LEAD` | Cadastrado, sem acesso | ❌ |
| `ATIVO` | Acesso válido agora | ✅ |
| `BLOQUEADO` | Acesso expirado/inexistente | ❌ |
| `CANCELADO` | Inativo definitivo | ❌ |

> **Se não está ATIVO → não entra.**

---

## 6. Modelo de Dados

### 6.1 Schema Completo

```sql
-- =============================================
-- MEMBROS E ACESSO
-- =============================================

CREATE TABLE members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                VARCHAR(255) NOT NULL,
    telefone            VARCHAR(20) NOT NULL UNIQUE,
    email               VARCHAR(255) UNIQUE,
    status              VARCHAR(15) NOT NULL DEFAULT 'LEAD'
                        CHECK (status IN ('LEAD', 'ATIVO', 'BLOQUEADO', 'CANCELADO')),
    access_type         VARCHAR(15) CHECK (access_type IN ('SUBSCRIPTION', 'CREDITS', 'DAILY_PASS')),
    access_expires_at   DATE,
    credits_remaining   INTEGER DEFAULT 0,

    -- QR Code (gerado no cadastro, fixo)
    qr_code             VARCHAR(20) UNIQUE NOT NULL, -- ex: "MBR-A1B2C3D4"

    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_telefone ON members(telefone);
CREATE INDEX idx_members_qr ON members(qr_code);

-- =============================================
-- IBANS DOS MEMBROS (PARA PAGAMENTOS)
-- =============================================

CREATE TABLE member_ibans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    iban        VARCHAR(34) NOT NULL,
    label       VARCHAR(50),        -- "Pessoal", "Empresa", "Esposa"
    is_primary  BOOLEAN DEFAULT false,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_member_ibans_member ON member_ibans(member_id);
CREATE INDEX idx_member_ibans_iban ON member_ibans(iban);

-- =============================================
-- PLANOS (TEMPLATES)
-- =============================================

CREATE TABLE plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(100) NOT NULL,
    tipo            VARCHAR(15) NOT NULL CHECK (tipo IN ('SUBSCRIPTION', 'CREDITS', 'DAILY_PASS')),
    preco_cents     INTEGER NOT NULL CHECK (preco_cents > 0),
    duracao_dias    INTEGER, -- só SUBSCRIPTION
    creditos        INTEGER, -- só CREDITS
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- AULAS (OPCIONAL MVP)
-- =============================================

CREATE TABLE classes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(100) NOT NULL,
    modalidade      VARCHAR(50) NOT NULL,
    dia_semana      INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_inicio     TIME NOT NULL,
    duracao_min     INTEGER NOT NULL DEFAULT 60,
    coach_id        UUID,
    capacidade      INTEGER DEFAULT 16, -- soft limit
    ativo           BOOLEAN DEFAULT true
);

-- =============================================
-- ÁREAS (CONTROLE DE CAPACIDADE)
-- =============================================

CREATE TABLE areas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(100) NOT NULL,      -- "Ringue", "Sacos", "Funcional"
    descricao       TEXT,
    capacidade_pts  INTEGER NOT NULL DEFAULT 1, -- quantos PTs simultâneos
    is_exclusive    BOOLEAN DEFAULT false,      -- se true, bloqueia membros quando ocupada
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Seed de áreas padrão
INSERT INTO areas (nome, capacidade_pts, is_exclusive) VALUES
    ('Ringue', 1, false),
    ('Área de Sacos', 3, false),
    ('Funcional', 2, false),
    ('Espaço Completo', 1, true);

-- =============================================
-- COACHES EXTERNOS (PARCEIROS)
-- =============================================

CREATE TABLE external_coaches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(255) NOT NULL,
    telefone        VARCHAR(20),
    email           VARCHAR(255),
    modalidade      VARCHAR(100), -- "Jiu-Jitsu", "Muay Thai", etc

    -- Login independente (autenticação separada de staff)
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE,

    -- Modelo de cobrança
    fee_type        VARCHAR(20) NOT NULL DEFAULT 'FIXED'
                    CHECK (fee_type IN ('FIXED', 'PERCENTAGE')),
    fee_fixed_cents INTEGER,              -- se FIXED: valor em centavos por slot
    fee_percentage  DECIMAL(5,2),         -- se PERCENTAGE: % do plano base
    plan_base_id    UUID REFERENCES plans(id), -- plano de referência para cálculo de %

    -- Créditos de cancelamento
    credits_balance INTEGER DEFAULT 0,    -- quantidade de sessões gratuitas disponíveis

    -- Contrato
    contrato_inicio DATE,
    contrato_fim    DATE,
    ativo           BOOLEAN DEFAULT true,

    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- SUBLOCAÇÃO / RENTALS
-- =============================================

CREATE TABLE rentals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id            UUID NOT NULL REFERENCES external_coaches(id),
    area_id             UUID NOT NULL REFERENCES areas(id),

    -- Agendamento
    data                DATE NOT NULL,
    hora_inicio         TIME NOT NULL,
    hora_fim            TIME NOT NULL,

    -- Recorrência (se faz parte de uma série)
    series_id           UUID,                 -- agrupa rentals da mesma série

    -- Financeiro (calculado no momento da criação)
    fee_type            VARCHAR(20) NOT NULL, -- copiado do coach
    valor_cents         INTEGER NOT NULL,     -- valor calculado

    -- Status
    status              VARCHAR(15) DEFAULT 'SCHEDULED'
                        CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
    pago                BOOLEAN DEFAULT false,
    transaction_id      UUID,

    -- Cancelamento
    cancelled_at        TIMESTAMP,
    cancelled_by        UUID,
    credit_generated    BOOLEAN DEFAULT false, -- se gerou crédito ao cancelar

    -- Métricas (preenchido via check-in de guests)
    guest_count         INTEGER DEFAULT 0,

    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rentals_date ON rentals(data);
CREATE INDEX idx_rentals_coach ON rentals(coach_id);
CREATE INDEX idx_rentals_area ON rentals(area_id);
CREATE INDEX idx_rentals_horario ON rentals(data, hora_inicio, hora_fim);
CREATE INDEX idx_rentals_series ON rentals(series_id);
CREATE INDEX idx_rentals_status ON rentals(status);

-- =============================================
-- GUESTS DO COACH (alunos externos persistentes)
-- =============================================

CREATE TABLE coach_guests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id        UUID NOT NULL REFERENCES external_coaches(id) ON DELETE CASCADE,
    nome            VARCHAR(255) NOT NULL,
    telefone        VARCHAR(20),
    email           VARCHAR(255),
    notas           TEXT,                    -- notas opcionais sobre o guest
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_coach_guests_coach ON coach_guests(coach_id);
CREATE INDEX idx_coach_guests_ativo ON coach_guests(ativo);
CREATE INDEX idx_coach_guests_nome ON coach_guests(nome);

-- =============================================
-- CRÉDITOS DE COACH (CANCELAMENTOS)
-- =============================================

CREATE TABLE coach_credits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id        UUID NOT NULL REFERENCES external_coaches(id),

    -- Valor do crédito
    valor_cents     INTEGER NOT NULL,

    -- Origem
    origin_type     VARCHAR(20) NOT NULL CHECK (origin_type IN ('CANCELLATION', 'ADJUSTMENT')),
    origin_rental_id UUID REFERENCES rentals(id), -- rental que gerou o crédito

    -- Uso
    used            BOOLEAN DEFAULT false,
    used_at         TIMESTAMP,
    used_rental_id  UUID REFERENCES rentals(id), -- rental onde foi usado

    -- Validade
    expires_at      DATE NOT NULL, -- crédito expira em 90 dias

    created_at      TIMESTAMP DEFAULT NOW(),
    created_by      UUID
);

CREATE INDEX idx_coach_credits_coach ON coach_credits(coach_id);
CREATE INDEX idx_coach_credits_available ON coach_credits(coach_id, used, expires_at);

-- =============================================
-- CHECK-INS (UNIVERSAL - IMUTÁVEL)
-- =============================================

CREATE TABLE check_ins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp       TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Tipo de entrada
    type            VARCHAR(10) NOT NULL CHECK (type IN ('MEMBER', 'GUEST')),

    -- Se MEMBER
    member_id       UUID REFERENCES members(id),
    result          VARCHAR(10) CHECK (result IN ('ALLOWED', 'BLOCKED')),
    block_reason    VARCHAR(20) CHECK (block_reason IN ('EXPIRED', 'NO_CREDITS', 'CANCELLED', 'NOT_FOUND', 'EXCLUSIVE_RENTAL')),

    -- Se GUEST (aluno de coach externo)
    rental_id       UUID REFERENCES rentals(id),
    guest_id        UUID REFERENCES coach_guests(id), -- guest persistente (opcional)
    guest_name      VARCHAR(255),                     -- nome avulso (se não usar guest_id)

    created_by      UUID
);

CREATE INDEX idx_checkins_member ON check_ins(member_id);
CREATE INDEX idx_checkins_rental ON check_ins(rental_id);
CREATE INDEX idx_checkins_guest ON check_ins(guest_id);
CREATE INDEX idx_checkins_date ON check_ins(timestamp);
CREATE INDEX idx_checkins_type ON check_ins(type);

-- =============================================
-- FINANCEIRO - CATEGORIAS
-- =============================================

CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    type        VARCHAR(10) NOT NULL CHECK (type IN ('RECEITA', 'DESPESA')),
    is_active   BOOLEAN DEFAULT true
);

-- Seed de categorias
INSERT INTO categories (code, name, type) VALUES
    ('SUBSCRIPTION', 'Mensalidades', 'RECEITA'),
    ('CREDITS', 'Pacotes de Aulas', 'RECEITA'),
    ('DAILY_PASS', 'Diárias', 'RECEITA'),
    ('RENTAL_FIXED', 'Sublocação (Taxa Fixa)', 'RECEITA'),
    ('RENTAL_PERCENTAGE', 'Sublocação (Percentual)', 'RECEITA'),
    ('PRODUTOS', 'Venda de Produtos', 'RECEITA'),
    ('OUTROS_REC', 'Outras Receitas', 'RECEITA'),
    ('FIXO_ALUGUEL', 'Aluguel', 'DESPESA'),
    ('FIXO_UTILIDADES', 'Luz/Água/Gás', 'DESPESA'),
    ('FIXO_INTERNET', 'Internet/Telefone', 'DESPESA'),
    ('VAR_COACHES', 'Coaches Internos', 'DESPESA'),
    ('VAR_LIMPEZA', 'Limpeza', 'DESPESA'),
    ('EQUIPAMENTOS', 'Equipamentos', 'DESPESA'),
    ('MARKETING', 'Marketing', 'DESPESA'),
    ('MANUTENCAO', 'Manutenção', 'DESPESA'),
    ('OUTROS_DESP', 'Outras Despesas', 'DESPESA');

-- =============================================
-- FINANCEIRO - TRANSAÇÕES
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

    -- Referências opcionais
    member_id           UUID REFERENCES members(id),
    reference_type      VARCHAR(20), -- 'PLAN', 'RENTAL', 'PRODUCT'
    reference_id        UUID,

    -- Auditoria
    created_by          UUID NOT NULL,
    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_category ON transactions(category);

-- =============================================
-- PRODUTOS (para venda)
-- =============================================

CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(100) NOT NULL,
    preco_cents     INTEGER NOT NULL CHECK (preco_cents > 0),
    categoria       VARCHAR(30) CHECK (categoria IN ('EQUIPAMENTO', 'VESTUARIO', 'SUPLEMENTO', 'ACESSORIO', 'OUTRO')),
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_ativo ON products(ativo);

-- Exemplos de produtos
INSERT INTO products (nome, preco_cents, categoria) VALUES
('Luvas de Boxe', 4500, 'EQUIPAMENTO'),
('Camiseta BoxeMaster', 2500, 'VESTUARIO'),
('Protetor Bucal', 1500, 'EQUIPAMENTO'),
('Bandagem (par)', 800, 'ACESSORIO'),
('Caneleira', 3500, 'EQUIPAMENTO'),
('Shorts Muay Thai', 3000, 'VESTUARIO');

-- =============================================
-- VENDAS (agrupa itens de uma venda)
-- =============================================

CREATE TABLE sales (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Cliente (opcional)
    member_id       UUID REFERENCES members(id),

    -- Totais
    total_cents     INTEGER NOT NULL CHECK (total_cents > 0),
    payment_method  VARCHAR(20) NOT NULL
                    CHECK (payment_method IN ('DINHEIRO', 'MBWAY', 'CARTAO')),

    -- Referência à transação financeira
    transaction_id  UUID REFERENCES transactions(id),

    -- Auditoria
    created_by      UUID NOT NULL REFERENCES staff(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sales_date ON sales(created_at);
CREATE INDEX idx_sales_member ON sales(member_id);

-- =============================================
-- ITENS DA VENDA
-- =============================================

CREATE TABLE sale_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,

    -- Produto do catálogo OU avulso
    product_id      UUID REFERENCES products(id),  -- NULL se avulso
    descricao       VARCHAR(100) NOT NULL,         -- Nome do produto ou descrição livre

    -- Valores
    quantidade      INTEGER NOT NULL DEFAULT 1,
    preco_unit_cents INTEGER NOT NULL,
    subtotal_cents  INTEGER NOT NULL,

    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- =============================================
-- PAGAMENTOS PENDENTES
-- =============================================

CREATE TABLE pending_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Quem e o quê
    member_id       UUID NOT NULL REFERENCES members(id),
    plan_id         UUID REFERENCES plans(id),
    amount_cents    INTEGER NOT NULL,

    -- Identificação
    reference       VARCHAR(20) UNIQUE NOT NULL, -- "BM-001234" (backup)
    payment_method  VARCHAR(20) NOT NULL
                    CHECK (payment_method IN ('TRANSFERENCIA', 'MBWAY', 'STRIPE')),

    -- Status
    status          VARCHAR(15) DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),

    -- Stripe (se aplicável)
    stripe_session_id   VARCHAR(255),
    stripe_payment_id   VARCHAR(255),

    -- Datas
    created_at      TIMESTAMP DEFAULT NOW(),
    expires_at      TIMESTAMP NOT NULL,
    confirmed_at    TIMESTAMP,
    confirmed_by    UUID REFERENCES staff(id),

    -- Resultado
    transaction_id  UUID REFERENCES transactions(id),

    created_by      UUID REFERENCES staff(id)
);

CREATE INDEX idx_pending_status ON pending_payments(status);
CREATE INDEX idx_pending_reference ON pending_payments(reference);
CREATE INDEX idx_pending_member ON pending_payments(member_id);
CREATE INDEX idx_pending_expires ON pending_payments(expires_at);

-- =============================================
-- AUDITORIA
-- =============================================

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Quem
    user_id         UUID NOT NULL REFERENCES staff(id),
    user_role       VARCHAR(20) NOT NULL,

    -- O quê
    action          VARCHAR(50) NOT NULL,   -- 'MEMBER_CREATE', 'PAYMENT_CONFIRM', etc
    entity_type     VARCHAR(30) NOT NULL,   -- 'member', 'payment', 'rental', etc
    entity_id       UUID,                   -- ID do registro afetado

    -- Detalhes
    description     TEXT NOT NULL,          -- "Confirmou pagamento de João Silva €69"
    old_value       JSONB,                  -- Estado anterior (se edição)
    new_value       JSONB,                  -- Estado novo

    -- Contexto
    ip_address      VARCHAR(45),
    user_agent      TEXT,

    -- Quando
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_logs(created_at);

-- =============================================
-- FINANCEIRO - CAIXA DIÁRIO
-- =============================================

CREATE TABLE cash_sessions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_date            DATE NOT NULL UNIQUE,
    opening_balance_cents   INTEGER NOT NULL DEFAULT 0,
    total_cash_in_cents     INTEGER NOT NULL DEFAULT 0,
    total_cash_out_cents    INTEGER NOT NULL DEFAULT 0,
    expected_closing_cents  INTEGER GENERATED ALWAYS AS (
        opening_balance_cents + total_cash_in_cents - total_cash_out_cents
    ) STORED,
    actual_closing_cents    INTEGER,
    difference_cents        INTEGER,
    status                  VARCHAR(10) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    opened_by               UUID,
    closed_by               UUID,
    opened_at               TIMESTAMP DEFAULT NOW(),
    closed_at               TIMESTAMP
);

-- =============================================
-- STAFF/USERS (apenas equipe interna)
-- =============================================

CREATE TABLE staff (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id), -- link com Supabase Auth
    nome            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'STAFF')),
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Nota: Coaches externos NÃO usam esta tabela.
-- Coaches têm autenticação própria via external_coaches.user_id

CREATE INDEX idx_staff_user ON staff(user_id);
CREATE INDEX idx_staff_role ON staff(role);
```

---

## 7. Check-in Universal

### 7.1 Princípio

> **"Entrou na academia → passou pelo sistema."**

Dois tipos de entrada, mesmo fluxo na recepção.

### 7.2 Tipos de Check-in

| Tipo | Quem | Validação | Consome crédito |
|------|------|-----------|-----------------|
| `MEMBER` | Membro da academia | Status, expiração, créditos, área exclusiva | Sim (se aplicável) |
| `GUEST` | Aluno de coach externo | Rental ativo no horário | Não |

### 7.3 QR Code do Membro

**Geração:**
- Criado automaticamente no cadastro
- Formato: `MBR-XXXXXXXX` (8 caracteres alfanuméricos)
- Fixo, não muda
- Único por membro

**Como o membro acessa:**
- Link no WhatsApp (enviado no cadastro)
- Salvar no Apple Wallet / Google Wallet
- Abrir no navegador: `boxemaster.app/qr/MBR-A1B2C3D4`

**Hardware necessário:**
- Celular ou tablet com câmera (já tem na recepção)
- Zero investimento extra

```javascript
function gerarQRCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1 (evita confusão)
  let code = 'MBR-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
```

### 7.4 Fluxo na Recepção

```
Pessoa chega
    ↓
┌─────────────────────────────────────────────┐
│  "É membro ou veio com professor externo?"  │
└─────────────────────────────────────────────┘
    ↓                           ↓
┌─────────────┐           ┌─────────────────┐
│ SOU MEMBRO  │           │ VIM COM PROF. X │
└──────┬──────┘           └────────┬────────┘
       ↓                           ↓
  Mostra QR no celular       Check-in GUEST
  Recepção escaneia          [Seleciona rental]
  [Câmera do tablet]         [Digita nome]
       ↓                           ↓
  ✅ ou ❌                    ✅ Registrado
```

### 7.5 Check-in MEMBER (Validação)

```
1. QR válido? Membro existe?   → NOT_FOUND
2. Status = ATIVO?             → CANCELLED/BLOQUEADO
3. Acesso válido?              → EXPIRED
4. Se CREDITS: >0?             → NO_CREDITS
5. Área exclusiva bloqueada?   → EXCLUSIVE_RENTAL
         ↓
    ✅ ALLOWED
```

### 7.6 Check-in GUEST (Registro)

```
1. Rental existe para hoje/agora?  → "Nenhum rental ativo"
2. Digita nome do guest
         ↓
    ✅ Registrado
    ↓
Incrementa guest_count no rental
```

### 7.7 Implementação

```javascript
// CHECK-IN MEMBER (via QR)
async function checkInByQR(qrCode, staffId) {
  const member = await db.members.findOne({ where: { qr_code: qrCode } });

  if (!member) {
    return { result: 'BLOCKED', block_reason: 'NOT_FOUND', message: 'QR inválido' };
  }

  return await checkInMember(member.id, staffId);
}

// CHECK-IN MEMBER (validação completa)
async function checkInMember(memberId, staffId) {
  const member = await db.members.findById(memberId);

  if (!member) {
    return await registerCheckIn({ type: 'MEMBER', result: 'BLOCKED', block_reason: 'NOT_FOUND' });
  }

  if (member.status === 'CANCELADO') {
    return await registerCheckIn({ type: 'MEMBER', member_id: member.id, result: 'BLOCKED', block_reason: 'CANCELLED' });
  }

  if (member.status !== 'ATIVO' || member.access_expires_at < TODAY) {
    await db.members.update(member.id, { status: 'BLOQUEADO' });
    return await registerCheckIn({ type: 'MEMBER', member_id: member.id, result: 'BLOCKED', block_reason: 'EXPIRED' });
  }

  if (member.access_type === 'CREDITS' && member.credits_remaining <= 0) {
    return await registerCheckIn({ type: 'MEMBER', member_id: member.id, result: 'BLOCKED', block_reason: 'NO_CREDITS' });
  }

  // Verificar se há rental em área EXCLUSIVE agora
  const exclusiveRental = await db.rentals.findOne({
    where: {
      data: TODAY,
      hora_inicio: { lte: NOW },
      hora_fim: { gte: NOW },
      status: 'SCHEDULED'
    },
    include: {
      area: { where: { is_exclusive: true } },
      coach: true
    }
  });

  if (exclusiveRental) {
    return await registerCheckIn({
      type: 'MEMBER',
      member_id: member.id,
      result: 'BLOCKED',
      block_reason: 'EXCLUSIVE_RENTAL'
    });
  }

  // Sucesso
  return await db.transaction(async (tx) => {
    await tx.check_ins.create({
      type: 'MEMBER',
      member_id: member.id,
      result: 'ALLOWED',
      created_by: staffId
    });

    if (member.access_type === 'CREDITS') {
      await tx.members.decrement(member.id, 'credits_remaining', 1);
    }

    return { result: 'ALLOWED', member };
  });
}

// CHECK-IN GUEST
async function checkInGuest(rentalId, guestName, staffId) {
  const rental = await db.rentals.findById(rentalId, {
    include: { coach: true, area: true }
  });

  if (!rental || rental.data !== TODAY) {
    throw new Error('Rental não encontrado ou não é hoje');
  }

  const now = getCurrentTime();
  if (now < rental.hora_inicio || now > rental.hora_fim) {
    throw new Error('Fora do horário do rental');
  }

  return await db.transaction(async (tx) => {
    await tx.check_ins.create({
      type: 'GUEST',
      rental_id: rentalId,
      guest_name: guestName,
      created_by: staffId
    });
    await tx.rentals.increment(rentalId, 'guest_count', 1);

    return { result: 'REGISTERED', guest_name: guestName, rental };
  });
}
```

---

## 8. Módulo Financeiro

### 8.1 Conceito

O sistema controla **fluxo de caixa**, não balanço contábil.

> Cada movimento = uma transação simples, categorizada e auditável.

### 8.2 Tipos de Transação

| Tipo | Descrição |
|------|-----------|
| `RECEITA` | Dinheiro entrando |
| `DESPESA` | Dinheiro saindo |

### 8.3 Métodos de Pagamento

```
DINHEIRO | MBWAY | TRANSFERENCIA | CARTAO
```

### 8.4 Pagamento de Plano (RECEITA + Ativação)

```javascript
async function processarPagamento(memberId, planId, paymentMethod, staffId) {
  return await db.transaction(async (tx) => {
    const plan = await tx.plans.findById(planId);

    // 1. Criar transação financeira
    const transaction = await tx.transactions.create({
      type: 'RECEITA',
      amount_cents: plan.preco_cents,
      payment_method: paymentMethod,
      category: plan.tipo,
      description: `Plano: ${plan.nome}`,
      member_id: memberId,
      reference_type: 'PLAN',
      reference_id: planId,
      created_by: staffId
    });

    // 2. Atualizar caixa (se dinheiro)
    if (paymentMethod === 'DINHEIRO') {
      await tx.cash_sessions.increment(
        { session_date: TODAY },
        { total_cash_in_cents: plan.preco_cents }
      );
    }

    // 3. Ativar acesso
    const updateData = {
      status: 'ATIVO',
      access_type: plan.tipo,
      updated_at: NOW()
    };

    if (plan.tipo === 'SUBSCRIPTION') {
      updateData.access_expires_at = addDays(TODAY, plan.duracao_dias);
    } else if (plan.tipo === 'CREDITS') {
      updateData.credits_remaining = db.raw('credits_remaining + ?', [plan.creditos]);
      updateData.access_expires_at = addDays(TODAY, 90);
    } else if (plan.tipo === 'DAILY_PASS') {
      updateData.access_expires_at = TODAY;
    }

    await tx.members.update(memberId, updateData);

    return transaction;
  });
}
```

### 8.4.1 Taxa de Matrícula (Enrollment Fee)

#### Visão Geral

A **taxa de matrícula** é um pagamento único cobrado quando um novo membro (status LEAD) ativa seu primeiro plano no ginásio. Esta taxa cobre custos administrativos de cadastro, emissão de QR code, configuração de acesso, e onboarding inicial do membro.

**Princípio Fundamental:** A taxa de matrícula é cobrada **uma única vez na vida do membro**, apenas na transição de LEAD para ATIVO. Renovações, reativações e mudanças de plano **NÃO** cobram nova taxa de matrícula.

---

#### Regras de Negócio

##### RN-01: Cobrança Única
- Taxa cobrada **apenas** quando `member.status === 'LEAD'` (nunca foi ativo antes)
- Membro que já foi ATIVO (mesmo que hoje esteja BLOQUEADO ou CANCELADO) **NÃO** paga nova taxa
- Histórico: Sistema não permite re-cobrança mesmo se membro ficar anos inativo

##### RN-02: Configuração por Plano
- Cada plano possui sua própria taxa de matrícula configurável
- Admin define taxa ao criar/editar plano na tela de administração
- Valor mínimo: €0,00 (isenção permitida)
- Valor máximo: Sem limite (planos premium podem ter taxas maiores)
- Exemplos típicos:
  - Plano Mensal Básico: €25,00
  - Plano Trimestral: €20,00 (desconto por compromisso maior)
  - Plano Anual: €15,00 (maior desconto)
  - Plano Créditos Avulsos: €30,00 (maior taxa para menor compromisso)

##### RN-03: Override pelo Staff
- No momento da matrícula, staff pode **ajustar manualmente** a taxa
- Casos de uso para override:
  - **Desconto promocional**: "Matrícula grátis no mês de Janeiro" → ajustar para €0
  - **Negociação especial**: Cliente traz amigo → reduzir taxa de €25 para €15
  - **Correção de erro**: Plano configurado com taxa errada → ajustar no momento
  - **Isenção social**: Atleta de baixa renda → zerar taxa
- Override pode aumentar ou diminuir o valor, incluindo zerar completamente
- Sistema **registra** o valor final cobrado, não o valor padrão do plano

##### RN-04: Separação de Transações Financeiras
- Sistema cria **duas transações separadas** no banco de dados:
  1. **Transação do Plano**: Categoria = tipo do plano (SUBSCRIPTION, CREDITS, DAILY_PASS)
  2. **Transação da Taxa**: Categoria = TAXA_MATRICULA
- **Justificativa**: Permite contabilidade separada e relatórios precisos
  - Admin pode ver: "Quanto faturamos em matrículas este mês?"
  - Admin pode ver: "Quanto faturamos em mensalidades este mês?"
  - Relatórios fiscais exigem separação de receitas por tipo

##### RN-05: Jornada Separada (Matrícula vs Renovação)
- Sistema possui **duas páginas distintas**:
  - **Matrícula (`/staff/enrollment`)**: Para membros LEAD (primeira vez)
  - **Pagamento (`/staff/payment`)**: Para membros ATIVO/BLOQUEADO (renovação)
- **Justificativa**: Evitar cobrança acidental de taxa em renovações
- Se staff tentar processar membro LEAD na página de Pagamento, sistema mostra alerta amarelo:
  - "Este membro nunca foi ativado. Deseja matriculá-lo?"
  - Botão: "Ir para Matrícula →"

---

#### Fluxos de Uso

##### Fluxo 1: Matrícula com Pagamento Instantâneo (Dinheiro/Cartão/MBWay)

**Ator:** Staff de recepção
**Pré-condição:** Membro já cadastrado com status LEAD
**Trigger:** Novo membro chega ao ginásio para pagar e começar a treinar

**Passos:**

1. **Staff acessa página de Matrícula**
   - Menu: "Matrícula" no dashboard staff
   - URL: `/staff/enrollment`

2. **Staff busca o membro**
   - Sistema mostra **apenas** membros com status LEAD
   - Staff digita nome ou telefone
   - Sistema filtra e exibe resultados
   - Staff seleciona membro da lista

3. **Staff seleciona plano**
   - Sistema exibe planos disponíveis
   - Staff escolhe plano (ex: "Mensal €69")
   - Sistema auto-popula taxa de matrícula do plano (ex: €25)

4. **Staff ajusta taxa (se necessário)**
   - Campo "Taxa de Matrícula" mostra valor padrão (€25)
   - Staff pode editar:
     - Promoção: Alterar para €0
     - Desconto: Alterar para €15
     - Mantém: Deixar €25
   - Sistema recalcula total automaticamente

5. **Sistema mostra resumo**
   - Plano: Mensal €69,00
   - Taxa de Matrícula: €25,00
   - **Total a Pagar: €94,00**

6. **Staff seleciona método de pagamento**
   - Opções: DINHEIRO | CARTÃO | MBWAY
   - Staff escolhe (ex: DINHEIRO)

7. **Staff confirma pagamento**
   - Botão: "Confirmar Matrícula"
   - Sistema processa:
     - ✅ Atualiza membro para status ATIVO
     - ✅ Define acesso (tipo SUBSCRIPTION, validade 30 dias)
     - ✅ Cria transação #1: Plano (€69, categoria SUBSCRIPTION)
     - ✅ Cria transação #2: Taxa (€25, categoria TAXA_MATRICULA)
     - ✅ Se DINHEIRO: Atualiza caixa do dia (+€94)

8. **Sistema exibe confirmação**
   - Tela de sucesso com QR code do membro
   - Mensagem: "Matrícula concluída! [Nome] está ativo até [data]"
   - Opção: Imprimir recibo

**Pós-condição:** Membro pode fazer check-in imediatamente

---

##### Fluxo 2: Matrícula com Transferência Bancária (Pagamento Pendente)

**Ator:** Staff de recepção
**Pré-condição:** Membro já cadastrado com status LEAD
**Trigger:** Novo membro quer pagar via transferência bancária

**Passos:**

1-4. **Igual ao Fluxo 1** (até seleção de plano e ajuste de taxa)

5. **Sistema mostra resumo**
   - Plano: Mensal €69,00
   - Taxa de Matrícula: €25,00
   - **Total a Pagar: €94,00**

6. **Staff seleciona TRANSFERENCIA**
   - Sistema mostra IBAN do ginásio
   - Sistema gera referência única: `ENR-1673451234567`
   - Prefixo "ENR" identifica matrícula (vs "PAY" para renovações)

7. **Staff confirma criação de pagamento pendente**
   - Botão: "Registrar Pagamento Pendente"
   - Sistema processa:
     - ✅ Cria registro em `pending_payments`
     - ✅ Valor total: €94,00
     - ✅ Referência: ENR-1673451234567
     - ✅ Validade: 7 dias
     - ❌ **NÃO** ativa membro ainda (aguarda confirmação)

8. **Sistema exibe instruções**
   - Tela com:
     - IBAN: PT50 0123 4567 8901 2345 6789
     - Referência: ENR-1673451234567
     - Valor: €94,00
     - Validade: 18/01/2026
   - Opção: Enviar por WhatsApp (futuro)
   - Opção: Imprimir instruções

**Pós-condição:** Membro permanece LEAD até admin confirmar pagamento

---

##### Fluxo 3: Confirmação de Transferência pelo Admin

**Ator:** Admin/Owner
**Pré-condição:** Pagamento pendente criado no Fluxo 2
**Trigger:** Admin verifica extrato bancário e vê transferência de €94

**Passos:**

1. **Admin acessa página de Pagamentos Pendentes**
   - Menu: "Finanças > Verificar Pagamentos"
   - URL: `/admin/finances/verify`

2. **Admin localiza pagamento**
   - Lista mostra: "João Silva - ENR-1673451234567 - €94,00 - Expira em 5 dias"
   - Admin confirma valor no extrato bancário

3. **Admin confirma pagamento**
   - Botão: "Confirmar Recebimento"
   - Sistema detecta prefixo "ENR-" (é matrícula, não renovação)

4. **Sistema processa confirmação**
   - ✅ Atualiza membro para status ATIVO
   - ✅ Define acesso (tipo SUBSCRIPTION, validade 30 dias)
   - ✅ Cria transação #1: Plano (€69, categoria SUBSCRIPTION)
   - ✅ Cria transação #2: Taxa (€25, categoria TAXA_MATRICULA)
   - ✅ Marca pending_payment como confirmado
   - ✅ Registra data/hora de confirmação
   - ✅ Registra ID do admin confirmador

5. **Sistema exibe confirmação**
   - Toast: "Matrícula de João Silva confirmada!"
   - Pagamento sai da lista de pendentes

**Pós-condição:** Membro pode fazer check-in imediatamente

---

#### Edge Cases e Tratamentos

##### EC-01: Taxa Zerada
**Cenário:** Staff zera completamente a taxa de matrícula (€0,00)
**Comportamento:**
- Sistema permite (isenção é válida)
- Cria **apenas 1 transação** (do plano)
- **Não cria** transação de taxa zero (evita poluição do banco)
- Total a pagar = valor do plano apenas

##### EC-02: Plano sem Taxa Configurada
**Cenário:** Admin cria plano mas não define taxa (campo vazio ou NULL)
**Comportamento:**
- Sistema assume taxa = €0,00
- Fluxo continua normalmente como EC-01

##### EC-03: Override para Valor Maior
**Cenário:** Plano tem taxa €25, mas staff aumenta para €50
**Comportamento:**
- Sistema permite (sem validação de máximo)
- **Justificativa**: Casos especiais (ex: renovação de cadastro perdido, segunda via de carteirinha)
- Total reflete novo valor
- Transação registra €50, não €25

##### EC-04: Membro LEAD na Página Errada
**Cenário:** Staff tenta renovar membro LEAD na página `/staff/payment`
**Comportamento:**
- Sistema detecta status LEAD
- Exibe alerta amarelo:
  - Ícone: ⚠️
  - Título: "Novo Membro"
  - Descrição: "Este membro nunca foi ativado. Deseja matriculá-lo?"
  - Ação: Botão "Ir para Matrícula →" redireciona para `/staff/enrollment`
- **NÃO permite** continuar fluxo de renovação
- Previne cobrança incorreta (sem taxa de matrícula)

##### EC-05: Membro ATIVO na Página de Matrícula
**Cenário:** Staff tenta matricular membro que já está ativo
**Comportamento:**
- Busca na página `/staff/enrollment` **não retorna** o membro
- Filtro: `status IN ('LEAD', 'CANCELADO')` exclui membros ATIVO/BLOQUEADO
- Staff vê mensagem: "Nenhum membro encontrado"
- **Justificativa**: Membros ATIVO já têm plano ativo, devem usar renovação; CANCELADO pode ser reativado com ou sem taxa

##### EC-06: Renovação de Membro Bloqueado
**Cenário:** Membro foi ATIVO, expirou (BLOQUEADO), agora quer renovar
**Comportamento:**
- Staff usa página `/staff/payment` (renovação)
- Sistema **NÃO** cobra taxa de matrícula
- Cria **apenas** transação do plano
- Membro volta para ATIVO sem custos extras

##### EC-07: Transferência Expirada sem Confirmação
**Cenário:** Pagamento pendente criado há 8 dias (prazo: 7 dias)
**Comportamento:**
- Sistema marca pagamento como "EXPIRADO"
- Admin vê na lista com cor diferente (cinza)
- Admin **pode** confirmar mesmo após expiração (cliente pagou atrasado)
- Se confirmado: Fluxo normal (Fluxo 3)
- Se não confirmado: Staff pode criar novo pagamento pendente

##### EC-08: Cancelamento de Pagamento Pendente
**Cenário:** Membro desiste antes de pagar transferência
**Comportamento:**
- Staff ou Admin pode cancelar pending_payment
- Botão: "Cancelar Pagamento"
- Sistema marca como "CANCELADO"
- Membro permanece LEAD
- Staff pode criar nova matrícula posteriormente

##### EC-09: Taxa Negativa
**Cenário:** Staff tenta inserir taxa negativa (ex: -€10)
**Comportamento:**
- Sistema **bloqueia** no frontend (input type="number" min="0")
- Se bypass tentado: Backend rejeita com erro
- Mensagem: "Taxa não pode ser negativa"

##### EC-10: Plano Alterado Após Pagamento Pendente
**Cenário:** Staff cria pending_payment com Plano A (€69), admin altera preço do Plano A para €79
**Comportamento:**
- Pending_payment mantém valor original (€69 + taxa)
- **Justificativa**: Contrato firmado no momento da criação
- Se admin confirmar: Usa valores originais do pending_payment

##### EC-11: Membro CANCELADO Retornando
**Cenário:** Membro teve plano cancelado e retorna após meses

**Comportamento:**
- Staff pode escolher cobrar ou não cobrar taxa de matrícula
- Decisão manual caso a caso (não automática)

**Fluxo:**
1. **Se staff quer cobrar taxa**: Usar `/staff/enrollment` (redirecionar via banner azul)
   - Banner aparece em `/staff/payment` quando selecionar membro CANCELADO
   - Texto: "Este membro já teve acesso cancelado. Deseja cobrar taxa de matrícula novamente?"
   - Botão: "Sim - Com Taxa de Matrícula" → Redireciona para enrollment
   - Membro aparece na busca de enrollment com badge "Retornando" (azul)
   - Cria 2 transações (plano + taxa)
   - Referência TRANSFERENCIA: `REA-{timestamp}` (prefixo REA = Reativação)

2. **Se staff NÃO quer cobrar**: Usar `/staff/payment` normalmente
   - Banner aparece mas staff ignora ou clica "Não - Apenas Plano"
   - Continua fluxo normal de renovação
   - Cria 1 transação (apenas plano)
   - Referência TRANSFERENCIA: `PAY-{timestamp}` (prefixo PAY = Payment)

**Implementação:**
- Payment.tsx mostra banner de decisão para membros CANCELADO
- Enrollment.tsx aceita membros CANCELADO na busca (filtro: `status IN ('LEAD', 'CANCELADO')`)
- Prefixo de referência distingue: ENR- (LEAD), REA- (CANCELADO), PAY- (renovação normal)
- Admin em PendingPayments.tsx detecta ambos prefixos ENR- e REA- para split de transações

---

#### Diagrama de Fluxo de Estados

```
┌─────────────────────────────────────────────────────────────┐
│                    CICLO DE VIDA DO MEMBRO                  │
└─────────────────────────────────────────────────────────────┘

    [NOVO CADASTRO]
          │
          ▼
    ┌──────────┐
    │   LEAD   │ ◄─── Status inicial (sem acesso)
    └──────────┘
          │
          │ PRIMEIRA MATRÍCULA
          │ (cobra taxa + plano)
          │
          ▼
    ┌──────────┐
    │  ATIVO   │ ◄─── Acesso liberado
    └──────────┘
          │
          │ Plano expira
          │
          ▼
    ┌──────────┐
    │BLOQUEADO │ ◄─── Sem acesso
    └──────────┘
          │
          │ RENOVAÇÃO
          │ (cobra APENAS plano, SEM taxa)
          │
          ▼
    ┌──────────┐
    │  ATIVO   │ ◄─── Volta a ter acesso
    └──────────┘

Nota: Transição LEAD → ATIVO é a ÚNICA que cobra taxa de matrícula
```

---

#### Diagrama de Decisão: Cobrar ou Não Taxa?

```
┌─────────────────────────────────────────────────────────┐
│         Membro quer ativar/renovar plano                │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
          ┌─────────────────────────┐
          │ Status atual = LEAD?    │
          └─────────────────────────┘
                │              │
            SIM │              │ NÃO
                │              │
                ▼              ▼
    ┌──────────────────┐  ┌────────────────────┐
    │ Usar MATRÍCULA   │  │ Usar RENOVAÇÃO     │
    │ /staff/enrollment│  │ /staff/payment     │
    └──────────────────┘  └────────────────────┘
                │              │
                ▼              ▼
    ┌──────────────────┐  ┌────────────────────┐
    │ Cobrar:          │  │ Cobrar:            │
    │ • Plano          │  │ • APENAS Plano     │
    │ • Taxa Matrícula │  │                    │
    └──────────────────┘  └────────────────────┘
                │              │
                ▼              ▼
    ┌──────────────────┐  ┌────────────────────┐
    │ 2 Transações     │  │ 1 Transação        │
    └──────────────────┘  └────────────────────┘
```

---

#### Cenários de Teste para QA

##### Teste 1: Matrícula Padrão
- Criar membro LEAD
- Acessar `/staff/enrollment`
- Selecionar plano "Mensal €69" (taxa padrão €25)
- **Não** alterar taxa
- Pagar com DINHEIRO
- **Esperado:**
  - Total = €94
  - 2 transações criadas
  - Membro status = ATIVO
  - Caixa incrementado em €94

##### Teste 2: Isenção de Taxa
- Criar membro LEAD
- Acessar `/staff/enrollment`
- Selecionar plano "Mensal €69" (taxa padrão €25)
- **Zerar** taxa para €0
- Pagar com CARTÃO
- **Esperado:**
  - Total = €69
  - 1 transação criada (apenas plano)
  - Membro status = ATIVO

##### Teste 3: Desconto na Taxa
- Criar membro LEAD
- Acessar `/staff/enrollment`
- Selecionar plano "Mensal €69" (taxa padrão €25)
- **Reduzir** taxa para €10
- Pagar com MBWAY
- **Esperado:**
  - Total = €79
  - 2 transações criadas (€69 + €10)
  - Transação taxa = €10 (não €25)

##### Teste 4: Prevenir Matrícula Duplicada
- Criar membro ATIVO
- Acessar `/staff/enrollment`
- Buscar membro por nome
- **Esperado:**
  - Membro **não** aparece nos resultados
  - Apenas membros LEAD são listados

##### Teste 5: Alerta em Página Errada
- Criar membro LEAD
- Acessar `/staff/payment` (renovação)
- Buscar e selecionar membro LEAD
- **Esperado:**
  - Banner amarelo aparece
  - Texto: "Este membro nunca foi ativado"
  - Botão redireciona para `/staff/enrollment`

##### Teste 6: Transferência Pendente
- Criar membro LEAD
- Acessar `/staff/enrollment`
- Selecionar plano "Mensal €69" (taxa €25)
- Pagar com TRANSFERENCIA
- **Esperado:**
  - Pending payment criado (€94, ref ENR-XXXXX)
  - Membro permanece LEAD
  - Instruções exibidas com IBAN

##### Teste 7: Confirmação de Transferência
- Executar Teste 6
- Admin acessa `/admin/finances/verify`
- Confirma pagamento pendente
- **Esperado:**
  - 2 transações criadas (€69 + €25)
  - Membro status = ATIVO
  - Pending payment marcado confirmado

##### Teste 8: Renovação sem Taxa
- Criar membro ATIVO, deixar expirar (BLOQUEADO)
- Acessar `/staff/payment`
- Selecionar plano "Mensal €69"
- Pagar com DINHEIRO
- **Esperado:**
  - Total = €69 (sem taxa)
  - 1 transação criada
  - Membro volta para ATIVO

---

#### Impactos em Relatórios

##### Relatório Financeiro por Categoria
- Nova categoria aparece: "TAXA_MATRICULA"
- Admin pode filtrar:
  - "Mostrar apenas matrículas" → categoria = TAXA_MATRICULA
  - "Mostrar apenas mensalidades" → categoria = SUBSCRIPTION
- Total mensal separado:
  - Receita Matrículas: €250,00 (10 matrículas × €25)
  - Receita Mensalidades: €3.450,00 (50 membros × €69)

##### Dashboard Owner
- Card: "Receita de Matrículas (Mês Atual)"
- Gráfico: Tendência de novas matrículas vs renovações
- Métrica: Taxa média de matrícula cobrada (pode variar por overrides)

---

#### Considerações de UX

##### Nomenclatura Consistente
- **Matrícula**: Sempre para primeira vez (LEAD → ATIVO)
- **Renovação/Pagamento**: Sempre para reativação (BLOQUEADO → ATIVO)
- **Taxa de Matrícula**: Nunca "taxa de inscrição" ou "taxa de cadastro"

##### Feedback Visual
- Badge LEAD: Cor amarela (neutro, aguardando ação)
- Tela de matrícula: Destaque para total (plano + taxa)
- Confirmação: Mostrar QR code imediatamente após matrícula

##### Prevenção de Erros
- Busca filtrada por status (evita seleção errada)
- Alertas quando membro está em página errada
- Confirmação antes de processar valores altos (>€200)

---

### 8.5 Registro de Despesa

```javascript
async function registrarDespesa(data, adminId) {
  const category = await db.categories.findByCode(data.category);
  if (!category || category.type !== 'DESPESA') {
    throw new Error('Categoria inválida');
  }

  return await db.transaction(async (tx) => {
    const transaction = await tx.transactions.create({
      type: 'DESPESA',
      amount_cents: data.amount_cents,
      payment_method: data.payment_method,
      category: data.category,
      description: data.description,
      created_by: adminId
    });

    if (data.payment_method === 'DINHEIRO') {
      await tx.cash_sessions.increment(
        { session_date: TODAY },
        { total_cash_out_cents: data.amount_cents }
      );
    }

    return transaction;
  });
}
```

### 8.6 Controle de Caixa

```javascript
// Abertura
async function abrirCaixa(openingBalance, staffId) {
  return await db.cash_sessions.create({
    session_date: TODAY,
    opening_balance_cents: openingBalance,
    opened_by: staffId
  });
}

// Fechamento
async function fecharCaixa(actualClosing, staffId) {
  const session = await db.cash_sessions.findByDate(TODAY);
  const difference = actualClosing - session.expected_closing_cents;

  await db.cash_sessions.update(TODAY, {
    actual_closing_cents: actualClosing,
    difference_cents: difference,
    status: 'CLOSED',
    closed_by: staffId,
    closed_at: NOW()
  });

  if (Math.abs(difference) > 500) {
    await notifyAdmin(`Diferença de caixa: €${(difference/100).toFixed(2)}`);
  }

  return { expected: session.expected_closing_cents, actual: actualClosing, difference };
}
```

### 8.7 Vendas (Produtos)

#### 8.7.1 Conceito

Venda de produtos da academia: equipamentos, vestuário, acessórios, etc.

> **Catálogo simples + opção de venda avulsa. Sem controle de estoque no MVP.**

#### 8.7.2 Implementação

```javascript
// Criar venda
async function criarVenda(items, paymentMethod, memberId, staffId) {
  return await db.transaction(async (tx) => {
    // Calcular total
    const totalCents = items.reduce((sum, item) => sum + item.subtotal_cents, 0);

    // 1. Criar transação financeira
    const transaction = await tx.transactions.create({
      type: 'RECEITA',
      amount_cents: totalCents,
      payment_method: paymentMethod,
      category: 'PRODUTOS',
      description: `Venda: ${items.length} item(s)`,
      member_id: memberId,
      reference_type: 'SALE',
      created_by: staffId
    });

    // 2. Criar venda
    const sale = await tx.sales.create({
      member_id: memberId,
      total_cents: totalCents,
      payment_method: paymentMethod,
      transaction_id: transaction.id,
      created_by: staffId
    });

    // 3. Criar itens da venda
    for (const item of items) {
      await tx.sale_items.create({
        sale_id: sale.id,
        product_id: item.product_id || null,
        descricao: item.descricao,
        quantidade: item.quantidade,
        preco_unit_cents: item.preco_unit_cents,
        subtotal_cents: item.subtotal_cents
      });
    }

    return { sale, transaction };
  });
}
```

---

## 9. Sistema de Pagamentos

### 9.1 Métodos Suportados

| Método | Confirmação | Fase |
|--------|-------------|------|
| Dinheiro | Imediata (Staff vê) | MVP |
| Cartão (TPA) | Imediata (Staff vê) | MVP |
| MBway | Manual (Staff vê no app do banco) | MVP |
| Transferência | Manual (Admin verifica extrato) | MVP |
| Stripe | Automática (webhook) | Fase 2 |

### 9.2 IBAN do Membro

Cada membro pode ter múltiplos IBANs cadastrados para identificação automática de pagamentos.

### 9.3 Implementação

```javascript
// Match de pagamento por IBAN
async function matchPagamentoByIBAN(iban, valorCents) {
  const memberIban = await db.member_ibans.findOne({
    where: { iban: normalizeIBAN(iban) },
    include: { member: true }
  });

  if (!memberIban) {
    return { matched: false, iban, valor_cents: valorCents };
  }

  const pending = await db.pending_payments.findOne({
    where: {
      member_id: memberIban.member_id,
      amount_cents: valorCents,
      status: 'PENDING'
    }
  });

  return {
    matched: true,
    member: memberIban.member,
    pending_payment: pending,
    iban_label: memberIban.label
  };
}

// Confirmar pagamento
async function confirmarPagamento(pendingId, staffId) {
  return await db.transaction(async (tx) => {
    const pending = await tx.pending_payments.findById(pendingId, {
      include: { member: true, plan: true }
    });

    // 1. Criar transação financeira
    const transaction = await tx.transactions.create({
      type: 'RECEITA',
      amount_cents: pending.amount_cents,
      payment_method: pending.payment_method,
      category: pending.plan.tipo,
      description: `Plano: ${pending.plan.nome}`,
      member_id: pending.member_id,
      reference_type: 'PLAN',
      reference_id: pending.plan_id,
      created_by: staffId
    });

    // 2. Atualizar pagamento pendente
    await tx.pending_payments.update(pendingId, {
      status: 'CONFIRMED',
      confirmed_at: NOW(),
      confirmed_by: staffId,
      transaction_id: transaction.id
    });

    // 3. Ativar membro
    await tx.members.update(pending.member_id, {
      status: 'ATIVO',
      access_type: pending.plan.tipo,
      access_expires_at: addDays(TODAY, pending.plan.duracao_dias)
    });

    // 4. Enviar QR por WhatsApp
    await sendWhatsApp(pending.member.telefone, 'payment_confirmed', {
      nome: pending.member.nome,
      plano: pending.plan.nome,
      qr_url: `${BASE_URL}/m/${pending.member.qr_code}`
    });

    return { transaction, member: pending.member };
  });
}
```

---

## 10. Dashboard de Cobranças

### 10.1 Queries

```sql
-- Atrasados
SELECT m.*,
       CURRENT_DATE - m.access_expires_at as dias_atraso,
       p.preco_cents
FROM members m
JOIN plans p ON p.tipo = m.access_type
WHERE m.access_expires_at < CURRENT_DATE
  AND m.status IN ('BLOQUEADO', 'ATIVO')
ORDER BY m.access_expires_at ASC;

-- Vencem hoje
SELECT m.*, p.preco_cents
FROM members m
JOIN plans p ON p.tipo = m.access_type
WHERE m.access_expires_at = CURRENT_DATE
  AND m.status = 'ATIVO';

-- Próximos 7 dias
SELECT m.*, p.preco_cents,
       m.access_expires_at - CURRENT_DATE as dias_restantes
FROM members m
JOIN plans p ON p.tipo = m.access_type
WHERE m.access_expires_at BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7
  AND m.status = 'ATIVO'
ORDER BY m.access_expires_at ASC;
```

---

## 11. Notificações Automáticas

### 11.1 WhatsApp Templates

| Quando | Template | Mensagem |
|--------|----------|----------|
| 3 dias antes | `payment_reminder_3d` | "Olá {nome}! Teu plano vence dia {data}." |
| No dia | `payment_reminder_today` | "{nome}, teu plano vence HOJE." |
| 1 dia depois | `payment_overdue_1d` | "{nome}, teu plano expirou ontem." |
| 3 dias depois | `payment_overdue_3d` | "{nome}, estamos com saudades!" |
| Confirmado | `payment_confirmed` | "Pagamento confirmado! Acesso ativo até {data}." |
| Bem-vindo | `welcome` | "Bem-vindo ao BoxeMaster! Teu QR: {qr_url}" |

---

## 12. Auditoria

Todos os logs ficam na tabela `audit_logs` com:
- Quem fez (user_id, role)
- O que fez (action, entity_type)
- Quando (timestamp)
- Detalhes (description, old_value, new_value)

---

## 13. Dashboard do OWNER

Visão read-only com:
- Métricas financeiras
- Ocupação
- Log de auditoria completo
- Relatórios

---

## 14. Sublocação e Parcerias

### 14.1 Modelos de Fee

| Tipo | Como funciona |
|------|---------------|
| `FIXED` | Valor fixo por slot (ex: €30/hora) |
| `PERCENTAGE` | % do plano base (ex: 40% de €69) |

### 14.2 Cancelamento com Crédito

Coach cancela com >48h: gera crédito válido por 90 dias.

### 14.3 Portal do Coach

Coaches externos têm acesso ao sistema através de um portal separado.

**Rota:** `/coach/login`

**Fluxo de Criação de Login:**
1. Admin cria coach em `/admin/coaches`
2. Admin clica "Criar Login" → sistema gera credenciais temporárias
3. Coach recebe senha temporária
4. Coach acessa `/coach/login` e altera senha

**Funcionalidades do Portal:**
- Ver próprios rentals (passados e futuros)
- Cancelar rentals (gera crédito se >48h antes)
- Ver saldo de créditos
- Criar novos rentals (quando implementado)

**Autenticação:**
- Sistema separado da equipe (`staff`)
- Usa `external_coaches.user_id` para vincular ao Supabase Auth
- Context provider próprio: `useCoachAuth`
- Route guard próprio: `ProtectedCoachRoute`

---

## 15. Relatórios

- Receitas vs Despesas
- Ocupação por área
- Performance de coaches
- Taxa de renovação

---

## 16. Interfaces

Principais telas:
- `/staff/checkin` - Check-in universal
- `/staff/payment` - Pagamentos e cobranças
- `/staff/enrollment` - Matrícula de novos membros
- `/admin/dashboard` - Dashboard administrativo
- `/admin/finances` - Financeiro completo
- `/owner/dashboard` - Visão executiva

**Portal do Coach (autenticação separada):**
- `/coach/login` - Login do coach externo
- `/coach/dashboard` - Portal do coach (rentals e créditos)

---

## 17. Regras de Negócio

1. Um membro = um acesso por vez
2. Check-in consome crédito imediatamente
3. Pagamento ativa acesso instantaneamente
4. Caixa fecha todo dia
5. Área exclusiva bloqueia membros durante rental

---

## 18. Fora do Escopo

MVP não inclui:
- App mobile nativo
- Integração com portaria automática
- Nutrição/treinos personalizados
- Rede social interna
- Gamificação

---

## 19. Stack Técnica

- **Frontend:** Next.js 14 + TypeScript + Tailwind
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Pagamentos:** Stripe (Fase 2)
- **WhatsApp:** API oficial
- **Deploy:** Vercel

---

## 20. Roadmap

### MVP (v1.0)
- Check-in universal
- Gestão de membros
- Financeiro básico
- Sublocação

### v1.1
- Stripe
- Relatórios avançados

### v2.0
- App mobile
- Integração portaria

---

## 21. Prompt para IA

Use este documento como contexto completo para implementar o BoxeMaster Pro.

Prioridades:
1. Check-in funcional
2. Controle financeiro preciso
3. UX simples para staff
4. Auditoria completa

**Mantra:** "Se não registra transação, não aconteceu."

---

## 22. Pricing Engine

### 22.1 Visão Geral

Sistema de precificação dinâmica baseado em modalidades, com descontos automáticos por compromisso e códigos promocionais.

> **Princípio:** O preço final é calculado por uma fórmula clara, não valores fixos por plano.

### 22.2 Fórmula de Preço

```
P = (B + (M-1) × E) × (1 - Dp) × (1 - Dpromo)
```

| Variável | Descrição | Fonte |
|----------|-----------|-------|
| `P` | Preço final mensal | output |
| `B` | Preço base (1ª modalidade) | PricingConfig ou Plan.pricing_override |
| `E` | Preço modalidade extra | PricingConfig ou Plan.pricing_override |
| `M` | Quantidade de modalidades | input do checkout |
| `Dp` | Desconto commitment (%) | calculado por meses de compromisso |
| `Dpromo` | Desconto promocional (%) | código inserido pelo cliente |

### 22.3 Novas Tabelas

#### modalities
Modalidades de treino disponíveis na academia.

```sql
CREATE TABLE modalities (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,  -- 'boxe', 'muay_thai', etc.
    nome VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true
);
```

**Modalidades padrão:** boxe, muay_thai, jiu_jitsu, mma, kickboxing, wrestling, funcional

#### pricing_config
Configuração global de preços (singleton - apenas 1 registro).

```sql
CREATE TABLE pricing_config (
    id UUID PRIMARY KEY,
    base_price_cents INTEGER DEFAULT 6000,           -- €60 (1 modalidade)
    extra_modality_price_cents INTEGER DEFAULT 3000, -- €30 (cada extra)
    enrollment_fee_cents INTEGER DEFAULT 1500,       -- €15 (matrícula)
    currency VARCHAR(3) DEFAULT 'EUR'
);
```

#### discounts
Descontos de commitment (automáticos) e promocionais (com código).

```sql
CREATE TABLE discounts (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    category VARCHAR(20) CHECK (category IN ('commitment', 'promo')),
    discount_type VARCHAR(20) CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value INTEGER NOT NULL,
    min_commitment_months INTEGER,  -- Para commitment discounts
    valid_from DATE,                -- Para promos
    valid_until DATE,               -- Para promos
    max_uses INTEGER,               -- Para promos (NULL = ilimitado)
    current_uses INTEGER DEFAULT 0,
    new_members_only BOOLEAN DEFAULT false,
    ativo BOOLEAN DEFAULT true
);
```

**Descontos commitment padrão:**

| Código | Meses | Desconto |
|--------|-------|----------|
| MENSAL | 1 | 0% |
| TRIMESTRAL | 3 | 10% |
| SEMESTRAL | 6 | 15% |
| ANUAL | 12 | 20% |

#### subscriptions
Instância do plano para cada membro com snapshot de preços.

```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    member_id UUID REFERENCES members(id),
    modalities UUID[] NOT NULL,
    commitment_months INTEGER NOT NULL,
    -- Snapshot de preços (imutável)
    calculated_price_cents INTEGER NOT NULL,
    commitment_discount_pct INTEGER DEFAULT 0,
    promo_discount_pct INTEGER DEFAULT 0,
    final_price_cents INTEGER NOT NULL,
    enrollment_fee_cents INTEGER DEFAULT 0,
    -- Datas
    starts_at DATE DEFAULT CURRENT_DATE,
    expires_at DATE,
    status VARCHAR(15) DEFAULT 'active'
);
```

### 22.4 Alterações em Tabelas Existentes

#### plans
```sql
ALTER TABLE plans ADD COLUMN
    modalities UUID[] DEFAULT '{}',
    commitment_months INTEGER DEFAULT 1,
    pricing_override JSONB DEFAULT '{}',
    visible BOOLEAN DEFAULT true;
```

#### members
```sql
ALTER TABLE members ADD COLUMN
    current_subscription_id UUID REFERENCES subscriptions(id);
```

### 22.5 Fluxo de Checkout

```
1. Membro seleciona modalidades (M)
2. Membro seleciona período de compromisso (commitment_months)
3. Sistema busca PricingConfig
4. Sistema calcula: Subtotal = B + (M-1) × E
5. Sistema aplica desconto commitment (Dp) baseado em meses
6. Se código promo inserido:
   - Valida código (ativo, válido, não expirado, não esgotado)
   - Aplica desconto promo (Dpromo)
7. Calcula: Final = Subtotal × (1 - Dp/100) × (1 - Dpromo/100)
8. Se membro é LEAD: adiciona enrollment_fee
9. Cria registro em subscriptions com snapshot
10. Atualiza member.current_subscription_id
11. Cria transação(ões) financeira(s)
```

### 22.6 Exemplo de Cálculo

```
Config: B = €60, E = €30

Input:
  - 2 modalidades (Muay Thai + Jiu-Jitsu)
  - 6 meses de compromisso
  - Código: "UNI15" (15% desconto)
  - Membro LEAD

Cálculo:
  Subtotal = 60 + (2-1) × 30 = €90
  Dp = 15% (SEMESTRAL)
  Dpromo = 15% (UNI15)

  Final = 90 × 0.85 × 0.85 = €65.03
  + Matrícula = €15

  Total primeira mensalidade: €80.03
```

### 22.7 Regras de Negócio

1. **Desconto commitment é automático** - aplica-se baseado nos meses selecionados
2. **Apenas 1 código promo por checkout** - não acumula entre promos
3. **Promos + commitment acumulam** - são multiplicativos, não aditivos
4. **Taxa de matrícula só para LEAD** - nunca para renovações
5. **Snapshot é imutável** - mudanças em PricingConfig não afetam subscriptions existentes
6. **Override por plano** - Plan.pricing_override sobrescreve PricingConfig

### 22.8 Enrollment com Pricing Engine

A página de matrícula (`/staff/enrollment`) integra o Pricing Engine com duas opções:

#### Step 2: Configurar Subscrição (Dual Mode)

| Tab | Descrição | Uso |
|-----|-----------|-----|
| **Planos** | Selecionar plano pré-definido | Fluxo rápido para planos padrão |
| **Customizado** | Pricing Engine completo | Configuração flexível por modalidade |

**Tab Planos:**
- Lista de planos visíveis (`plans.visible = true`)
- Preço fixo do plano + taxa de matrícula (se LEAD)
- Ideal para: "Mensal Boxe €60", "Trimestral MMA €150"

**Tab Customizado:**
- Seleção múltipla de modalidades (checkboxes)
- Período de compromisso (Mensal, Trimestral, Semestral, Anual)
- Campo de código promocional (valida em tempo real)
- Taxa de matrícula editável (override do padrão)
- Resumo de preços com breakdown completo:
  - Base (1ª modalidade)
  - + Modalidades extras
  - - Desconto compromisso (%)
  - - Desconto promo (%)
  - = Mensal final
  - + Taxa matrícula (se LEAD)
  - = **TOTAL HOJE**

#### Dados da Subscription

Independente do modo, cria registro em `subscriptions` com snapshot:

```typescript
{
  member_id: string,
  plan_id: string | null,  // null se custom
  modalities: UUID[],
  commitment_months: number,
  calculated_price_cents: number,  // subtotal
  commitment_discount_pct: number,
  promo_discount_pct: number,
  final_price_cents: number,  // mensal após descontos
  enrollment_fee_cents: number,
  commitment_discount_id: string | null,
  promo_discount_id: string | null,
  starts_at: date,
  expires_at: date,
  status: 'active'
}
```

### 22.9 Interfaces Admin

| Rota | Descrição | Acesso |
|------|-----------|--------|
| `/admin/pricing` | Configurar preços base | OWNER, ADMIN |
| `/admin/discounts` | Gerenciar descontos e promos | OWNER, ADMIN |
| `/admin/modalities` | Gerenciar modalidades | OWNER, ADMIN |

### 22.10 Validação de Código Promocional

```javascript
function validatePromoCode(code, isNewMember) {
  const discount = db.discounts.findByCode(code);

  if (!discount) return { valid: false, error: "Código inválido" };
  if (!discount.ativo) return { valid: false, error: "Código inativo" };
  if (discount.category !== 'promo') return { valid: false, error: "Não é código promocional" };
  if (discount.valid_from && today < discount.valid_from) return { valid: false, error: "Código ainda não válido" };
  if (discount.valid_until && today > discount.valid_until) return { valid: false, error: "Código expirado" };
  if (discount.max_uses && discount.current_uses >= discount.max_uses) return { valid: false, error: "Código esgotado" };
  if (discount.new_members_only && !isNewMember) return { valid: false, error: "Válido apenas para novos membros" };

  return { valid: true, discount };
}
```
