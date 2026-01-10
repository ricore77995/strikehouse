# BoxeMaster Pro — Complete Spec v1.7

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

| Tipo | Quem | Permissões | Acesso |
|------|------|------------|--------|
| **OWNER** | Investidor | Visibilidade total, não opera | `/owner/*` |
| **ADMIN** | Sócio operacional | Tudo: config, financeiro, operação | `/admin/*` |
| **STAFF** | Recepção | Check-in, cadastro, receber pagamento | `/staff/*` |
| **PARTNER** | PT externo | Ver/cancelar próprios rentals, ver créditos | `/partner/*` |
| **Membro** | Cliente | Ver QR, treinar | `/m/[qr]` (público) |

> **ADMIN faz tudo, mas tudo fica registrado na Auditoria. OWNER vê o log completo.**

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
    
    -- Modelo de cobrança
    fee_type        VARCHAR(20) NOT NULL DEFAULT 'FIXED' 
                    CHECK (fee_type IN ('FIXED', 'PERCENTAGE')),
    fee_fixed_cents INTEGER,              -- se FIXED: valor em centavos por slot
    fee_percentage  DECIMAL(5,2),         -- se PERCENTAGE: % do plano base
    plan_base_id    UUID REFERENCES plans(id), -- plano de referência para cálculo de %
    
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
    guest_name      VARCHAR(255),
    
    created_by      UUID
);

CREATE INDEX idx_checkins_member ON check_ins(member_id);
CREATE INDEX idx_checkins_rental ON check_ins(rental_id);
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
-- STAFF/USERS
-- =============================================

CREATE TABLE staff (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id), -- link com Supabase Auth
    nome            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'STAFF', 'PARTNER')),
    coach_id        UUID REFERENCES external_coaches(id), -- só se role = PARTNER
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

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

### 19.2 IBAN do Membro

Cada membro pode ter múltiplos IBANs cadastrados para identificação automática de pagamentos.

```javascript
// Cadastro de membro inclui IBAN
{
  nome: "João Silva",
  telefone: "912345678",
  ibans: [
    { iban: "PT50 0035 0000 1234 5678 901 23", label: "Pessoal", is_primary: true },
    { iban: "PT50 0045 0000 9876 5432 101 99", label: "Empresa", is_primary: false }
  ]
}
```

### 19.3 Fluxo: Pagamento Presencial

```
Membro na recepção
    ↓
Escolhe método: Dinheiro / Cartão / MBway
    ↓
Staff confirma recebimento
    ↓
Registra no sistema → ATIVO → Envia QR
```

### 19.4 Fluxo: Pagamento por Transferência

```
Membro quer pagar por transferência
    ↓
Staff envia dados por WhatsApp:
    "João, transfere €69.00 para:
     IBAN: PT50 0035 0000 12345678901 23
     Titular: BoxeMaster Lda
     Tens 5 dias."
    ↓
Sistema cria Pagamento Pendente (status: PENDING)
    ↓
Membro transfere (com ou sem referência)
    ↓
Admin verifica extrato diariamente
    ↓
Match por IBAN → Confirma → ATIVO → Envia QR
```

### 19.5 Verificação de Extrato

```
┌─────────────────────────────────────────────────────────────────┐
│  VERIFICAR PAGAMENTOS                          📅 10 Jan 2026   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ IDENTIFICADOS (3)                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ €69.00   PT50 0035...1234   →  João Silva      [✓ OK]  │    │
│  │ €69.00   PT50 0045...5678   →  Maria Santos    [✓ OK]  │    │
│  │ €10.00   PT50 0022...9999   →  Carlos (Diária) [✓ OK]  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ❓ NÃO IDENTIFICADOS (2)                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ €69.00   PT50 0088...4444   [Buscar membro ▼] [Atribuir]│    │
│  │ €25.00   PT50 0011...7777   [Buscar membro ▼] [Atribuir]│    │
│  │                                                         │    │
│  │ ☐ Salvar IBAN no cadastro do membro                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [Confirmar Todos Identificados]                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 19.6 Implementação

```javascript
// Match de pagamento por IBAN
async function matchPagamentoByIBAN(iban, valorCents) {
  // Busca IBAN no cadastro
  const memberIban = await db.member_ibans.findOne({
    where: { iban: normalizeIBAN(iban) },
    include: { member: true }
  });
  
  if (!memberIban) {
    return { matched: false, iban, valor_cents: valorCents };
  }
  
  // Busca pagamento pendente do membro
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
    
    // 4. Registrar auditoria
    await auditLog(
      staffId,
      'PAYMENT_CONFIRM',
      'payment',
      pendingId,
      `Confirmou pagamento de ${pending.member.nome} €${(pending.amount_cents/100).toFixed(2)}`
    );
    
    // 5. Enviar QR por WhatsApp
    await sendWhatsApp(pending.member.telefone, 'payment_confirmed', {
      nome: pending.member.nome,
      plano: pending.plan.nome,
      qr_url: `${BASE_URL}/m/${pending.member.qr_code}`
    });
    
    return { transaction, member: pending.member };
  });
}
```

### 19.7 Disputa: "Eu Paguei!"

```
Membro bloqueado chega: "Mas eu paguei!"
    ↓
Staff: "Mostra o comprovativo"
    ↓
Membro mostra no telemóvel
    ↓
Staff verifica: valor ✓, data ✓, IBAN destino ✓
    ↓
Busca no extrato pelo valor + data
    ↓
Encontra → Confirma manualmente → Adiciona IBAN ao cadastro
    ↓
Não encontra → "Ainda não caiu" ou "IBAN errado"
```

---

## 10. Dashboard de Cobranças

### 10.1 Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│  💰 COBRANÇAS                                    10 Jan 2026    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔴 ATRASADOS (5)                          Total: €345          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ João Silva       Mensal €69    Venceu 05/01 (5 dias)   │    │
│  │ Maria Santos     Mensal €69    Venceu 07/01 (3 dias)   │    │
│  │ Carlos Mendes    Mensal €69    Venceu 08/01 (2 dias)   │    │
│  │ Ana Costa        Mensal €69    Venceu 09/01 (1 dia)    │    │
│  │ Pedro Lima       10x €69       Venceu 03/01 (7 dias)   │    │
│  │                                                         │    │
│  │ [Enviar Lembrete a Todos]  [Exportar Lista]            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  🟡 VENCEM HOJE (3)                        Total: €207          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Rita Ferreira    Mensal €69    Vence HOJE              │    │
│  │ Bruno Alves      Mensal €69    Vence HOJE              │    │
│  │ Sofia Dias       Mensal €69    Vence HOJE              │    │
│  │                                                         │    │
│  │ [Enviar Lembrete]                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  🟢 PRÓXIMOS 7 DIAS (8)                    Total: €552          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 11/01 (amanhã)   Miguel Torres     Mensal €69          │    │
│  │ 11/01 (amanhã)   Laura Sousa       Mensal €69          │    │
│  │ 12/01 (2 dias)   Hugo Martins      Mensal €69          │    │
│  │ ...mais 5                                               │    │
│  │ [Ver Todos]                                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  📊 RESUMO DO MÊS                                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Esperado:        €5.520 (80 renovações)                 │    │
│  │ Recebido:        €2.760 (40 renovações) ▓▓▓▓▓░░░░░ 50%  │    │
│  │ Em atraso:       €345   (5 membros)                     │    │
│  │ A vencer:        €2.415 (35 membros)                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Queries

```sql
-- Atrasados (expirou e não renovou)
SELECT m.*, 
       CURRENT_DATE - m.access_expires_at as dias_atraso,
       p.preco_cents
FROM members m
JOIN plans p ON p.tipo = m.access_type
WHERE m.access_expires_at < CURRENT_DATE
  AND m.status IN ('BLOQUEADO', 'ATIVO')
  AND NOT EXISTS (
    SELECT 1 FROM pending_payments pp 
    WHERE pp.member_id = m.id 
    AND pp.status = 'CONFIRMED'
    AND pp.confirmed_at > m.access_expires_at
  )
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

### 10.3 Ações

| Ação | O que faz |
|------|-----------|
| **Clica no membro** | Abre ficha com histórico |
| **Enviar Lembrete** | WhatsApp com IBAN |
| **Marcar como Pago** | Abre modal de confirmação |
| **Ligar** | Abre WhatsApp direto |

---

## 11. Notificações Automáticas

### 16.1 WhatsApp Templates

| Quando | Template | Mensagem |
|--------|----------|----------|
| 3 dias antes | `payment_reminder_3d` | "Olá {nome}! Teu plano vence dia {data}. Renova por transferência: IBAN {iban}" |
| No dia | `payment_reminder_today` | "{nome}, teu plano vence HOJE. Transfere €{valor} para continuar a treinar 🥊" |
| 1 dia depois | `payment_overdue_1d` | "{nome}, teu plano expirou ontem. Renova para não perder acesso!" |
| 3 dias depois | `payment_overdue_3d` | "{nome}, estamos com saudades! Teu acesso está bloqueado. Fala connosco 💪" |
| Pagamento confirmado | `payment_confirmed` | "Pagamento confirmado! Teu acesso está ativo até {data}. QR: {qr_url}" |
| Bem-vindo | `welcome` | "Bem-vindo ao BoxeMaster! 🥊 Teu QR: {qr_url}" |

### 16.2 Jobs Automáticos

```javascript
// Roda diariamente às 09:00
async function jobNotificacoesVencimento() {
  // 3 dias antes
  const vencemEm3Dias = await getMembrosPorVencimento(3);
  for (const m of vencemEm3Dias) {
    await sendWhatsApp(m.telefone, 'payment_reminder_3d', {
      nome: m.nome,
      data: formatDate(m.access_expires_at),
      iban: ACADEMIA_IBAN,
      valor: (m.plano_preco / 100).toFixed(2)
    });
  }
  
  // No dia
  const vencemHoje = await getMembrosPorVencimento(0);
  for (const m of vencemHoje) {
    await sendWhatsApp(m.telefone, 'payment_reminder_today', { ... });
  }
  
  // 1 dia depois
  const venceram1Dia = await getMembrosAtrasados(1);
  for (const m of venceram1Dia) {
    await sendWhatsApp(m.telefone, 'payment_overdue_1d', { ... });
  }
  
  // 3 dias depois
  const venceram3Dias = await getMembrosAtrasados(3);
  for (const m of venceram3Dias) {
    await sendWhatsApp(m.telefone, 'payment_overdue_3d', { ... });
  }
}

// Roda diariamente às 00:05
async function jobBloqueioAutomatico() {
  // Bloqueia quem expirou ontem e não pagou
  await db.members.updateMany({
    where: {
      access_expires_at: { lt: TODAY },
      status: 'ATIVO'
    },
    data: { status: 'BLOQUEADO' }
  });
}

// Roda diariamente às 00:10
async function jobCancelamentoAutomatico() {
  // Cancela quem está bloqueado há mais de 30 dias
  await db.members.updateMany({
    where: {
      status: 'BLOQUEADO',
      access_expires_at: { lt: addDays(TODAY, -30) }
    },
    data: { status: 'CANCELADO' }
  });
}
```

---

## 12. Auditoria

### 17.1 O Que é Logado

| Categoria | Ações |
|-----------|-------|
| **Membros** | Criar, editar, bloquear, cancelar, reativar |
| **Pagamentos** | Confirmar, cancelar, estornar, atribuir manual |
| **Caixa** | Abrir, fechar, registrar despesa, ajuste |
| **Rentals** | Criar, cancelar, gerar crédito |
| **Coaches** | Criar, editar, desativar |
| **Planos** | Criar, editar preço, desativar |
| **Staff** | Criar usuário, alterar role, desativar |
| **Config** | Alterar áreas, categorias, configurações |

### 17.2 Tela de Auditoria (OWNER/ADMIN)

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 AUDITORIA                                    10 Jan 2026    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Filtros: [Todos ▼] [Todas ações ▼] [Últimos 7 dias ▼] [Buscar] │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  HOJE                                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 14:32  👤 Carlos (ADMIN)                                │    │
│  │        Confirmou pagamento de João Silva €69            │    │
│  │        [Ver detalhes]                                   │    │
│  │                                                         │    │
│  │ 14:15  👤 Ana (STAFF)                                   │    │
│  │        Registrou despesa: Limpeza €45                   │    │
│  │        [Ver detalhes]                                   │    │
│  │                                                         │    │
│  │ 11:20  👤 Carlos (ADMIN)                                │    │
│  │        Alterou preço: Mensal €65 → €69                  │    │
│  │        [Ver detalhes]                                   │    │
│  │                                                         │    │
│  │ 09:45  👤 Ana (STAFF)                                   │    │
│  │        Cadastrou membro: Maria Santos                   │    │
│  │        [Ver detalhes]                                   │    │
│  │                                                         │    │
│  │ 09:00  👤 Ana (STAFF)                                   │    │
│  │        Abriu caixa: €150                                │    │
│  │        [Ver detalhes]                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [Carregar mais]                        Exportar [CSV] [PDF]    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 17.3 Detalhe da Ação

```
┌─────────────────────────────────────────────────────────────────┐
│  DETALHE DA AÇÃO                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Ação:       Alterou preço de plano                             │
│  Usuário:    Carlos Silva (ADMIN)                               │
│  Data/Hora:  10/01/2026 11:20:33                                │
│                                                                 │
│  ANTES                       DEPOIS                             │
│  ┌─────────────────────┐     ┌─────────────────────┐            │
│  │ Plano: Mensal       │     │ Plano: Mensal       │            │
│  │ Preço: €65.00       │ →   │ Preço: €69.00       │            │
│  │ Duração: 30 dias    │     │ Duração: 30 dias    │            │
│  └─────────────────────┘     └─────────────────────┘            │
│                                                                 │
│  [Fechar]                                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 17.4 Resumo por Staff

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 ATIVIDADE POR STAFF                    Janeiro 2026         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CARLOS (ADMIN)                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Pagamentos confirmados:     45    (€3.105)              │    │
│  │ Membros cadastrados:        12                          │    │
│  │ Despesas registradas:       8     (€890)                │    │
│  │ Alterações de config:       3                           │    │
│  │ Última atividade:           Hoje 14:32                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ANA (STAFF)                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Check-ins realizados:       234                         │    │
│  │ Pagamentos confirmados:     23    (€1.587)              │    │
│  │ Membros cadastrados:        8                           │    │
│  │ Aberturas de caixa:         15                          │    │
│  │ Última atividade:           Hoje 14:15                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 17.5 Alertas para OWNER

| Evento | Notifica |
|--------|----------|
| Estorno de pagamento | ⚠️ Imediato |
| Diferença de caixa > €10 | ⚠️ Imediato |
| Alteração de preço de plano | 📧 Relatório diário |
| Despesa > €200 | 📧 Relatório diário |
| Usuário desativado | 📧 Relatório diário |
| Muitos cancelamentos (>3/dia) | ⚠️ Imediato |

### 17.6 Implementação

```javascript
// Helper para criar log de auditoria
async function auditLog(userId, action, entityType, entityId, description, oldValue = null, newValue = null) {
  const user = await db.staff.findById(userId);
  
  await db.audit_logs.create({
    user_id: userId,
    user_role: user.role,
    action,
    entity_type: entityType,
    entity_id: entityId,
    description,
    old_value: oldValue,
    new_value: newValue,
    created_at: NOW()
  });
  
  // Verificar se precisa alertar OWNER
  const alertasImediatos = ['PAYMENT_REFUND', 'CASH_DIFFERENCE_HIGH', 'MASS_CANCELLATION'];
  if (alertasImediatos.includes(action)) {
    await notifyOwners(action, description);
  }
}

// Exemplo de uso
async function alterarPrecoPlano(planId, novoPreco, adminId) {
  const plano = await db.plans.findById(planId);
  const precoAntigo = plano.preco_cents;
  
  await db.plans.update(planId, { preco_cents: novoPreco });
  
  await auditLog(
    adminId,
    'PLAN_PRICE_CHANGE',
    'plan',
    planId,
    `Alterou preço: ${plano.nome} €${(precoAntigo/100).toFixed(2)} → €${(novoPreco/100).toFixed(2)}`,
    { preco_cents: precoAntigo },
    { preco_cents: novoPreco }
  );
}
```

---

## 13. Dashboard do OWNER

### 13.1 Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│  BOXEMASTER PRO                              Olá, Ricardo 👋    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  💰 FINANCEIRO                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  HOJE           SEMANA          MÊS            ANO      │    │
│  │  €450           €2.340          €8.920         €47.800  │    │
│  │  ↑12%           ↑8%             ↑15%           ↑22%     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  📊 RECEITA vs DESPESA (últimos 6 meses)                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  [===== GRÁFICO DE BARRAS =====]                        │    │
│  │  Jul   Ago   Set   Out   Nov   Dez                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  📈 MÉTRICAS CHAVE                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ MRR          │ │ Churn        │ │ Ticket Médio │            │
│  │ €6.090       │ │ 4.2%         │ │ €69          │            │
│  │ 87 membros   │ │ ↓0.5%        │ │ ↑€3          │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                 │
│  ⚠️ ATENÇÃO                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🔴 5 atrasados (€345)                                  │    │
│  │  🟡 3 vencem hoje (€207)                                │    │
│  │  🟢 8 vencem esta semana                                │    │
│  │  [Ver Cobranças]                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  💸 FLUXO DE CAIXA                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Saldo atual em caixa:              €1.234              │    │
│  │  Contas a pagar (próx 7 dias):      €890                │    │
│  │  Previsão fim do mês:               €4.200              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  🔔 ALERTAS RECENTES                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ⚠️  Despesa acima do normal: Manutenção +€340          │    │
│  │  ✅  Meta de receita atingida (102%)                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [Ver Extrato]  [Cobranças]  [Auditoria]  [Exportar Relatório]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 13.2 Relatório Semanal (Automático)

Enviado toda segunda de manhã por email/WhatsApp:

```
📊 BOXEMASTER - Semana 06/01 a 12/01

RECEITAS
  Mensalidades:     €2.100
  Diárias:          €180
  Sublocação:       €420
  ─────────────────────────
  Total:            €2.700

DESPESAS
  Fixas:            €890
  Variáveis:        €340
  ─────────────────────────
  Total:            €1.230

RESULTADO:          €1.470 ✅

MEMBROS
  Novos:            4
  Cancelados:       1
  Ativos:           88

OCUPAÇÃO
  Check-ins:        234
  Guests:           67

[Ver Dashboard Completo]
```

### 13.3 O Que OWNER Vê vs Faz

| Módulo | Vê | Faz |
|--------|----|----|
| Dashboard financeiro | ✅ | — |
| Extrato de transações | ✅ | — |
| Cobranças (atrasados, vencendo) | ✅ | — |
| Métricas (MRR, churn, ticket) | ✅ | — |
| Auditoria completa | ✅ | — |
| Relatórios | ✅ | Exportar |
| Cadastrar membro | — | ❌ |
| Check-in | — | ❌ |
| Registrar despesa | — | ❌ |
| Configurações | — | ❌ |

---

## 14. Sublocação e Parcerias

### 19.1 Conceito

Coach externo = parceiro que aluga espaço para dar aulas próprias.

> **Não rastreamos alunos individualmente. Cobramos pelo uso do espaço.**

### 19.2 Áreas e Capacidade

Cada área tem uma capacidade de PTs simultâneos:

| Área | Capacidade | Exclusivo | Descrição |
|------|------------|-----------|-----------|
| Ringue | 1 | Não | Só 1 PT por vez |
| Área de Sacos | 3 | Não | Até 3 PTs simultâneos |
| Funcional | 2 | Não | Até 2 PTs simultâneos |
| Espaço Completo | 1 | **Sim** | Aluga tudo, bloqueia membros |

### 19.3 Modelos de Fee

| Modelo | Descrição | Exemplo |
|--------|-----------|---------|
| `FIXED` | Valor fixo por slot | €15/hora, €100/aula |
| `PERCENTAGE` | % do plano mensal base | 30% de €70 = €21/aula |

### 19.4 Configuração por Coach

```javascript
// Exemplo: PT com taxa fixa
{
  nome: "Carlos PT",
  fee_type: "FIXED",
  fee_fixed_cents: 1500, // €15 por slot
  fee_percentage: null,
  plan_base_id: null
}

// Exemplo: Professor com percentual
{
  nome: "João Jiu-Jitsu",
  fee_type: "PERCENTAGE",
  fee_fixed_cents: null,
  fee_percentage: 30.00, // 30%
  plan_base_id: "uuid-do-plano-mensal-70" // referência para cálculo
}
```

### 19.5 Verificar Disponibilidade de Área

```javascript
async function verificarDisponibilidade(areaId, data, horaInicio, horaFim) {
  const area = await db.areas.findById(areaId);
  
  // Conta rentals que sobrepõem esse horário
  const rentalsNoHorario = await db.rentals.count({
    where: {
      area_id: areaId,
      data: data,
      hora_inicio: { lt: horaFim },
      hora_fim: { gt: horaInicio }
    }
  });
  
  const disponivel = rentalsNoHorario < area.capacidade_pts;
  const slotsRestantes = area.capacidade_pts - rentalsNoHorario;
  
  return { 
    disponivel, 
    slotsRestantes, 
    capacidade: area.capacidade_pts,
    ocupados: rentalsNoHorario
  };
}

// Listar todas as áreas com disponibilidade para um horário
async function listarAreasComDisponibilidade(data, horaInicio, horaFim) {
  const areas = await db.areas.findAll({ where: { ativo: true } });
  
  return await Promise.all(areas.map(async (area) => {
    const disp = await verificarDisponibilidade(area.id, data, horaInicio, horaFim);
    return { ...area, ...disp };
  }));
}
```

### 19.6 Criar Rental

```javascript
async function criarRental(coachId, areaId, data, horaInicio, horaFim, paymentMethod, staffId) {
  // 1. Verificar disponibilidade
  const { disponivel, slotsRestantes } = await verificarDisponibilidade(areaId, data, horaInicio, horaFim);
  
  if (!disponivel) {
    throw new Error(`Área sem disponibilidade. Slots restantes: ${slotsRestantes}`);
  }
  
  const coach = await db.external_coaches.findById(coachId);
  const area = await db.areas.findById(areaId);
  const valorCents = await calcularValorRental(coachId);
  
  return await db.transaction(async (tx) => {
    // 2. Criar transação financeira
    const category = coach.fee_type === 'FIXED' ? 'RENTAL_FIXED' : 'RENTAL_PERCENTAGE';
    
    const transaction = await tx.transactions.create({
      type: 'RECEITA',
      amount_cents: valorCents,
      payment_method: paymentMethod,
      category: category,
      description: `${coach.nome} - ${area.nome} - ${data} ${horaInicio}-${horaFim}`,
      reference_type: 'RENTAL',
      created_by: staffId
    });
    
    // 3. Atualizar caixa (se dinheiro)
    if (paymentMethod === 'DINHEIRO') {
      await tx.cash_sessions.increment(
        { session_date: TODAY },
        { total_cash_in_cents: valorCents }
      );
    }
    
    // 4. Criar rental
    const rental = await tx.rentals.create({
      coach_id: coachId,
      area_id: areaId,
      data: data,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      fee_type: coach.fee_type,
      valor_cents: valorCents,
      pago: true,
      transaction_id: transaction.id
    });
    
    return { rental, transaction };
  });
}

async function calcularValorRental(coachId) {
  const coach = await db.external_coaches.findById(coachId);
  
  if (coach.fee_type === 'FIXED') {
    return coach.fee_fixed_cents;
  }
  
  if (coach.fee_type === 'PERCENTAGE') {
    const planBase = await db.plans.findById(coach.plan_base_id);
    return Math.round(planBase.preco_cents * (coach.fee_percentage / 100));
  }
  
  throw new Error('Modelo de fee inválido');
}
```

### 19.7 Criar Rental Recorrente (Série)

```javascript
async function criarRentalRecorrente(coachId, areaId, diaSemana, horaInicio, horaFim, semanas, paymentMethod, staffId) {
  const seriesId = generateUUID();
  const coach = await db.external_coaches.findById(coachId);
  const area = await db.areas.findById(areaId);
  const valorCentsPorSlot = await calcularValorRental(coachId);
  
  // Gerar datas das próximas N semanas
  const datas = [];
  let proximaData = getNextWeekday(diaSemana); // próxima segunda, terça, etc.
  
  for (let i = 0; i < semanas; i++) {
    datas.push(proximaData);
    proximaData = addDays(proximaData, 7);
  }
  
  // Verificar disponibilidade de TODAS as datas
  for (const data of datas) {
    const { disponivel } = await verificarDisponibilidade(areaId, data, horaInicio, horaFim);
    if (!disponivel) {
      throw new Error(`Área indisponível em ${formatDate(data)}`);
    }
  }
  
  const valorTotal = valorCentsPorSlot * semanas;
  
  // Verificar se coach tem créditos disponíveis
  const creditosDisponiveis = await getCoachCreditsTotal(coachId);
  const valorAPagar = Math.max(0, valorTotal - creditosDisponiveis);
  const creditosAUsar = valorTotal - valorAPagar;
  
  return await db.transaction(async (tx) => {
    // 1. Usar créditos se houver
    if (creditosAUsar > 0) {
      await consumirCreditos(tx, coachId, creditosAUsar, seriesId);
    }
    
    // 2. Criar transação do valor restante (se houver)
    let transaction = null;
    if (valorAPagar > 0) {
      const category = coach.fee_type === 'FIXED' ? 'RENTAL_FIXED' : 'RENTAL_PERCENTAGE';
      
      transaction = await tx.transactions.create({
        type: 'RECEITA',
        amount_cents: valorAPagar,
        payment_method: paymentMethod,
        category: category,
        description: `${coach.nome} - ${area.nome} - Série ${semanas}x (${diaSemanaLabel(diaSemana)} ${horaInicio})`,
        reference_type: 'RENTAL_SERIES',
        reference_id: seriesId,
        created_by: staffId
      });
      
      if (paymentMethod === 'DINHEIRO') {
        await tx.cash_sessions.increment(
          { session_date: TODAY },
          { total_cash_in_cents: valorAPagar }
        );
      }
    }
    
    // 3. Criar todos os rentals da série
    const rentals = [];
    for (const data of datas) {
      const rental = await tx.rentals.create({
        coach_id: coachId,
        area_id: areaId,
        data: data,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        series_id: seriesId,
        fee_type: coach.fee_type,
        valor_cents: valorCentsPorSlot,
        status: 'SCHEDULED',
        pago: true,
        transaction_id: transaction?.id
      });
      rentals.push(rental);
    }
    
    return { 
      series_id: seriesId, 
      rentals, 
      transaction, 
      creditos_usados: creditosAUsar,
      valor_pago: valorAPagar
    };
  });
}
```

### 19.8 Cancelamento de Rental

**Política:**
- Antecedência ≥24h → gera crédito
- Antecedência <24h → perdeu
- Crédito vale 90 dias

```javascript
const ANTECEDENCIA_MINIMA_HORAS = 24;
const CREDITO_VALIDADE_DIAS = 90;

async function cancelarRental(rentalId, staffId) {
  const rental = await db.rentals.findById(rentalId, { include: { coach: true, area: true } });
  
  if (!rental) throw new Error('Rental não encontrado');
  if (rental.status === 'CANCELLED') throw new Error('Rental já cancelado');
  if (rental.status === 'COMPLETED') throw new Error('Rental já realizado');
  
  const horasAteRental = differenceInHours(
    new Date(`${rental.data}T${rental.hora_inicio}`),
    new Date()
  );
  
  const geraCredito = horasAteRental >= ANTECEDENCIA_MINIMA_HORAS;
  
  return await db.transaction(async (tx) => {
    // 1. Marcar rental como cancelado
    await tx.rentals.update(rentalId, {
      status: 'CANCELLED',
      cancelled_at: NOW(),
      cancelled_by: staffId,
      credit_generated: geraCredito
    });
    
    // 2. Gerar crédito se aplicável
    let credito = null;
    if (geraCredito) {
      credito = await tx.coach_credits.create({
        coach_id: rental.coach_id,
        valor_cents: rental.valor_cents,
        origin_type: 'CANCELLATION',
        origin_rental_id: rentalId,
        expires_at: addDays(TODAY, CREDITO_VALIDADE_DIAS),
        created_by: staffId
      });
    }
    
    return {
      rental,
      credito_gerado: geraCredito,
      credito,
      motivo: geraCredito 
        ? `Crédito de €${(rental.valor_cents/100).toFixed(2)} gerado (válido 90 dias)`
        : `Cancelado com menos de ${ANTECEDENCIA_MINIMA_HORAS}h - sem crédito`
    };
  });
}

async function cancelarSerie(seriesId, staffId) {
  // Busca apenas rentals FUTUROS e SCHEDULED da série
  const rentals = await db.rentals.findAll({
    where: {
      series_id: seriesId,
      status: 'SCHEDULED',
      data: { gte: TODAY }
    },
    orderBy: { data: 'asc' }
  });
  
  if (rentals.length === 0) {
    throw new Error('Nenhum rental futuro para cancelar');
  }
  
  const resultados = [];
  for (const rental of rentals) {
    const resultado = await cancelarRental(rental.id, staffId);
    resultados.push(resultado);
  }
  
  const totalCreditos = resultados
    .filter(r => r.credito_gerado)
    .reduce((sum, r) => sum + r.credito.valor_cents, 0);
  
  return {
    cancelados: resultados.length,
    com_credito: resultados.filter(r => r.credito_gerado).length,
    sem_credito: resultados.filter(r => !r.credito_gerado).length,
    total_creditos_cents: totalCreditos
  };
}

// Helpers
async function getCoachCreditsTotal(coachId) {
  const creditos = await db.coach_credits.findAll({
    where: {
      coach_id: coachId,
      used: false,
      expires_at: { gte: TODAY }
    }
  });
  return creditos.reduce((sum, c) => sum + c.valor_cents, 0);
}

async function consumirCreditos(tx, coachId, valorCents, usedRentalId) {
  const creditos = await tx.coach_credits.findAll({
    where: {
      coach_id: coachId,
      used: false,
      expires_at: { gte: TODAY }
    },
    orderBy: { expires_at: 'asc' } // usa os mais próximos de expirar primeiro
  });
  
  let restante = valorCents;
  for (const credito of creditos) {
    if (restante <= 0) break;
    
    if (credito.valor_cents <= restante) {
      // Usa crédito inteiro
      await tx.coach_credits.update(credito.id, {
        used: true,
        used_at: NOW(),
        used_rental_id: usedRentalId
      });
      restante -= credito.valor_cents;
    } else {
      // Usa parcial (divide o crédito)
      await tx.coach_credits.update(credito.id, {
        valor_cents: credito.valor_cents - restante
      });
      // Cria registro do valor usado
      await tx.coach_credits.create({
        coach_id: coachId,
        valor_cents: restante,
        origin_type: 'ADJUSTMENT',
        used: true,
        used_at: NOW(),
        used_rental_id: usedRentalId,
        expires_at: credito.expires_at,
        created_by: credito.created_by
      });
      restante = 0;
    }
  }
}
```
```

### 14.9 Bloqueio por Área Exclusiva

Quando um rental está ativo em área com `is_exclusive = true`:
- Check-in de MEMBER é bloqueado durante o horário
- Apenas GUESTs do rental podem entrar

---

## 15. Relatórios

### 10.1 Dashboard Diário

```
┌─────────────────────────────────────────────────────────┐
│  BOXEMASTER PRO                        📅 10 Jan 2026   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  HOJE                          │  ESTE MÊS             │
│  ───────────────────────────   │  ───────────────────  │
│  Receitas:     €450            │  Receitas:   €4.850   │
│  Despesas:     €85             │  Despesas:   €2.120   │
│  ────────────────────          │  ────────────────     │
│  Resultado:    €365 ✅         │  Resultado:  €2.730   │
│                                │                        │
│  Caixa:        €234            │  % Sublocação: 18%    │
│                                │                        │
│  ENTRADAS HOJE                 │  MEMBROS              │
│  Members:      23              │  Ativos:      87      │
│  Guests:       12              │  Expirando:   5       │
│  Total:        35              │                        │
│                                │                        │
├─────────────────────────────────────────────────────────┤
│  OCUPAÇÃO DE ÁREAS (agora)                              │
│  Ringue:       1/1 🔴          Sacos: 1/3 🟢           │
│  Funcional:    0/2 🟢          Completo: 0/1 🟢        │
├─────────────────────────────────────────────────────────┤
│  RENTALS HOJE                                           │
│  14:00-16:00  Carlos PT      Sacos       €30   3 guests│
│  19:00-21:00  João JJ        Completo    €21  28 guests│
├─────────────────────────────────────────────────────────┤
│  ÚLTIMAS TRANSAÇÕES                                     │
│  09:15  ↑ €69   Subscription    João Silva              │
│  09:30  ↑ €30   Rental Fixed    Carlos PT               │
│  10:00  ↓ €45   Limpeza         Serviço mensal          │
└─────────────────────────────────────────────────────────┘
```

### 10.2 Queries SQL

```sql
-- Resumo diário
SELECT 
    SUM(CASE WHEN type = 'RECEITA' THEN amount_cents ELSE 0 END) / 100.0 as receitas,
    SUM(CASE WHEN type = 'DESPESA' THEN amount_cents ELSE 0 END) / 100.0 as despesas,
    SUM(CASE WHEN type = 'RECEITA' THEN amount_cents ELSE -amount_cents END) / 100.0 as resultado
FROM transactions
WHERE transaction_date = CURRENT_DATE;

-- Check-ins por tipo (hoje)
SELECT 
    type,
    COUNT(*) as total
FROM check_ins 
WHERE DATE(timestamp) = CURRENT_DATE
GROUP BY type;

-- Ocupação atual por área
SELECT 
    a.nome as area,
    a.capacidade_pts as capacidade,
    COUNT(r.id) as ocupados,
    a.capacidade_pts - COUNT(r.id) as disponiveis,
    a.is_exclusive
FROM areas a
LEFT JOIN rentals r ON r.area_id = a.id 
    AND r.data = CURRENT_DATE
    AND r.hora_inicio <= CURRENT_TIME
    AND r.hora_fim >= CURRENT_TIME
WHERE a.ativo = true
GROUP BY a.id, a.nome, a.capacidade_pts, a.is_exclusive;

-- Receita de sublocação por coach (mês)
SELECT 
    ec.nome as coach,
    ec.fee_type,
    COUNT(r.id) as rentals,
    SUM(r.valor_cents) / 100.0 as total_receita,
    SUM(r.guest_count) as total_guests
FROM rentals r
JOIN external_coaches ec ON r.coach_id = ec.id
WHERE r.data >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY ec.id, ec.nome, ec.fee_type
ORDER BY total_receita DESC;

-- Rentals de hoje com área
SELECT 
    r.*,
    ec.nome as coach_nome,
    a.nome as area_nome,
    a.is_exclusive
FROM rentals r
JOIN external_coaches ec ON r.coach_id = ec.id
JOIN areas a ON r.area_id = a.id
WHERE r.data = CURRENT_DATE
ORDER BY r.hora_inicio;
```

### 10.3 Alertas

| Alerta | Trigger |
|--------|---------|
| 🔴 Caixa baixo | `actual_closing < €50` |
| 🟡 Despesa alta | Mês atual > anterior + 20% |
| 🟡 Receita caiu | Mês atual < anterior - 10% |
| 🟠 Expiram hoje | Membros com `expires_at = TODAY` |
| 🔵 Área lotada | `ocupados >= capacidade` |
| ⚫ Espaço Exclusivo | Rental ativo em área `is_exclusive` |

---

## 16. Interfaces

### 16.1 Tablet de Recepção (Check-in Universal)

```
┌─────────────────────────────────────┐
│         BOXEMASTER PRO              │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │   📷 ESCANEAR QR MEMBRO     │    │
│  │   [Abrir Câmera]            │    │
│  │                             │    │
│  │   ou buscar por nome/tel:   │    │
│  │   [____________________]    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │   👥 ENTRADA GUEST          │    │
│  │   ▼ Selecionar rental       │    │
│  │   ┌───────────────────────┐ │    │
│  │   │ 14h Carlos (Sacos)    │ │    │
│  │   │ 19h João (Completo)   │ │    │
│  │   └───────────────────────┘ │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │      RESULTADO AQUI         │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Membros: 23 | Guests: 12           │
│  ⚫ ESPAÇO EXCLUSIVO até 21h        │
└─────────────────────────────────────┘
```

### 16.1.1 Tela de Scan QR

```
┌─────────────────────────────────────┐
│         ESCANEAR QR                 │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │                             │    │
│  │      [ CÂMERA ATIVA ]       │    │
│  │                             │    │
│  │      Aponte para o QR       │    │
│  │      do membro              │    │
│  │                             │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Cancelar]                         │
│                                     │
└─────────────────────────────────────┘
```

### 16.1.2 Resultado Check-in (Sucesso)

```
┌─────────────────────────────────────┐
│                                     │
│         ✅ LIBERADO                 │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │   João Silva                │    │
│  │   Mensal até 15/02/2026     │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Próximo Check-in]                 │
│                                     │
└─────────────────────────────────────┘
```

### 16.1.3 Resultado Check-in (Bloqueado)

```
┌─────────────────────────────────────┐
│                                     │
│         ❌ BLOQUEADO                │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │   Maria Santos              │    │
│  │   Acesso expirou em 05/01   │    │
│  │                             │    │
│  │   [Renovar Agora]           │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Voltar]                           │
│                                     │
└─────────────────────────────────────┘
```

### 16.1.4 QR do Membro (o que ele vê no celular)

```
┌─────────────────────────────────────┐
│         BOXEMASTER                  │
├─────────────────────────────────────┤
│                                     │
│   João Silva                        │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │        ▄▄▄▄▄▄▄▄▄▄▄         │    │
│  │        █ QR CODE █         │    │
│  │        █         █         │    │
│  │        █ MBR-    █         │    │
│  │        █ A1B2C3D4█         │    │
│  │        ▀▀▀▀▀▀▀▀▀▀▀         │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│   Mostre este QR na recepção        │
│                                     │
│  [Adicionar ao Wallet]              │
│                                     │
└─────────────────────────────────────┘
```

### 16.2 Criar Rental (com recorrência)

```
┌─────────────────────────────────────────────────┐
│  NOVO RENTAL                                    │
├─────────────────────────────────────────────────┤
│  Coach: [Carlos PT ▼]                           │
│  Dia:   [Segunda-feira ▼]                       │
│  Horário: [13:00] até [14:00]                   │
│                                                 │
│  ÁREA                                           │
│  ┌─────────────────────────────────────────┐    │
│  │ ○ Ringue           0/1  🟢 disponível  │    │
│  │ ● Área de Sacos    1/3  🟢 disponível  │    │
│  │ ○ Funcional        2/2  🔴 lotado      │    │
│  │ ○ Espaço Completo  0/1  🟢 disponível  │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  RECORRÊNCIA                                    │
│  ☑ Repetir semanalmente                         │
│  Quantidade: [12] semanas                       │
│  Período: 13/01 até 31/03/2026                  │
│                                                 │
│  COBRANÇA                                       │
│  Modelo: Taxa Fixa                              │
│  Valor unitário: €15.00                         │
│  ────────────────────────────                   │
│  Créditos disponíveis: €30.00                   │
│  Total (12x): €180.00                           │
│  - Créditos: -€30.00                            │
│  ════════════════════                           │
│  A pagar: €150.00                               │
│                                                 │
│  [Cancelar]                    [Confirmar]      │
└─────────────────────────────────────────────────┘
```

### 16.3 Gerenciar Série / Cancelar

```
┌─────────────────────────────────────────────────┐
│  SÉRIE: Carlos PT - Segundas 13h                │
├─────────────────────────────────────────────────┤
│  Área: Área de Sacos                            │
│  Período: 13/01 - 31/03/2026 (12 semanas)       │
│                                                 │
│  STATUS                                         │
│  ┌─────────────────────────────────────────┐    │
│  │ ✅ 13/01  Realizado    3 guests         │    │
│  │ ✅ 20/01  Realizado    2 guests         │    │
│  │ 📅 27/01  Agendado     [Cancelar]       │    │
│  │ 📅 03/02  Agendado     [Cancelar]       │    │
│  │ 📅 10/02  Agendado     [Cancelar]       │    │
│  │ ...                                     │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  CRÉDITOS DO COACH                              │
│  Disponível: €30.00 (expira 15/04)              │
│                                                 │
│  [Cancelar Série Toda]                          │
│  ⚠️ Cancela 10 rentals futuros                  │
│  → 9 com crédito (≥24h): €135.00                │
│  → 1 sem crédito (<24h): €0.00                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 16.4 Cancelar Individual (confirmação)

```
┌─────────────────────────────────────────────────┐
│  CANCELAR RENTAL                                │
├─────────────────────────────────────────────────┤
│                                                 │
│  Carlos PT - Segunda 27/01 13:00                │
│  Área de Sacos                                  │
│  Valor: €15.00                                  │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  ✅ Cancelamento com mais de 24h        │    │
│  │  → Gera crédito de €15.00               │    │
│  │  → Válido até 27/04/2026                │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  [Voltar]                 [Confirmar Cancelar]  │
│                                                 │
└─────────────────────────────────────────────────┘
```

Ou se for em cima da hora:

```
┌─────────────────────────────────────────────────┐
│  CANCELAR RENTAL                                │
├─────────────────────────────────────────────────┤
│                                                 │
│  Carlos PT - Segunda 27/01 13:00                │
│  Área de Sacos                                  │
│  Valor: €15.00                                  │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  ⚠️ Cancelamento com menos de 24h       │    │
│  │  → NÃO gera crédito                     │    │
│  │  → Valor perdido                        │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  [Voltar]                 [Confirmar Cancelar]  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 16.5 Config de Áreas

```
┌─────────────────────────────────────────────────┐
│  ÁREAS                                          │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Ringue                                  │    │
│  │ Capacidade: [1] PT(s)   □ Exclusivo     │    │
│  │ [Editar] [Desativar]                    │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Área de Sacos                           │    │
│  │ Capacidade: [3] PTs     □ Exclusivo     │    │
│  │ [Editar] [Desativar]                    │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Espaço Completo                         │    │
│  │ Capacidade: [1] PT      ☑ Exclusivo     │    │
│  │ [Editar] [Desativar]                    │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  [+ Nova Área]                                  │
└─────────────────────────────────────────────────┘
```

### 16.6 Config de Coach Externo

```
┌─────────────────────────────────────────────────┐
│  NOVO COACH EXTERNO                             │
├─────────────────────────────────────────────────┤
│                                                 │
│  Nome: [________________________]               │
│  Telefone: [___________________]                │
│  Modalidade: [Jiu-Jitsu ▼]                      │
│                                                 │
│  MODELO DE COBRANÇA                             │
│  ┌─────────────────────────────────────────┐    │
│  │ ○ Taxa Fixa                             │    │
│  │   Valor por slot: €[____]               │    │
│  │                                         │    │
│  │ ● Percentual do Plano                   │    │
│  │   Plano base: [Mensal €70 ▼]            │    │
│  │   Percentual: [30]%                     │    │
│  │   = €21.00 por aula                     │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  [Cancelar]                    [Salvar Coach]   │
└─────────────────────────────────────────────────┘
```

---

## 17. Regras de Negócio

### 17.1 Acesso e Membros

| ID | Regra |
|----|-------|
| RN01 | Telefone é único no sistema |
| RN02 | Email é único (se preenchido) |
| RN03 | Membro tem no máximo 1 acesso ativo |
| RN04 | Subscription não usa créditos |
| RN05 | Credits expiram em 90 dias |
| RN06 | Daily Pass expira às 23:59 do dia |
| RN07 | Check-in MEMBER só se status = ATIVO |
| RN08 | Check-in MEMBER deduz 1 crédito (se CREDITS) |
| RN09 | Renovação estende a partir de HOJE |
| RN10 | Compra de créditos SOMA aos existentes |
| RN11 | Capacidade de aula é soft limit |
| RN12 | QR code é gerado no cadastro e é fixo |
| RN13 | QR code é único (formato MBR-XXXXXXXX) |
| RN14 | Check-in principal é via scan de QR |
| RN15 | Busca por nome/telefone é fallback |

### 17.2 Check-in Universal

| ID | Regra |
|----|-------|
| CK01 | Todo mundo que entra passa pelo sistema |
| CK02 | Check-in tem tipo: MEMBER ou GUEST |
| CK03 | GUEST requer rental ativo no horário |
| CK04 | GUEST incrementa guest_count do rental |
| CK05 | Rental em área `is_exclusive` bloqueia check-in de MEMBER |

### 17.3 Áreas e Capacidade

| ID | Regra |
|----|-------|
| AR01 | Cada área tem capacidade máxima de PTs simultâneos |
| AR02 | Rental só é criado se área tem slot disponível |
| AR03 | Disponibilidade = capacidade - rentals sobrepostos no horário |
| AR04 | Área com `is_exclusive = true` bloqueia MEMBERS quando ocupada |
| AR05 | Áreas são configuráveis pelo Admin |

### 17.4 Sublocação

| ID | Regra |
|----|-------|
| SB01 | Coach externo tem fee_type: FIXED ou PERCENTAGE |
| SB02 | FIXED: valor em centavos definido no cadastro |
| SB03 | PERCENTAGE: calculado sobre plan_base_id |
| SB04 | Rental copia fee_type e calcula valor no momento da criação |
| SB05 | Rental requer área com disponibilidade |
| SB06 | Guest não é membro, não consome crédito |
| SB07 | Rental recorrente cria N rentals com mesmo series_id |
| SB08 | Cancelamento ≥24h antecedência gera crédito |
| SB09 | Cancelamento <24h não gera crédito |
| SB10 | Crédito de coach expira em 90 dias |
| SB11 | Crédito é usado automaticamente em novos rentals |
| SB12 | Cancelar série cancela apenas rentals FUTUROS |

### 17.5 Financeiro

| ID | Regra |
|----|-------|
| FN01 | Toda transação tem tipo (RECEITA/DESPESA) |
| FN02 | Toda transação tem categoria obrigatória |
| FN03 | Pagamento e ativação são atômicos |
| FN04 | Transações são imutáveis (estorno cria nova) |
| FN05 | Caixa só contabiliza DINHEIRO |
| FN06 | Caixa fecha diariamente |
| FN07 | Diferença de caixa é registrada, não corrigida |
| FN08 | Apenas Admin registra despesas |

---

## 18. Fora do Escopo

### Não Construir (MVP)

**Operacional:**
- ❌ Coach IA
- ❌ Gamificação
- ❌ Penalidade por no-show
- ❌ Reserva obrigatória de aula para membros
- ❌ Lista de espera
- ❌ Notificações push
- ❌ App mobile nativo

**Financeiro:**
- ❌ Contabilidade fiscal
- ❌ DRE formal
- ❌ Integração bancária
- ❌ Parcelamento
- ❌ Conciliação automática
- ❌ Faturação eletrônica

---

## 19. Stack Técnica

### 19.1 Visão Geral

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 14 (App Router) + Tailwind |
| Backend | Next.js API Routes + Server Actions |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Hosting | Vercel + Supabase |
| Camera | Browser API (getUserMedia) |

### 19.2 Arquitetura: Site Único

Um único site Next.js serve todas as interfaces:

```
boxemaster.app
│
├── /login                    ← Login único (redireciona por role)
│
├── /owner                    ← OWNER (role: OWNER)
│   ├── /dashboard            ← Visão financeira
│   ├── /billing              ← Cobranças
│   ├── /reports              ← Relatórios
│   └── /audit                ← Auditoria
│
├── /admin                    ← Admin (role: ADMIN)
│   ├── /dashboard            ← Visão geral
│   ├── /members              ← CRUD membros
│   ├── /members/[id]         ← Detalhe/editar membro
│   ├── /plans                ← CRUD planos
│   ├── /coaches              ← CRUD coaches externos
│   ├── /areas                ← CRUD áreas
│   ├── /rentals              ← Gerenciar rentals
│   ├── /rentals/new          ← Criar rental/série
│   ├── /finances             ← Transações, despesas
│   ├── /finances/caixa       ← Controle de caixa
│   ├── /finances/verify      ← Verificar pagamentos (IBAN)
│   ├── /billing              ← Cobranças
│   ├── /reports              ← Relatórios
│   └── /audit                ← Auditoria
│
├── /staff                    ← Recepção (role: STAFF)
│   ├── /checkin              ← Scanner QR + busca manual
│   ├── /guests               ← Check-in de guests
│   ├── /members/new          ← Cadastro rápido
│   ├── /payment              ← Receber pagamento
│   └── /caixa                ← Abertura/fechamento
│
├── /partner                  ← Coach externo (role: PARTNER)
│   ├── /dashboard            ← Resumo
│   ├── /rentals              ← Meus rentals
│   ├── /rentals/[id]         ← Detalhe/cancelar
│   ├── /credits              ← Meus créditos
│   └── /history              ← Histórico
│
├── /m/[qr_code]              ← QR do membro (PÚBLICO)
│   └── ex: /m/MBR-A1B2C3D4   ← Mostra QR na tela
│
└── /api                      ← API Routes
    ├── /auth/*               ← Supabase Auth handlers
    ├── /members/*            ← CRUD members
    ├── /checkin              ← POST check-in
    ├── /rentals/*            ← CRUD rentals
    ├── /transactions/*       ← Financeiro
    ├── /payments/*           ← Pagamentos pendentes
    ├── /audit/*              ← Logs de auditoria
    └── /reports/*            ← Queries relatórios
```

### 19.3 Autenticação e Roles

**Roles no Supabase:**

```sql
-- Adicionar role ao usuário (na tabela staff)
CREATE TABLE staff (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id), -- link com Supabase Auth
    nome            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'STAFF', 'PARTNER')),
    coach_id        UUID REFERENCES external_coaches(id), -- só se PARTNER
    ativo           BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);
```

**Middleware de proteção (Next.js):**

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  
  const path = req.nextUrl.pathname
  
  // Rotas públicas
  if (path.startsWith('/m/') || path === '/login') {
    return res
  }
  
  // Sem sessão → login
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  // Buscar role do usuário
  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', session.user.id)
    .single()
  
  const role = staff?.role
  
  // Verificar permissão por rota
  if (path.startsWith('/owner') && role !== 'OWNER') {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  if (path.startsWith('/admin') && !['OWNER', 'ADMIN'].includes(role)) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  if (path.startsWith('/staff') && !['OWNER', 'ADMIN', 'STAFF'].includes(role)) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  if (path.startsWith('/partner') && !['OWNER', 'ADMIN', 'PARTNER'].includes(role)) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
```

**Redirecionamento pós-login:**

```typescript
// app/login/page.tsx
async function handleLogin() {
  // ... login com Supabase
  
  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .single()
  
  switch (staff.role) {
    case 'OWNER':
      redirect('/owner/dashboard')
    case 'ADMIN':
      redirect('/admin/dashboard')
    case 'STAFF':
      redirect('/staff/checkin')
    case 'PARTNER':
      redirect('/partner/dashboard')
  }
}
```

### 19.4 Página do QR (Pública)

```typescript
// app/m/[qr_code]/page.tsx
import QRCode from 'qrcode.react'

export default async function MemberQRPage({ params }) {
  const { qr_code } = params
  
  // Buscar membro (só nome, sem dados sensíveis)
  const { data: member } = await supabase
    .from('members')
    .select('nome, qr_code')
    .eq('qr_code', qr_code)
    .single()
  
  if (!member) {
    return <div>QR inválido</div>
  }
  
  const qrUrl = `${process.env.NEXT_PUBLIC_URL}/m/${qr_code}`
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-xl font-bold mb-2">BoxeMaster</h1>
      <p className="text-lg mb-6">{member.nome}</p>
      
      <div className="bg-white p-4 rounded-xl shadow-lg">
        <QRCode value={qrUrl} size={250} />
      </div>
      
      <p className="mt-4 text-gray-500 text-sm">
        Mostre este QR na recepção
      </p>
      
      <button className="mt-6 text-blue-600">
        Adicionar ao Wallet
      </button>
    </div>
  )
}
```

### 19.5 Scanner de QR (Recepção)

```typescript
// app/staff/checkin/page.tsx
'use client'
import { useState } from 'react'
import { QrReader } from 'react-qr-reader'

export default function CheckinPage() {
  const [result, setResult] = useState(null)
  const [scanning, setScanning] = useState(false)
  
  async function handleScan(data) {
    if (!data) return
    
    // Extrair código do QR (URL ou código direto)
    const qrCode = data.includes('/m/') 
      ? data.split('/m/')[1] 
      : data
    
    // Chamar API de check-in
    const res = await fetch('/api/checkin', {
      method: 'POST',
      body: JSON.stringify({ qr_code: qrCode })
    })
    
    const result = await res.json()
    setResult(result)
    setScanning(false)
  }
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Check-in</h1>
      
      {scanning ? (
        <div className="max-w-sm mx-auto">
          <QrReader
            onResult={handleScan}
            constraints={{ facingMode: 'environment' }}
          />
          <button onClick={() => setScanning(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <button 
          onClick={() => setScanning(true)}
          className="w-full p-4 bg-blue-600 text-white rounded-lg"
        >
          📷 Escanear QR
        </button>
      )}
      
      {/* Fallback: busca manual */}
      <div className="mt-4">
        <input 
          placeholder="Buscar por nome ou telefone"
          className="w-full p-3 border rounded"
        />
      </div>
      
      {/* Resultado */}
      {result && (
        <div className={`mt-4 p-4 rounded-lg ${
          result.result === 'ALLOWED' 
            ? 'bg-green-100' 
            : 'bg-red-100'
        }`}>
          {result.result === 'ALLOWED' ? (
            <>
              <p className="text-xl">✅ LIBERADO</p>
              <p>{result.member.nome}</p>
            </>
          ) : (
            <>
              <p className="text-xl">❌ BLOQUEADO</p>
              <p>{result.message}</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

### 19.6 Estrutura de Pastas

```
boxemaster/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   │
│   ├── owner/
│   │   ├── layout.tsx          ← Layout read-only
│   │   ├── dashboard/
│   │   ├── billing/            ← Cobranças
│   │   ├── reports/
│   │   └── audit/
│   │
│   ├── admin/
│   │   ├── layout.tsx          ← Sidebar admin
│   │   ├── dashboard/
│   │   ├── members/
│   │   ├── plans/
│   │   ├── coaches/
│   │   ├── areas/
│   │   ├── rentals/
│   │   ├── finances/
│   │   │   ├── page.tsx        ← Transações
│   │   │   ├── caixa/
│   │   │   └── verify/         ← Verificar pagamentos
│   │   ├── billing/            ← Cobranças
│   │   ├── reports/
│   │   └── audit/
│   │
│   ├── staff/
│   │   ├── layout.tsx          ← Layout tablet-first
│   │   ├── checkin/
│   │   ├── guests/
│   │   ├── payment/
│   │   └── caixa/
│   │
│   ├── partner/
│   │   ├── layout.tsx          ← Layout mobile-first
│   │   ├── dashboard/
│   │   ├── rentals/
│   │   ├── credits/
│   │   └── history/
│   │
│   ├── m/
│   │   └── [qr_code]/
│   │       └── page.tsx        ← QR público
│   │
│   ├── api/
│   │   ├── auth/
│   │   ├── checkin/
│   │   ├── members/
│   │   ├── rentals/
│   │   ├── transactions/
│   │   ├── payments/           ← Pagamentos pendentes
│   │   ├── audit/              ← Logs
│   │   ├── notifications/      ← WhatsApp
│   │   └── cron/               ← Jobs automáticos
│   │       ├── block-expired/
│   │       ├── send-reminders/
│   │       └── cancel-inactive/
│   │
│   ├── layout.tsx
│   └── page.tsx                ← Redirect para /login
│
├── components/
│   ├── ui/                     ← Botões, inputs, cards
│   ├── owner/                  ← Componentes owner
│   ├── admin/                  ← Componentes admin
│   ├── staff/                  ← Componentes recepção
│   └── partner/                ← Componentes partner
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── admin.ts
│   ├── audit.ts                ← Helper de auditoria
│   ├── checkin.ts              ← Lógica de check-in
│   ├── payments.ts             ← Lógica de pagamentos
│   ├── rentals.ts              ← Lógica de rentals
│   ├── notifications.ts        ← WhatsApp
│   └── utils.ts
│
├── types/
│   └── index.ts                ← TypeScript types
│
├── middleware.ts               ← Proteção de rotas
├── tailwind.config.js
└── package.json
```

### 19.7 PWA (Opcional)

Para transformar em app instalável:

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development'
})

module.exports = withPWA({
  // config
})
```

```json
// public/manifest.json
{
  "name": "BoxeMaster Pro",
  "short_name": "BoxeMaster",
  "start_url": "/login",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1e40af",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Resultado:**
- Staff instala no tablet → ícone na home
- Partner instala no celular → acesso rápido
- Funciona offline (básico) com service worker

### 19.8 Responsividade por Contexto

| Interface | Device Principal | Approach |
|-----------|------------------|----------|
| `/admin/*` | Desktop | Desktop-first |
| `/staff/*` | Tablet | Tablet-first (touch-friendly) |
| `/partner/*` | Mobile | Mobile-first |
| `/m/*` | Mobile | Mobile-only |

```css
/* Exemplo: Staff (tablet-first) */
.checkin-button {
  @apply w-full p-6 text-xl; /* Grande para touch */
}

/* Exemplo: Admin (desktop-first) */
.data-table {
  @apply hidden md:table; /* Tabela só em desktop */
}
```

---

## 20. Roadmap

### Fase 1 — Core (3 semanas)
- [ ] Setup (Supabase, Next.js, Auth)
- [ ] Schema completo do banco
- [ ] CRUD Membros
- [ ] CRUD Planos
- [ ] Check-in MEMBER com validação
- [ ] Tela de recepção (tablet)

### Fase 2 — Financeiro (2 semanas)
- [ ] Registro de pagamento + ativação
- [ ] Registro de despesas
- [ ] Controle de caixa
- [ ] Dashboard financeiro

### Fase 3 — Sublocação (2 semanas)
- [ ] CRUD Áreas com capacidade
- [ ] CRUD Coaches Externos (fee FIXED / PERCENTAGE)
- [ ] Verificação de disponibilidade
- [ ] CRUD Rentals com área
- [ ] Check-in GUEST
- [ ] Bloqueio por área exclusiva

### Fase 4 — Operação (1 semana)
- [ ] Agenda de aulas (visual)
- [ ] Relatórios completos
- [ ] Alertas
- [ ] Dashboard de ocupação

### Fase 5 — Escala (opcional)
- [ ] Pagamentos online (Stripe)
- [ ] Portal do membro
- [ ] QR code individual
- [ ] Export CSV

---

## 21. Prompt para IA

```
Construa o sistema BoxeMaster Pro seguindo esta especificação completa v1.7.

ARQUITETURA:
- Next.js 14 (App Router)
- Supabase (Postgres + Auth)
- Tailwind CSS
- TypeScript
- Site ÚNICO com rotas por role:
  - /owner/* → OWNER (investidor, só visibilidade)
  - /admin/* → ADMIN (sócio operacional, tudo)
  - /staff/* → STAFF (recepção, tablet)
  - /partner/* → PARTNER (coach externo, mobile)
  - /m/[qr] → PÚBLICO (QR do membro)
- Middleware protege rotas por role
- PWA opcional para instalar como app

ROLES:
- OWNER: Dashboard financeiro, cobranças, auditoria (não opera)
- ADMIN: Tudo (opera e vê financeiro) — todas ações são auditadas
- STAFF: Check-in, cadastro, pagamentos
- PARTNER: Portal próprio (rentals, créditos)

PRINCÍPIOS:
- Access-first: check-in é o centro
- Check-in UNIVERSAL: MEMBER e GUEST passam pelo sistema
- MEMBER faz check-in via QR code (câmera do tablet/celular)
- GUEST continua manual (seleciona rental, digita nome)
- Zero hardware extra: só câmera do dispositivo
- Subscription padrão, créditos são exceção
- Pagamento e ativação são atômicos
- Fluxo de caixa, não contabilidade
- Áreas têm CAPACIDADE de PTs simultâneos
- Sublocação: fee FIXED ou PERCENTAGE por coach
- GUEST não é membro, só registra presença
- Área EXCLUSIVE bloqueia membros durante rental
- Rentals podem ser RECORRENTES (série semanal)
- Cancelamento ≥24h gera CRÉDITO, <24h perdeu
- Créditos de coach expiram em 90 dias

PAGAMENTOS:
- Métodos: Dinheiro, Cartão, MBway, Transferência (Stripe fase 2)
- IBAN-first: identifica pagamentos pelo IBAN do membro
- Membro pode ter múltiplos IBANs (pessoal, empresa)
- Pagamentos pendentes com verificação diária
- Não identificados: atribuir manualmente
- Bloqueio automático ao expirar
- Cancelamento após 30 dias bloqueado

COBRANÇAS:
- Dashboard: atrasados, vencem hoje, próximos 7 dias
- Resumo do mês: esperado vs recebido
- Ações: enviar lembrete, marcar pago, ligar

NOTIFICAÇÕES (WhatsApp):
- 3 dias antes: lembrete de vencimento
- No dia: aviso urgente
- 1 dia depois: expirou
- 3 dias depois: bloqueado

AUDITORIA:
- Toda ação de ADMIN/STAFF é logada
- OWNER vê log completo
- Alertas imediatos: estorno, diferença de caixa
- Relatório diário: despesas altas, alterações

ORDEM DE DESENVOLVIMENTO:
1. Setup Next.js + Supabase + Auth
2. Schema do banco (copiar SQL desta spec)
3. Middleware de proteção por role
4. Layout base para cada área (/owner, /admin, /staff, /partner)
5. Página pública do QR (/m/[qr])
6. Tela de check-in com scanner (/staff/checkin)
7. CRUD membros com IBAN (/admin/members)
8. Sistema de pagamentos pendentes
9. Verificação de extrato (/admin/finances/verify)
10. Dashboard de cobranças
11. Auditoria
12. Notificações automáticas (cron jobs)
13. CRUD áreas e coaches
14. CRUD rentals com recorrência
15. Portal do partner
16. Dashboard OWNER
17. Relatórios

NÃO INTRODUZA:
- Apps nativos separados
- Hardware especial (catraca, biometria)
- Reservas obrigatórias para membros
- Penalidades
- Coach IA
- Integração bancária automática (MVP é manual)
- Tracking individual de alunos de coach externo
- Lógica além do especificado

COMECE AGORA.
```

---

## Changelog

| Versão | Data | Mudanças |
|--------|------|----------|
| v1.0 | Jan 2026 | Versão inicial |
| v1.1 | Jan 2026 | Simplificação access-first + financeiro |
| v1.2 | Jan 2026 | Check-in universal, fee FIXED/PERCENTAGE |
| v1.3 | Jan 2026 | Áreas com capacidade, controle de disponibilidade |
| v1.4 | Jan 2026 | Rentals recorrentes, política de cancelamento com créditos |
| v1.5 | Jan 2026 | QR code para membros, check-in via câmera |
| v1.6 | Jan 2026 | Arquitetura site único, rotas por role, estrutura Next.js |
| v1.7 | Jan 2026 | Role OWNER, pagamentos IBAN, cobranças, auditoria, notificações automáticas |

---

*BoxeMaster Pro Complete Spec v1.7 — Janeiro 2026*
