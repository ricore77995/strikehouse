# BoxeMaster Pricing Engine - Spec v1.1

## Visao Geral

Sistema de precificacao para academias de luta com modelo por modalidade, descontos por periodo de contrato e cupons promocionais.

---

## Arquitetura

```
PricingConfig (parametros globais)
  |
Plan (templates prontos)
  |
Subscription (instancia do aluno com preco calculado)
  |
Discount (aplicado na subscription)
  |
Transaction (pagamentos)
```

---

## Formula

```
P = (B + (M-1) x E) x (1 - Dp) x (1 - D)
```

| Variavel | Descricao | Tipo |
|----------|-----------|------|
| `P` | Preco final mensal | output |
| `B` | Preco base (1a modalidade) | config ou override |
| `E` | Preco modalidade extra | config ou override |
| `M` | Quantidade de modalidades | input |
| `Dp` | Desconto periodo (commitment) | calculado |
| `D` | Desconto promocional (promo) | input |

**Resolucao de valores:**

```
B = Plan.pricing_override.base_price_cents ?? PricingConfig.base_price_cents
E = Plan.pricing_override.extra_modality_price_cents ?? PricingConfig.extra_modality_price_cents
```

---

## Entidades

### 1. PricingConfig

Parametros globais da academia. Um registro por academia.

```typescript
interface PricingConfig {
  id: string;
  base_price_cents: number;           // Default: 6000 (60 EUR)
  extra_modality_price_cents: number; // Default: 3000 (30 EUR)
  single_class_price_cents: number;   // Default: 1500 (15 EUR)
  day_pass_price_cents: number;       // Default: 2500 (25 EUR)
  enrollment_fee_cents: number;       // Default: 1500 (15 EUR)
  currency: string;                   // Default: 'EUR'
  updated_at: string;
}
```

---

### 2. Plan

Templates de planos.

```typescript
interface Plan {
  id: string;
  nome: string;
  tipo: 'SUBSCRIPTION' | 'CREDITS' | 'DAILY_PASS';
  modalities: string[];              // UUID array
  commitment_months: number;
  duracao_dias: number | null;
  creditos: number | null;
  pricing_override: {
    base_price_cents?: number | null;
    extra_modality_price_cents?: number | null;
    enrollment_fee_cents?: number | null;
  };
  visible: boolean;
  ativo: boolean;
}
```

**Tipos:**

| tipo | Descricao | Validacao de acesso |
|------|-----------|---------------------|
| `SUBSCRIPTION` | Acesso ilimitado por X dias | `expires_at >= hoje` |
| `CREDITS` | Paga por aula | `credits_remaining > 0` |
| `DAILY_PASS` | Valido so no dia | Expira as 23:59:59 |

---

### 3. Subscription

Instancia do plano para cada aluno. **Nova tabela.**

```typescript
interface Subscription {
  id: string;
  member_id: string;
  plan_id: string | null;

  modalities: string[];
  commitment_months: number;

  // Pricing snapshot (imutavel)
  calculated_price_cents: number;     // Preco antes descontos
  commitment_discount_pct: number;
  promo_discount_pct: number;
  final_price_cents: number;          // Preco final
  enrollment_fee_cents: number;

  starts_at: string;
  expires_at: string | null;
  credits_remaining: number | null;
  status: 'active' | 'expired' | 'cancelled';

  commitment_discount_id: string | null;
  promo_discount_id: string | null;
}
```

**Por que snapshot?**

- Precos podem mudar, mas o aluno paga o que contratou
- Historico auditavel de condicoes comerciais
- Descontos expiram, mas subscription mantem o valor

---

### 4. Discount

Entidade unica para todos os descontos.

```typescript
interface Discount {
  id: string;
  code: string;
  nome: string;
  category: 'commitment' | 'promo';
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_commitment_months: number | null;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  current_uses: number;
  new_members_only: boolean;
  referrer_credit_cents: number | null;
  ativo: boolean;
}
```

**Categorias:**

| category | Comportamento |
|----------|---------------|
| `commitment` | Auto-aplica pelo periodo escolhido |
| `promo` | Requer codigo no checkout |

---

### 5. Modality

Modalidades disponiveis.

```typescript
interface Modality {
  id: string;
  code: string;      // 'boxe', 'muay_thai', etc.
  nome: string;
  description: string | null;
  sort_order: number;
  ativo: boolean;
}
```

**Default modalities:**
- boxe, muay_thai, jiu_jitsu, mma, kickboxing, wrestling, funcional

---

## Dados Padrao

### PricingConfig

```json
{
  "base_price_cents": 6000,
  "extra_modality_price_cents": 3000,
  "single_class_price_cents": 1500,
  "day_pass_price_cents": 2500,
  "enrollment_fee_cents": 1500,
  "currency": "EUR"
}
```

### Discounts (commitment)

| code | category | discount_value | min_commitment_months |
|------|----------|----------------|----------------------|
| MENSAL | commitment | 0 | 1 |
| TRIMESTRAL | commitment | 10 | 3 |
| SEMESTRAL | commitment | 15 | 6 |
| ANUAL | commitment | 20 | 12 |

---

## Fluxo de Checkout

```
INPUT:
  - modalities[]: array de modalidade ids
  - commitment_months: int
  - discount_code: string (opcional)
  - member_id: uuid

PROCESS:

1. Buscar PricingConfig

2. Resolver valores
   B = Plan.pricing_override.base_price_cents ?? PricingConfig.base_price_cents
   E = Plan.pricing_override.extra_modality_price_cents ?? PricingConfig.extra_modality_price_cents

3. Calcular base
   M = modalities.length
   Bruto = B + (M-1) x E

4. Buscar Dp (commitment)
   Dp = MAX(discount_value)
        WHERE category = "commitment"
        AND min_commitment_months <= commitment_months
        AND ativo = true

5. Buscar D (promo)
   IF discount_code:
     D = discount_value WHERE code = discount_code AND ativo AND valid
     IF NOT FOUND: return error "Codigo invalido"
   ELSE:
     D = 0

6. Calcular preco
   P = Bruto x (1 - Dp/100) x (1 - D/100)

7. Criar Subscription
   {
     member_id,
     modalities,
     commitment_months,
     calculated_price_cents: Bruto,
     commitment_discount_pct: Dp,
     promo_discount_pct: D,
     final_price_cents: P,
     enrollment_fee_cents: (member.status == "LEAD" ? fee : 0),
     starts_at: today,
     expires_at: today + duration_days,
     status: "active"
   }

8. Atualizar Member
   member.current_subscription_id = subscription.id
   member.status = "ATIVO"

9. Criar Transaction
   {
     member_id,
     amount_cents: P + enrollment_fee_cents,
     type: "RECEITA",
     category: "SUBSCRIPTION"
   }

OUTPUT:
  - subscription: Subscription criada
  - breakdown: { base, extras, discounts, enrollment_fee, total }
```

---

## Exemplo de Calculo

```
PricingConfig: B = 6000, E = 3000

Input:
  modalities: ["muay_thai", "jiu_jitsu"]
  commitment_months: 6
  discount_code: "UNI15"
  member.status: "LEAD"

Calculo:
  M = 2
  Bruto = 6000 + (2-1) x 3000 = 9000 cents
  Dp = 15 (SEMESTRAL: 6 >= 6)
  D = 15 (UNI15)

  P = 9000 x (1 - 0.15) x (1 - 0.15)
  P = 9000 x 0.85 x 0.85
  P = 6502.5 -> 6503 cents

Output:
{
  "subscription": {
    "calculated_price_cents": 9000,
    "commitment_discount_pct": 15,
    "promo_discount_pct": 15,
    "final_price_cents": 6503,
    "enrollment_fee_cents": 1500
  },
  "breakdown": {
    "base_cents": 6000,
    "extra_modalities_cents": 3000,
    "subtotal_cents": 9000,
    "commitment_discount_cents": -1350,
    "promo_discount_cents": -1147,
    "monthly_cents": 6503,
    "enrollment_fee_cents": 1500,
    "total_first_payment_cents": 8003
  }
}
```

---

## Regras de Negocio

1. Apenas 1 codigo promo por checkout
2. Desconto commitment sempre aplica automaticamente
3. Descontos promo nao acumulam entre si
4. Taxa de matricula so cobra para member.status = "LEAD"
5. Subscription armazena snapshot dos valores no momento da compra
6. Alteracoes em PricingConfig nao afetam subscriptions existentes

---

## Ficheiros Principais

| Ficheiro | Proposito |
|----------|-----------|
| `src/types/pricing.ts` | Interfaces TypeScript |
| `src/lib/pricing-engine.ts` | Funcao calculatePrice() |
| `src/hooks/usePricing.ts` | Hook React principal |
| `src/hooks/usePricingConfig.ts` | Config global |
| `src/hooks/useModalities.ts` | Lista modalidades |
| `src/hooks/useDiscounts.ts` | Lista e valida descontos |
| `src/pages/admin/PricingConfig.tsx` | UI config |
| `src/pages/admin/Discounts.tsx` | UI descontos |
| `src/pages/admin/Modalities.tsx` | UI modalidades |

---

## Database Schema

### modalities
```sql
CREATE TABLE modalities (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true
);
```

### pricing_config
```sql
CREATE TABLE pricing_config (
    id UUID PRIMARY KEY,
    base_price_cents INTEGER DEFAULT 6000,
    extra_modality_price_cents INTEGER DEFAULT 3000,
    enrollment_fee_cents INTEGER DEFAULT 1500,
    currency VARCHAR(3) DEFAULT 'EUR'
);
-- Singleton: CREATE UNIQUE INDEX ON pricing_config ((true));
```

### discounts
```sql
CREATE TABLE discounts (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    category VARCHAR(20) CHECK (IN ('commitment', 'promo')),
    discount_type VARCHAR(20) CHECK (IN ('percentage', 'fixed')),
    discount_value INTEGER NOT NULL,
    min_commitment_months INTEGER,
    valid_from DATE,
    valid_until DATE,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    new_members_only BOOLEAN DEFAULT false,
    ativo BOOLEAN DEFAULT true
);
```

### subscriptions
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    member_id UUID REFERENCES members(id),
    modalities UUID[] NOT NULL,
    commitment_months INTEGER NOT NULL,
    calculated_price_cents INTEGER NOT NULL,
    commitment_discount_pct INTEGER DEFAULT 0,
    promo_discount_pct INTEGER DEFAULT 0,
    final_price_cents INTEGER NOT NULL,
    enrollment_fee_cents INTEGER DEFAULT 0,
    starts_at DATE DEFAULT CURRENT_DATE,
    expires_at DATE,
    status VARCHAR(15) DEFAULT 'active'
);
```

### members (alteracao)
```sql
ALTER TABLE members ADD COLUMN current_subscription_id UUID REFERENCES subscriptions(id);
```

### plans (alteracao)
```sql
ALTER TABLE plans ADD COLUMN
    modalities UUID[] DEFAULT '{}',
    commitment_months INTEGER DEFAULT 1,
    pricing_override JSONB DEFAULT '{}',
    visible BOOLEAN DEFAULT true;
```
