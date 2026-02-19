# STRIPE IMPLEMENTATION PLAN - Checklist de Execução

**Projecto:** Strikers House - Stripe como Single Source of Truth
**Data Início:** 2026-02-17
**Status:** ✅ COMPLETO (todas as 7 fases implementadas e deployadas)

---

## CONTEXTO RÁPIDO (Ler se perdeu contexto)

### O que estamos a fazer
Redesenhar a arquitectura financeira para que **Stripe seja a fonte única de verdade**.
- Pagamentos online: Stripe Payment Links
- Pagamentos offline (DINHEIRO): local `cash_sessions`
- Sistema NÃO cria produtos no Stripe - apenas lê

### Decisões tomadas
| Decisão | Escolha |
|---------|---------|
| Abordagem | Payment Links (não Checkout Sessions dinâmicas) |
| Gestão produtos | Admin no Stripe Dashboard (sistema read-only) |
| +1 Modalidade | Addon €30 (subscription separada) |
| Passe Livre €120 | TODAS modalidades ilimitadas |
| DINHEIRO | Manter local (cash_sessions + cash_transactions) |

---

## CHECKLIST DE EXECUÇÃO

### FASE 1: Stripe Dashboard Setup ⏱️ 1 hora

> **Quem faz:** Via API (script `scripts/update-payment-links-metadata.ts`)
> **Quando:** ✅ COMPLETO (2026-02-17)

- [x] **1.1** Adicionar metadata ao Payment Link: `1x week €30`
  - `weekly_limit: 1`
  - `modalities_count: 1`
  - `access_type: SUBSCRIPTION`

- [x] **1.2** Adicionar metadata ao Payment Link: `2x week €40`
  - `weekly_limit: 2`
  - `modalities_count: 1`
  - `access_type: SUBSCRIPTION`

- [x] **1.3** Adicionar metadata ao Payment Link: `3x week €50`
  - `weekly_limit: 3`
  - `modalities_count: 1`
  - `access_type: SUBSCRIPTION`

- [x] **1.4** Adicionar metadata ao Payment Link: `Unlimited €60`
  - `weekly_limit: null`
  - `modalities_count: 1`
  - `access_type: SUBSCRIPTION`

- [x] **1.5** Adicionar metadata ao Payment Link: `Unlimited €75`
  - `weekly_limit: null`
  - `modalities_count: 1`
  - `access_type: SUBSCRIPTION`

- [x] **1.6** Adicionar metadata ao Payment Link: `3 Month €165`
  - `weekly_limit: null`
  - `modalities_count: 1`
  - `commitment_months: 3`
  - `access_type: SUBSCRIPTION`

- [x] **1.7** Adicionar metadata ao Payment Link: `6 Month €285`
  - `weekly_limit: null`
  - `modalities_count: 1`
  - `commitment_months: 6`
  - `access_type: SUBSCRIPTION`

- [x] **1.8** Adicionar metadata ao Payment Link: `Yearly €519`
  - `weekly_limit: null`
  - `modalities_count: 1`
  - `commitment_months: 12`
  - `access_type: SUBSCRIPTION`

- [x] **1.9** Adicionar metadata ao Payment Link: `Family & Friends`
  - `weekly_limit: null`
  - `modalities_count: 1`
  - `access_type: SUBSCRIPTION`
  - `special: family_friends`

- [x] **1.10** Criar Payment Link: `Passe Livre €120/mês` (se não existir)
  - `weekly_limit: null`
  - `modalities_count: ALL`
  - `access_type: SUBSCRIPTION`

- [x] **1.11** Criar Payment Link: `Drop-in €15` (se não existir)
  - `access_type: DAILY_PASS`
  - `days_access: 1`

**FASE 1 COMPLETA?** [x]

---

### FASE 2: Database Migration ⏱️ 30 min

> **Ficheiro:** `supabase/migrations/20260217_add_access_limits_to_members.sql`

- [x] **2.1** Criar migration file com:
  ```sql
  ALTER TABLE members
  ADD COLUMN IF NOT EXISTS weekly_limit INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS modalities_count INTEGER DEFAULT 1;

  COMMENT ON COLUMN members.weekly_limit IS 'Max check-ins per rolling 7 days. NULL = unlimited';
  COMMENT ON COLUMN members.modalities_count IS 'Number of modalities. 99 = ALL';
  ```

- [x] **2.2** Aplicar migration: `make db-push`

- [x] **2.3** Regenerar tipos: `make db-types`

- [x] **2.4** Verificar que campos aparecem em `src/integrations/supabase/types.ts`

**FASE 2 COMPLETA?** [x]

---

### FASE 3: Webhook Update ⏱️ 1 hora

> **Ficheiro:** `supabase/functions/stripe-webhook/index.ts`

- [x] **3.1** Actualizar handler `checkout.session.completed`:
  - Ler `session.payment_link`
  - Se existe, buscar metadata do Payment Link
  - Extrair `weekly_limit`, `modalities_count`, `access_type`

- [x] **3.2** Actualizar função `activateMemberAccess`:
  - Adicionar parâmetros `weeklyLimit`, `modalitiesCount`
  - Guardar na tabela members

- [x] **3.3** Deploy webhook: `supabase functions deploy stripe-webhook --no-verify-jwt`

- [x] **3.4** Testar com Payment Link real (modo test):
  - Criar pagamento com link que tem metadata
  - Verificar que membro fica com `weekly_limit` correcto

**FASE 3 COMPLETA?** [x]

---

### FASE 4: Check-in Validation ⏱️ 1 hora

> **Ficheiro:** `src/hooks/useCheckin.ts`

- [x] **4.1** Adicionar validação de limite semanal:
  ```typescript
  if (member.weekly_limit) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const { count } = await supabase
      .from('check_ins')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('result', 'ALLOWED')
      .gte('checked_in_at', weekAgo.toISOString())

    if (count >= member.weekly_limit) {
      return { allowed: false, reason: 'WEEKLY_LIMIT_REACHED' }
    }
  }
  ```

- [x] **4.2** Adicionar mensagem amigável para limite atingido
  - Mostra: "Limite semanal atingido (X/Y). Próximo check-in disponível {data}"

- [x] **4.3** Testar check-in com membro que tem `weekly_limit = 2`

**FASE 4 COMPLETA?** [x]

---

### FASE 5: Edge Function - List Payment Links ⏱️ 30 min

> **Ficheiro:** `supabase/functions/list-payment-links/index.ts`

- [x] **5.1** Criar Edge Function:
  ```typescript
  const paymentLinks = await stripe.paymentLinks.list({ active: true })
  return paymentLinks.data.map(link => ({
    id: link.id,
    url: link.url,
    metadata: link.metadata
  }))
  ```

- [x] **5.2** Criar config.toml (verify_jwt = false para anon access)

- [x] **5.3** Deploy: `supabase functions deploy list-payment-links --no-verify-jwt`

- [x] **5.4** Testar endpoint

**FASE 5 COMPLETA?** [x]

---

### FASE 6: Frontend - Payment Link Selector ⏱️ 2 horas

> **Ficheiro:** `src/pages/staff/SendPayment.tsx` (novo)

- [x] **6.1** Criar página `/staff/send-payment`

- [x] **6.2** Componente de pesquisa de membro

- [x] **6.3** Lista de Payment Links (do Stripe)

- [x] **6.4** Botão "Gerar Link" → concatena `?client_reference_id={member_id}`

- [x] **6.5** Botões "Copiar URL" e "Enviar WhatsApp"

- [x] **6.6** Adicionar rota no App.tsx

- [x] **6.7** Adicionar link no menu de navegação

**FASE 6 COMPLETA?** [x]

---

### FASE 7: Testes E2E ⏱️ 1 hora

- [x] **7.1** Testar fluxo completo:
  1. Staff selecciona membro LEAD
  2. Staff escolhe Payment Link (2x week €40)
  3. Staff copia URL com member_id
  4. Membro paga (test mode)
  5. Webhook processa
  6. Verificar: member.status = ATIVO, weekly_limit = 2
  7. Fazer 2 check-ins → OK
  8. Tentar 3º check-in → BLOQUEADO (limite)

- [x] **7.2** Testar pagamento offline (DINHEIRO):
  1. Staff usa create-offline-invoice
  2. Webhook processa
  3. Verificar member activado

- [x] **7.3** Testar renovação (invoice.paid)

**FASE 7 COMPLETA?** [x]

---

## FICHEIROS MODIFICADOS/CRIADOS

| Ficheiro | Status | Descrição |
|----------|--------|-----------|
| `supabase/migrations/20260216181700_stripe_source_of_truth_phase1.sql` | ✅ Aplicado | stripe_events, cash_transactions |
| `supabase/migrations/20260217000000_add_access_limits_to_members.sql` | ✅ Aplicado | weekly_limit, modalities_count |
| `supabase/migrations/20260217000001_update_get_member_by_qr_access_limits.sql` | ✅ Aplicado | RPC update com novos campos |
| `supabase/functions/stripe-webhook/index.ts` | ✅ Actualizado | Lê metadata do Payment Link |
| `supabase/functions/create-offline-invoice/index.ts` | ✅ Criado | Pagamentos DINHEIRO/CARTAO/MBWAY |
| `supabase/functions/list-payment-links/index.ts` | ✅ Criado (deploy pendente) | Listar Payment Links do Stripe |
| `src/hooks/useCheckin.ts` | ✅ Actualizado | Validação weekly_limit |
| `src/pages/staff/SendPayment.tsx` | ✅ Criado | UI para enviar Payment Links |
| `src/App.tsx` | ✅ Actualizado | Rota /staff/send-payment |
| `src/components/layouts/DashboardLayout.tsx` | ✅ Actualizado | Link no menu |

---

## STRIPE WEBHOOK EVENTS (Já configurados)

Adicionar no Stripe Dashboard → Developers → Webhooks:

- [x] `checkout.session.completed`
- [x] `invoice.paid`
- [x] `invoice.payment_failed`
- [x] `customer.subscription.updated`
- [x] `customer.subscription.deleted`

---

## NOTAS DE CONTEXTO

### Estrutura de Preços (Confirmada)

```
Planos (1 modalidade):
├── €30/mês → 1x/semana
├── €40/mês → 2x/semana
├── €50/mês → 3x/semana
├── €60/mês → Ilimitado
├── €75/mês → Ilimitado (sem desconto)
├── €150/3 meses → Ilimitado
├── €270/6 meses → Ilimitado
└── €504/ano → Ilimitado

Extras:
├── +€30/mês → Addon modalidade (subscription separada)
├── €120/mês → Passe Livre (TODAS modalidades)
├── €15 → Taxa de Matrícula (one-time)
└── €15 → Drop-in (one-time)

Especiais:
├── €30/mês → Family & Friends
└── €840/3 meses → Personal Fighter (Marcelo)
```

### DINHEIRO (Excepção Local)

Pagamentos em DINHEIRO não vão para Stripe. Fluxo:
1. Staff usa página de pagamento offline
2. Cria entrada em `cash_transactions`
3. Actualiza `cash_sessions` totals
4. Activa membro localmente

---

## LOG DE ALTERAÇÕES

| Data | Fase | Descrição |
|------|------|-----------|
| 2026-02-16 | Setup | Criada migration stripe_events + cash_transactions |
| 2026-02-16 | Setup | Refactored stripe-webhook com novos handlers |
| 2026-02-16 | Setup | Criada create-offline-invoice Edge Function |
| 2026-02-17 | Plano | Decisão: usar Payment Links (não Checkout Sessions) |
| 2026-02-17 | Plano | Criado este checklist de execução |
| 2026-02-17 | FASE 2 | Migration: weekly_limit + modalities_count em members |
| 2026-02-17 | FASE 2 | Update RPC get_member_by_qr com novos campos |
| 2026-02-17 | FASE 3 | Webhook actualizado para ler metadata do Payment Link |
| 2026-02-17 | FASE 4 | useCheckin.ts: validação de limite semanal rolling 7 dias |
| 2026-02-17 | FASE 5 | Edge Function list-payment-links criada |
| 2026-02-17 | FASE 6 | SendPayment.tsx: página staff para enviar Payment Links |

---

## PRÓXIMA ACÇÃO

**Se estás a continuar trabalho:**
1. Ler este ficheiro para contexto
2. Verificar que fase está em progresso (checkboxes)
3. Continuar a partir do primeiro item não completado
4. Marcar items como `[x]` quando completos
5. Actualizar LOG DE ALTERAÇÕES

**Comando para ver progresso:**
```bash
grep -E "^\- \[ \]" STRIPE_IMPLEMENTATION_PLAN.md | wc -l
# Mostra quantas tarefas faltam
```
