# BoxeMaster Pro - Enrollment Fee System (Taxa de Matrícula)

**Data:** 11 de Janeiro de 2026
**Versão:** 1.0
**Status:** Pronto para implementação

---

## Resumo Executivo

Implementar sistema de taxa de matrícula (enrollment fee) cobrada na primeira assinatura de um membro LEAD, com:
- Taxa configurável por plano
- Override editável pelo staff no momento da matrícula
- Jornada separada para matrícula vs renovação
- Duas transações separadas (plano + taxa)

### Decisões do Usuário

1. ✅ **Taxa por plano**: Campo `enrollment_fee_cents` em cada plano
2. ✅ **Override editável**: Staff pode ajustar valor no momento da matrícula
3. ✅ **Detecção simples**: Cobrar taxa apenas se `member.status === 'LEAD'`
4. ✅ **Jornada separada**: Nova tela `/staff/enrollment` para LEADs
5. ✅ **Transações separadas**: Criar 2 registros (plano + taxa)

---

## Arquitetura da Solução

### Fluxo Atual vs Proposto

**ANTES:**
```
1. Staff cria membro (LEAD)
2. Staff vai para /staff/payment
3. Seleciona plano + método
4. Pagamento ativa membro (1 transação)
```

**DEPOIS:**
```
1. Staff cria membro (LEAD)
2. Staff vai para /staff/enrollment (nova página)
3. Seleciona plano + ajusta taxa de matrícula
4. Seleciona método de pagamento
5. Sistema cria 2 transações:
   - Transação 1: Plano (categoria = plan.tipo)
   - Transação 2: Taxa de matrícula (categoria = TAXA_MATRICULA)
6. Membro ativado
```

### Separação de Responsabilidades

| Página | Para quem | Cobra taxa? |
|--------|-----------|-------------|
| `/staff/enrollment` | Membros LEAD (primeira vez) | ✅ Sim |
| `/staff/payment` | Membros ATIVO/BLOQUEADO (renovação) | ❌ Não |

---

## Implementação Detalhada

### FASE 1: Database Migration

**Arquivo:** `supabase/migrations/20260111_add_enrollment_fee.sql`

```sql
-- Add enrollment_fee_cents to plans table
ALTER TABLE plans
ADD COLUMN enrollment_fee_cents INTEGER DEFAULT 0
CHECK (enrollment_fee_cents >= 0);

-- Add TAXA_MATRICULA category
INSERT INTO categories (code, nome, type)
VALUES ('TAXA_MATRICULA', 'Taxa de Matrícula', 'RECEITA');

-- Set default enrollment fees for existing plans (€25.00)
UPDATE plans
SET enrollment_fee_cents = 2500
WHERE ativo = true;

-- Documentation
COMMENT ON COLUMN plans.enrollment_fee_cents IS
'Enrollment fee in cents (charged once for LEAD -> ATIVO transition)';
```

**Testar:**
```bash
supabase db reset  # Apply migration
psql -d postgres -c "SELECT id, nome, preco_cents, enrollment_fee_cents FROM plans;"
psql -d postgres -c "SELECT * FROM categories WHERE code = 'TAXA_MATRICULA';"
```

---

### FASE 2: Update Plans Admin Interface

**Arquivo:** `src/pages/admin/Plans.tsx`

**Mudanças:**

1. **Update Plan interface** (linha ~45):
```typescript
interface Plan {
  id: string;
  nome: string;
  tipo: 'SUBSCRIPTION' | 'CREDITS' | 'DAILY_PASS';
  preco_cents: number;
  enrollment_fee_cents: number;  // ADD
  duracao_dias: number | null;
  creditos: number | null;
  ativo: boolean;
}
```

2. **Update schema** (linha ~30):
```typescript
const planSchema = z.object({
  nome: z.string().min(1).max(100),
  tipo: z.enum(['SUBSCRIPTION', 'CREDITS', 'DAILY_PASS']),
  preco_cents: z.number().min(1),
  enrollment_fee_cents: z.number().min(0),  // ADD
  duracao_dias: z.number().min(1).nullable(),
  creditos: z.number().min(1).nullable(),
});
```

3. **Add state** (após linha ~77):
```typescript
const [enrollmentFeeInput, setEnrollmentFeeInput] = useState('');
```

4. **Add form field** (após campo "Preço", antes de "Duração"):
```tsx
<div className="space-y-2">
  <Label htmlFor="enrollment_fee">Taxa de Matrícula (€)</Label>
  <Input
    id="enrollment_fee"
    type="number"
    step="0.01"
    min="0"
    value={enrollmentFeeInput}
    onChange={(e) => setEnrollmentFeeInput(e.target.value)}
    className="bg-secondary border-border"
    placeholder="0.00"
  />
  <p className="text-xs text-muted-foreground">
    Cobrada uma vez na primeira matrícula
  </p>
</div>
```

5. **Display in plan card** (após preço, dentro do CardContent):
```tsx
{plan.enrollment_fee_cents > 0 && (
  <div className="text-sm text-muted-foreground">
    + {formatCurrency(plan.enrollment_fee_cents)} matrícula
  </div>
)}
```

6. **Update mutations**: Incluir `enrollment_fee_cents` no INSERT/UPDATE

---

### FASE 3: Create Enrollment Page

**Arquivo:** `src/pages/staff/Enrollment.tsx` (NOVO)

**Características:**
- Busca apenas membros com `status = 'LEAD'`
- Mostra taxa de matrícula com campo editável
- Calcula total = plano + taxa ajustada
- Cria 2 transações em pagamentos instantâneos
- Para TRANSFERENCIA: cria pending_payment com referência `ENR-{timestamp}`

**Estrutura do formulário:**

```
[Step 1: Selecionar Membro LEAD] → Busca filtrada por status
[Step 2: Selecionar Plano] → Mostra preço + taxa padrão
[Step 3: Ajustar Taxa] → Input editável, pode zerar
[Step 4: Método Pagamento] → DINHEIRO/CARTAO/MBWAY/TRANSFERENCIA
[Resumo + Confirmar] → Total = plano + taxa ajustada
```

**Lógica de transações:**

```typescript
// Pagamento instantâneo (DINHEIRO, CARTAO, MBWAY)
if (isInstant) {
  // 1. Atualizar membro para ATIVO
  await supabase.from('members').update({
    status: 'ATIVO',
    access_type: selectedPlan.tipo,
    access_expires_at: newExpirationDate,
  }).eq('id', memberId);

  // 2. Transação do plano
  await supabase.from('transactions').insert({
    type: 'RECEITA',
    category: selectedPlan.tipo,  // SUBSCRIPTION, CREDITS, ou DAILY_PASS
    amount_cents: selectedPlan.preco_cents,
    payment_method: selectedMethod,
    member_id: memberId,
    description: `Plano: ${selectedPlan.nome}`,
    created_by: staffId,
  });

  // 3. Transação da taxa (se > 0)
  if (enrollmentFeeCents > 0) {
    await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: 'TAXA_MATRICULA',
      amount_cents: enrollmentFeeCents,
      payment_method: selectedMethod,
      member_id: memberId,
      description: `Taxa de Matrícula - ${selectedPlan.nome}`,
      created_by: staffId,
    });
  }
}

// Transferência (TRANSFERENCIA)
else {
  const totalAmount = selectedPlan.preco_cents + enrollmentFeeCents;
  await supabase.from('pending_payments').insert({
    member_id: memberId,
    plan_id: selectedPlan.id,
    amount_cents: totalAmount,  // Total
    payment_method: 'TRANSFERENCIA',
    reference: `ENR-${Date.now()}`,  // Prefix ENR-
    expires_at: addDays(new Date(), 7),
    created_by: staffId,
  });
}
```

**Ver implementação completa em:** Output do agente Plan (linhas 400-900)

---

### FASE 4: Update Payment Page

**Arquivo:** `src/pages/staff/Payment.tsx`

**Mudanças:**

1. **Add LEAD detection banner** (após seleção de membro):
```tsx
{selectedMember.status === 'LEAD' && (
  <Alert className="mt-3 border-yellow-500/50 bg-yellow-500/10">
    <AlertCircle className="h-4 w-4 text-yellow-500" />
    <AlertTitle className="text-sm font-medium">Novo Membro</AlertTitle>
    <AlertDescription className="text-xs">
      Este membro nunca foi ativado. Deseja matriculá-lo?
      <Button
        variant="link"
        className="h-auto p-0 ml-2 text-accent"
        onClick={() => navigate('/staff/enrollment', { state: { member: selectedMember } })}
      >
        Ir para Matrícula →
      </Button>
    </AlertDescription>
  </Alert>
)}
```

2. **Fix category bug** (linha 149):
```typescript
// ANTES (ERRADO):
category: 'MENSALIDADE',

// DEPOIS (CORRETO):
category: selectedPlan.tipo,  // Usa SUBSCRIPTION, CREDITS ou DAILY_PASS
```

---

### FASE 5: Update Pending Payments Confirmation

**Arquivo:** `src/pages/admin/PendingPayments.tsx`

**Adicionar detecção de matrícula** (linha ~138):
```typescript
const plan = payment.plan;
const isEnrollment = payment.reference.startsWith('ENR-');

let enrollmentFeeCents = 0;
if (isEnrollment && plan) {
  // Total = plano + taxa, então: taxa = total - plano
  enrollmentFeeCents = payment.amount_cents - plan.preco_cents;
}
```

**Criar transações separadas** (linha ~177):
```typescript
if (isEnrollment && plan) {
  // Transação 1: Plano
  await supabase.from('transactions').insert({
    type: 'RECEITA',
    category: plan.tipo,
    amount_cents: plan.preco_cents,
    payment_method: 'TRANSFERENCIA',
    member_id: memberId,
    description: `Plano: ${plan.nome} (Matrícula)`,
    created_by: staffId,
  });

  // Transação 2: Taxa (se > 0)
  if (enrollmentFeeCents > 0) {
    await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: 'TAXA_MATRICULA',
      amount_cents: enrollmentFeeCents,
      payment_method: 'TRANSFERENCIA',
      member_id: memberId,
      description: `Taxa de Matrícula - ${plan.nome}`,
      created_by: staffId,
    });
  }
} else {
  // Pagamento regular: 1 transação apenas
  await supabase.from('transactions').insert({...});
}
```

---

### FASE 6: Add Route and Navigation

**Arquivo:** `src/App.tsx`

Adicionar após rota `/staff/payment` (linha ~223):
```tsx
<Route
  path="/staff/enrollment"
  element={
    <ProtectedRoute allowedRoles={['OWNER', 'ADMIN', 'STAFF']}>
      <StaffEnrollment />
    </ProtectedRoute>
  }
/>
```

**Arquivo:** `src/components/layouts/DashboardLayout.tsx`

Adicionar após "Novo Membro" (linha ~58):
```typescript
{
  title: 'Matrícula',
  href: '/staff/enrollment',
  icon: UserPlus,
  roles: ['OWNER', 'ADMIN', 'STAFF'],
},
```

---

### FASE 7: Documentation Updates

#### Arquivo: `spec.md`

**Localização:** Após seção 8.4 "Pagamento de Plano" (linha ~867)

Adicionar nova seção:

```markdown
### 8.4.1 Taxa de Matrícula (Enrollment Fee)

**Regra de Negócio:** Membros LEAD (primeira assinatura) pagam taxa de matrícula uma única vez.

**Implementação:**
- Valor configurado em `plans.enrollment_fee_cents` (por plano)
- Staff pode ajustar no momento da matrícula
- Cria duas transações separadas:
  - Transação 1: Pagamento do plano (categoria: `plan.tipo`)
  - Transação 2: Taxa de matrícula (categoria: `TAXA_MATRICULA`)

**Fluxo de Matrícula:**
```javascript
// 1. Verificar se é primeira vez
const isFirstTime = member.status === 'LEAD';

// 2. Se primeira vez, usar /staff/enrollment
if (isFirstTime) {
  // Calcula total = plano + taxa (ajustável)
  const totalCents = plan.preco_cents + enrollmentFeeCents;

  // Cria 2 transações
  await createTransaction({
    category: plan.tipo,
    amount_cents: plan.preco_cents,
  });

  if (enrollmentFeeCents > 0) {
    await createTransaction({
      category: 'TAXA_MATRICULA',
      amount_cents: enrollmentFeeCents,
    });
  }
}
```

**Páginas:**
- `/staff/enrollment` - Matrícula de membros LEAD (cobra taxa)
- `/staff/payment` - Renovação de membros ATIVO/BLOQUEADO (sem taxa)

**Detecção:** `member.status === 'LEAD'` = nunca foi ATIVO
**Taxa Zero:** Permitido (isenção de taxa)
**Override:** Staff pode editar valor no formulário
```

#### Arquivo: `claude.md`

**Localização:** Após seção "Financial Transaction Model" (linha ~230)

Adicionar nova seção:

```markdown
## Enrollment Fee System (Taxa de Matrícula)

### Overview

First-time members (status: LEAD) pay a one-time enrollment fee when activating their first plan.

### Key Concepts

**When charged:**
- Only for members with `status === 'LEAD'` (never been ATIVO)
- Renewals (BLOQUEADO → ATIVO) do NOT charge enrollment fee

**Configuration:**
- Stored per plan: `plans.enrollment_fee_cents` (INTEGER)
- Can be zero (no enrollment fee for that plan)
- Staff can override amount at enrollment time

**Transaction Structure:**
Creates TWO separate transaction records:
1. Plan payment (category: plan.tipo - SUBSCRIPTION/CREDITS/DAILY_PASS)
2. Enrollment fee (category: 'TAXA_MATRICULA')

### Implementation Pattern

**Route separation:**
- `/staff/enrollment` - For LEAD members (first-time enrollment)
- `/staff/payment` - For ATIVO/BLOQUEADO members (renewals)

**Enrollment page features:**
- Searches only `status = 'LEAD'` members
- Shows plan price + enrollment fee (editable)
- Calculates total = plan + adjusted fee
- Creates 2 transactions on instant payment
- For TRANSFERENCIA: creates pending_payment with reference `ENR-{timestamp}`

**Example code:**

```typescript
// Check if first-time enrollment
const isFirstTime = member.status === 'LEAD';

// Enrollment flow (instant payment)
if (isFirstTime && isInstantPayment) {
  // 1. Update member to ATIVO
  await supabase.from('members').update({
    status: 'ATIVO',
    access_type: plan.tipo,
    access_expires_at: newDate,
  }).eq('id', memberId);

  // 2. Transaction: Plan payment
  await supabase.from('transactions').insert({
    type: 'RECEITA',
    category: plan.tipo,
    amount_cents: plan.preco_cents,
    payment_method: 'DINHEIRO',
    member_id: memberId,
    description: `Plano: ${plan.nome}`,
    created_by: staffId,
  });

  // 3. Transaction: Enrollment fee (if > 0)
  if (enrollmentFeeCents > 0) {
    await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: 'TAXA_MATRICULA',
      amount_cents: enrollmentFeeCents,
      payment_method: 'DINHEIRO',
      member_id: memberId,
      description: `Taxa de Matrícula - ${plan.nome}`,
      created_by: staffId,
    });
  }
}

// Enrollment via TRANSFERENCIA
else if (isFirstTime && method === 'TRANSFERENCIA') {
  const totalAmount = plan.preco_cents + enrollmentFeeCents;
  await supabase.from('pending_payments').insert({
    member_id: memberId,
    plan_id: plan.id,
    amount_cents: totalAmount,
    payment_method: 'TRANSFERENCIA',
    reference: `ENR-${Date.now()}`,  // ENR- prefix identifies enrollment
    expires_at: addDays(new Date(), 7),
    created_by: staffId,
  });
}
```

**Pending payment confirmation (Admin):**

When confirming a pending payment with reference `ENR-*`:

```typescript
const isEnrollment = payment.reference.startsWith('ENR-');

if (isEnrollment && plan) {
  // Split into 2 transactions
  const enrollmentFee = payment.amount_cents - plan.preco_cents;

  // Transaction 1: Plan
  await supabase.from('transactions').insert({
    category: plan.tipo,
    amount_cents: plan.preco_cents,
    ...
  });

  // Transaction 2: Fee (if > 0)
  if (enrollmentFee > 0) {
    await supabase.from('transactions').insert({
      category: 'TAXA_MATRICULA',
      amount_cents: enrollmentFee,
      ...
    });
  }
}
```

### Payment Page LEAD Detection

When staff selects a LEAD member in `/staff/payment`, show banner:

```tsx
{selectedMember.status === 'LEAD' && (
  <Alert className="border-yellow-500/50 bg-yellow-500/10">
    <AlertCircle className="h-4 w-4 text-yellow-500" />
    <AlertTitle>Novo Membro</AlertTitle>
    <AlertDescription>
      Este membro nunca foi ativado. Deseja matriculá-lo?
      <Button onClick={() => navigate('/staff/enrollment', { state: { member } })}>
        Ir para Matrícula →
      </Button>
    </AlertDescription>
  </Alert>
)}
```

### Database Schema

```sql
-- Add to plans table
ALTER TABLE plans ADD COLUMN enrollment_fee_cents INTEGER DEFAULT 0 CHECK (enrollment_fee_cents >= 0);

-- Add category
INSERT INTO categories (code, nome, type) VALUES ('TAXA_MATRICULA', 'Taxa de Matrícula', 'RECEITA');
```

### Common Patterns

```typescript
// Format enrollment fee for display
const formatEnrollmentFee = (cents: number) => {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
};

// Calculate total enrollment cost
const totalCost = plan.preco_cents + plan.enrollment_fee_cents;

// Check if member is eligible for enrollment
const canEnroll = member.status === 'LEAD';
```

### Reference

- Enrollment page: `src/pages/staff/Enrollment.tsx`
- Payment page: `src/pages/staff/Payment.tsx` (has LEAD detection banner)
- Plans admin: `src/pages/admin/Plans.tsx` (enrollment_fee field)
- Pending confirmations: `src/pages/admin/PendingPayments.tsx` (ENR- detection)
```

---

## Arquivos a Modificar

### Criar (Novos):
1. ✅ `supabase/migrations/20260111_add_enrollment_fee.sql`
2. ✅ `src/pages/staff/Enrollment.tsx` (~600 linhas)

### Modificar (Existentes):
3. ✅ `src/pages/admin/Plans.tsx` - Adicionar campo enrollment_fee
4. ✅ `src/pages/staff/Payment.tsx` - Banner LEAD + fix category bug
5. ✅ `src/pages/admin/PendingPayments.tsx` - Detectar ENR- e split transactions
6. ✅ `src/App.tsx` - Adicionar rota `/staff/enrollment`
7. ✅ `src/components/layouts/DashboardLayout.tsx` - Adicionar link "Matrícula"
8. ✅ `claude.md` - Documentar pattern
9. ✅ `spec.md` - Atualizar regras de negócio

---

## Plano de Testes

### 1. Plans Admin
- [ ] Criar plano com taxa €25
- [ ] Editar plano para taxa €15
- [ ] Zerar taxa (€0)
- [ ] Tentar taxa negativa (deve falhar)
- [ ] Ver taxa exibida no card

### 2. Enrollment Page - Pagamento Instantâneo
- [ ] Criar membro LEAD
- [ ] Buscar na enrollment page (deve achar)
- [ ] Buscar membro ATIVO (NÃO deve achar)
- [ ] Selecionar plano (taxa auto-popula)
- [ ] Ajustar taxa para €20
- [ ] Pagar com DINHEIRO
- [ ] Verificar success screen
- [ ] Database: 2 transações criadas (SUBSCRIPTION + TAXA_MATRICULA)
- [ ] Member.status = ATIVO

### 3. Enrollment Page - Transferência
- [ ] Criar membro LEAD
- [ ] Selecionar plano (€69) + taxa (€25)
- [ ] Pagar com TRANSFERENCIA
- [ ] Pending payment criado com amount_cents = 9400
- [ ] Reference = ENR-{timestamp}
- [ ] Admin confirma em /admin/finances/verify
- [ ] Database: 2 transações criadas
- [ ] Member.status = ATIVO

### 4. Payment Page - LEAD Detection
- [ ] Ir para /staff/payment
- [ ] Selecionar membro LEAD
- [ ] Banner amarelo aparece
- [ ] Clicar "Ir para Matrícula"
- [ ] Redireciona para /staff/enrollment

### 5. Payment Page - Category Fix
- [ ] Selecionar membro ATIVO
- [ ] Selecionar plano CREDITS
- [ ] Pagar
- [ ] Transaction.category = 'CREDITS' (não 'MENSALIDADE')

### 6. Edge Cases
- [ ] Taxa zero: Cria apenas 1 transação (plano)
- [ ] Override para €0: Cria apenas 1 transação
- [ ] Override para €500: Aceita (sem limite máximo)

---

## Verificação Pós-Implementação

```sql
-- Verificar coluna adicionada
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'plans' AND column_name = 'enrollment_fee_cents';

-- Verificar categoria
SELECT * FROM categories WHERE code = 'TAXA_MATRICULA';

-- Verificar transações de matrícula
SELECT t.*, m.nome, t.description
FROM transactions t
JOIN members m ON m.id = t.member_id
WHERE t.category = 'TAXA_MATRICULA'
ORDER BY t.created_at DESC
LIMIT 5;

-- Verificar pending payments de matrícula
SELECT *
FROM pending_payments
WHERE reference LIKE 'ENR-%'
ORDER BY created_at DESC;
```

---

## Rollback (Se Necessário)

```sql
BEGIN;

-- Remove category
DELETE FROM categories WHERE code = 'TAXA_MATRICULA';

-- Remove column
ALTER TABLE plans DROP COLUMN enrollment_fee_cents;

COMMIT;
```

**⚠️ Atenção:** Rollback falha se transações já usam categoria TAXA_MATRICULA.

---

**Última atualização:** 11 de Janeiro de 2026
**Estimativa de implementação:** 4-6 horas
