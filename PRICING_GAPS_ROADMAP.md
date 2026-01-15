# Pricing Engine - Gaps & Roadmap

> Documento de memoria para implementacao de gaps no sistema de pricing.
> Criado: 2026-01-14

---

## Status Atual

| Componente | Status | Notas |
|------------|--------|-------|
| Pricing Engine (base) | ✅ Completo | Formula funciona |
| E2E Tests | ✅ 40/40 passando | `--workers=1` |
| Unit Tests | ✅ 35 testes | `pricing-engine.test.ts` |
| Fixed Discount | ✅ CORRIGIDO | 2026-01-14 |
| Auto-Renewal | ✅ IMPLEMENTADO | 2026-01-15 |
| Freeze/Pause | ✅ IMPLEMENTADO | 2026-01-15 |

---

## Gaps Identificados

### Workarounds (NAO implementar)

| Cenario | Solucao com Features Existentes |
|---------|--------------------------------|
| Descontos familiares | Cupom `FAMILIA20` |
| Periodos de teste | Plano "Trial 7 dias" com EUR 0 |
| Precos sazonais | Cupom `VERAO2026` com valid_from/until |
| Reembolsos | DESPESA categoria "REEMBOLSO" |

### Gaps REAIS (implementar)

| # | Gap | Prioridade | Complexidade |
|---|-----|------------|--------------|
| 1 | Fixed discount type BUG | CRITICO | Baixa |
| 2 | Auto-renovacao | Alta | Media |
| 3 | Pausar subscription | Alta | Media |
| 4 | Upgrade/downgrade | Media | Alta |

---

## Gap 1: Fixed Discount Type BUG

### Problema
```typescript
// src/lib/pricing-engine.ts
// Codigo atual SO processa percentage, ignora fixed
const discountAmount = discount.discount_type === 'percentage'
  ? Math.round(subtotal * (discount.discount_value / 100))
  : 0;  // <- FIXED NUNCA E CALCULADO!
```

### Solucao
```typescript
const discountAmount = discount.discount_type === 'percentage'
  ? Math.round(subtotal * (discount.discount_value / 100))
  : discount.discount_value;  // <- discount_value JA E em cents
```

### Ficheiros
- `src/lib/pricing-engine.ts` - Fix calculo
- `src/hooks/usePricing.ts` - Verificar propagacao

### Testes
- [ ] Unit test: `calculatePrice()` com discount_type='fixed'
- [ ] E2E: Criar promo fixed EUR 10, aplicar, verificar

---

## Gap 2: Auto-Renovacao

### Migration
```sql
ALTER TABLE subscriptions ADD COLUMN
  auto_renew BOOLEAN DEFAULT false,
  renewal_reminder_sent_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE members ADD COLUMN
  preferred_payment_method VARCHAR(20);
```

### Edge Function (Cron)
```
supabase/functions/subscription-renewal/index.ts
- Runs daily at 00:05
- Find expiring in 7 days -> send reminder
- Find expired today -> create renewal
```

### UI Changes
- [ ] Enrollment: Checkbox "Renovacao automatica"
- [ ] Member profile: Toggle auto-renew
- [ ] Admin: Lista de renovacoes pendentes

---

## Gap 3: Pausar Subscription (Freeze)

### Migration
```sql
ALTER TABLE subscriptions ADD COLUMN
  frozen_at DATE,
  frozen_until DATE,
  freeze_reason TEXT,
  original_expires_at DATE;
```

### Business Rules
1. Maximo 30 dias de pausa por ano
2. Minimo 7 dias de antecedencia
3. Pausa estende `expires_at` automaticamente
4. Membro NAO pode fazer check-in durante pausa
5. Staff pode pausar imediatamente (override)

### Check-in Integration
```typescript
// src/hooks/useCheckin.ts
if (member.status === 'PAUSADO') {
  return {
    allowed: false,
    reason: 'FROZEN',
    message: `Subscricao pausada ate ${format(sub.frozen_until, 'dd/MM/yyyy')}`
  };
}
```

### UI Changes
- [ ] Member profile: Botao "Pausar Subscricao"
- [ ] Dialog: Data + motivo
- [ ] Check-in: Mostrar "PAUSADO"

---

## Gap 4: Upgrade/Downgrade (Fase 2)

### Conceito
Proration quando membro muda de plano mid-cycle.

```
Exemplo:
- Plano atual: EUR 60/mes, 15 dias restantes
- Novo plano: EUR 90/mes
- Credito: EUR 60 x (15/30) = EUR 30
- Debito: EUR 90 x (15/30) = EUR 45
- Diferenca: EUR 15
```

**Decisao:** Adiar para Fase 2.

---

## Plano de Testes

### Estrutura
```
tests/
  unit/
    pricing-engine.test.ts      # Calculos puros
    discount-validation.test.ts # Validacao de codigos
    renewal.test.ts             # Logica de renovacao
    freeze.test.ts              # Logica de pausa
e2e/
  pricing/
    fixed-discount.spec.ts      # Gap 1
    auto-renewal.spec.ts        # Gap 2
    freeze.spec.ts              # Gap 3
```

### Matriz de Cobertura

| Area | Unit | E2E | Status |
|------|------|-----|--------|
| Pricing Engine | 0% | 40 tests | Precisa unit |
| Fixed Discount | - | - | Gap 1 |
| Auto-Renewal | - | - | Gap 2 |
| Freeze | - | - | Gap 3 |
| Check-in | 84% | - | Adicionar freeze |

---

## Ordem de Implementacao

### Sprint 1: Bug Fix + Foundation
1. **Gap 1**: Fix fixed discount (1 dia)
2. Unit tests para pricing engine (1 dia)

### Sprint 2: Auto-Renewal
3. **Gap 2**: Auto-renewal (3-5 dias)
   - Migration
   - Edge function
   - UI checkbox

### Sprint 3: Freeze
4. **Gap 3**: Freeze subscription (3-5 dias)
   - Migration
   - Check-in integration
   - UI components

### Sprint 4: Polish
5. Upgrade/downgrade (se tempo)
6. Referral credits funcionais
7. Credits pricing

---

## Checklist

### Gap 1: Fixed Discount
- [x] Fix `src/lib/pricing-engine.ts`
- [x] Unit test (35 tests)
- [x] E2E test (8 tests)
- [x] Verificar admin UI

### Gap 2: Auto-Renewal
- [x] Migration (`20260115010000_add_auto_renewal.sql`)
- [x] Edge function (updated `scheduled-jobs`)
- [ ] Cron schedule (requires Supabase cron setup)
- [x] UI Enrollment (checkbox in both Plan and Custom tabs)
- [ ] UI Member profile (toggle)
- [ ] E2E tests

### Gap 3: Freeze Subscription
- [ ] Migration
- [ ] Status PAUSADO
- [ ] Freeze/unfreeze logic
- [ ] Check-in validation
- [ ] UI Freeze button
- [ ] E2E tests

---

## Referencias

- `spec.md` - Seccao 22 (Pricing Engine)
- `e2e/pricing/*.spec.ts` - Testes existentes
- `src/lib/pricing-engine.ts` - Formula de calculo
- `src/hooks/usePricing.ts` - Hook principal
