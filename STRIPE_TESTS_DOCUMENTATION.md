# Stripe Integration Tests - Documentation

**Data:** 2026-02-17
**Contexto:** Sessão de desenvolvimento de testes de integração Stripe com API real

---

## Resumo Executivo

Esta sessão focou em criar testes de integração que usam a **API REAL do Stripe** (não mocks/fabricados). Os testes criam objectos reais no Stripe (Customers, Subscriptions, Invoices) e esperam por webhooks reais para verificar que o sistema funciona end-to-end.

### Problema Inicial
Os testes anteriores usavam webhooks "fabricados" - criavam o payload manualmente e enviavam para o endpoint. O utilizador pediu explicitamente: **"quero tudo real"**.

### Solução Implementada
1. Testes criam objectos REAIS no Stripe via API
2. Webhooks são enviados pelo próprio Stripe (não fabricados)
3. Testes esperam até 30 segundos pelo webhook chegar e processar

---

## Problema Crítico Encontrado e Resolvido

### Sintoma
Webhooks não chegavam ao endpoint. 336 deliveries falhadas no Stripe Dashboard.

### Causa Raiz
**Mismatch no STRIPE_WEBHOOK_SECRET:**
- `.env` local tinha: `whsec_ac484394dead88...`
- Stripe Dashboard tinha: `whsec_VpJYMO4ZiIj4u9crQRdXUBpiKmfu7Rgn`
- Supabase Edge Function também tinha o secret errado

### Solução
1. Actualizado `.env` com o secret correcto do Stripe Dashboard
2. Actualizado Supabase Edge Function secrets via Dashboard
3. Criado script `scripts/reset-webhook-secret.ts` para evitar este problema no futuro

---

## Ficheiros Criados/Modificados

### Testes de Integração

| Ficheiro | Descrição |
|----------|-----------|
| `src/tests/integration/stripe-enrollment-flow.test.ts` | Testes com API REAL do Stripe - cria customers, subscriptions, espera webhooks |
| `src/tests/integration/e2e-enrollment-checkin.test.ts` | E2E: LEAD → Stripe → Webhook → ATIVO → Check-in |
| `src/tests/integration/offline-payment.test.ts` | E2E: Pagamento DINHEIRO sem Stripe |

### Helpers e Fixtures

| Ficheiro | Descrição |
|----------|-----------|
| `src/tests/fixtures/stripe-helpers.ts` | Funções para criar objectos REAIS no Stripe |
| `src/tests/fixtures/setup.ts` | Helper functions: `createTestMember()`, `cleanupTestMember()`, `getTestSupabaseClient()` |

### Scripts de Gestão

| Ficheiro | Descrição |
|----------|-----------|
| `scripts/setup-stripe-webhook.ts` | Configura webhook endpoint via API (16 eventos) |
| `scripts/test-webhook-delivery.ts` | Diagnóstico de problemas com webhooks |
| `scripts/reset-webhook-secret.ts` | Deleta e recria webhook para obter novo secret |
| `scripts/deploy-edge-functions.sh` | Deploy automático de todas Edge Functions |

---

## Como Correr os Testes

### Testes Stripe (API Real)
```bash
npm run test:integration -- stripe-enrollment-flow.test.ts
```

**O que faz:**
1. Cria membro LEAD na base de dados
2. Cria Customer REAL no Stripe com `member_id` nos metadata
3. Cria Subscription REAL no Stripe
4. Stripe gera Invoice e cobra automaticamente (test mode)
5. Stripe envia webhook `invoice.paid` para nosso endpoint
6. Webhook activa membro (LEAD → ATIVO)
7. Teste verifica que membro ficou ATIVO

**Tempo:** ~50 segundos (inclui espera por webhooks)

### Testes E2E Completos
```bash
npm run test:integration -- e2e-enrollment-checkin.test.ts
```

**O que testa:**
- Fluxo completo de enrollment com weekly_limit
- Verificação de transactions criadas
- Check-ins respeitam limite semanal

### Testes Offline (DINHEIRO)
```bash
npm run test:integration -- offline-payment.test.ts
```

**O que testa:**
- LEAD → pagamento DINHEIRO → ATIVO
- BLOQUEADO → renovação sem taxa de matrícula
- Transactions criadas correctamente

---

## Funções Principais em stripe-helpers.ts

### `createRealStripeCustomer()`
```typescript
export async function createRealStripeCustomer(
  memberId: string,
  email: string,
  name?: string,
  supabaseClient?: SupabaseClient
): Promise<Stripe.Customer>
```
- Cria Customer REAL no Stripe
- Guarda `member_id` nos metadata
- **CRÍTICO:** Actualiza `members.stripe_customer_id` na base de dados (necessário para webhook encontrar o membro)

### `createTestPaymentMethod()`
```typescript
export async function createTestPaymentMethod(customerId: string): Promise<Stripe.PaymentMethod>
```
- Cria PaymentMethod usando token `tok_visa` (cartão de teste)
- Anexa ao customer e define como default

### `createRealSubscription()`
```typescript
export async function createRealSubscription(
  customerId: string,
  priceId: string,
  memberId: string
): Promise<Stripe.Subscription>
```
- Cria PaymentMethod automaticamente
- Cria Subscription REAL
- Stripe gera Invoice e cobra imediatamente
- Webhook `invoice.paid` é enviado automaticamente

### `findAnyActivePrice()`
```typescript
export async function findAnyActivePrice(): Promise<string | null>
```
- Lista preços activos no Stripe
- Filtra por `access_type === 'SUBSCRIPTION'` nos metadata
- Retorna o primeiro preço válido

### `cleanupStripeCustomer()`
```typescript
export async function cleanupStripeCustomer(customerId: string): Promise<void>
```
- Cancela todas subscriptions do customer
- Deleta o customer do Stripe
- Usado no cleanup dos testes

---

## Configuração de Webhooks

### Eventos Habilitados (16 total)
```
checkout.session.completed
checkout.session.expired
invoice.paid
invoice.payment_failed
invoice.payment_succeeded
invoice.finalized
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.paused
customer.subscription.resumed
customer.created
customer.updated
customer.deleted
payment_intent.succeeded
payment_intent.payment_failed
```

### Verificar Configuração
```bash
npx tsx scripts/setup-stripe-webhook.ts --list
```

### Reconfigurar Webhook
```bash
npx tsx scripts/setup-stripe-webhook.ts
```

### Resetar Secret (se necessário)
```bash
npx tsx scripts/reset-webhook-secret.ts
```
**Nota:** Após resetar, actualizar o secret em:
1. `.env` (actualizado automaticamente pelo script)
2. Supabase Dashboard → Edge Function secrets (manual)

---

## Diagnóstico de Problemas

### Webhooks não chegam
```bash
npx tsx scripts/test-webhook-delivery.ts
```

**Output esperado se tudo OK:**
```
📋 Last 5 entries in stripe_events table:
   invoice.paid (evt_xxx)
   customer.subscription.created (evt_xxx)
   ...
```

**Output se há problema:**
```
⚠️ NO EVENTS FOUND IN DATABASE
This means webhooks are NOT being processed!
```

### Causas comuns:
1. **STRIPE_WEBHOOK_SECRET mismatch** - verificar `.env` vs Stripe Dashboard
2. **Edge Function não deployed** - correr `./scripts/deploy-edge-functions.sh`
3. **Edge Function crashing** - ver logs: `supabase functions logs stripe-webhook`

---

## Variáveis de Ambiente Necessárias

### .env (local)
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

### Supabase Edge Function Secrets
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # DEVE ser igual ao .env!
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Fluxo de Dados (Teste Real)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Teste     │     │   Stripe    │     │  Supabase   │
│  (vitest)   │     │    API      │     │   DB/Edge   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ 1. Create Member  │                   │
       │───────────────────┼──────────────────>│
       │                   │                   │
       │ 2. Create Customer│                   │
       │──────────────────>│                   │
       │                   │                   │
       │ 3. Update member.stripe_customer_id   │
       │───────────────────┼──────────────────>│
       │                   │                   │
       │ 4. Create Subscription                │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ 5. Webhook: invoice.paid
       │                   │──────────────────>│
       │                   │                   │
       │                   │      6. Activate member
       │                   │      (LEAD → ATIVO)
       │                   │                   │
       │ 7. Poll until status=ATIVO            │
       │<──────────────────┼───────────────────│
       │                   │                   │
       │ 8. Assert & Cleanup                   │
       │                   │                   │
```

---

## Notas Importantes

### Tempo de Espera por Webhooks
Os testes esperam até **30 segundos** pelo webhook chegar. Em ambiente de teste Stripe, os webhooks são enviados quase instantaneamente (~1-2 segundos), mas o timeout de segurança é maior.

### Cleanup Automático
Todos os testes fazem cleanup:
- Customers criados no Stripe são deletados
- Members criados na DB são deletados
- Subscriptions são canceladas antes de deletar customer

### Preços no Stripe
Os testes usam preços que já existem no Stripe Dashboard. O helper `findAnyActivePrice()` procura por preços com `access_type: 'SUBSCRIPTION'` nos metadata.

### Schema da Base de Dados
- `check_ins.checked_in_by` (não `created_by`)
- `transactions.created_by` (não `checked_in_by`)
- `members.stripe_customer_id` - CRÍTICO para webhook encontrar membro

---

## Resultados dos Testes (2026-02-17)

```
✓ stripe-enrollment-flow.test.ts     8 passed (47.89s)
✓ e2e-enrollment-checkin.test.ts     2 passed (19.89s)
✓ offline-payment.test.ts            2 passed (3.93s)
```

**Total:** 12 testes passados

---

## Próximos Passos (Para Outro Agente)

1. **Deploy Edge Functions** (se ainda não feito):
   ```bash
   supabase login
   ./scripts/deploy-edge-functions.sh
   ```

2. **FASE 1 do Plano** - Adicionar metadata aos Payment Links no Stripe Dashboard:
   - Ver `STRIPE_IMPLEMENTATION_PLAN.md` para lista completa

3. **Testes de weekly_limit** - O Price usado nos testes não tem `weekly_limit` nos metadata, então o teste de limite não é completamente exercitado. Criar Price com `weekly_limit: 2` no Stripe Dashboard para testar completamente.

---

## Referências

- `STRIPE_IMPLEMENTATION_PLAN.md` - Plano completo de implementação
- `CLAUDE.md` - Documentação técnica do projecto
- `spec.md` - Especificação original do sistema
