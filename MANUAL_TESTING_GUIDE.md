# 🧪 Manual Testing Guide - Stripe Integration

**Objetivo:** Testar todos os fluxos de pagamento após simplificação para DINHEIRO + STRIPE

**Pré-requisitos:**
- ✅ Backend deployado (Edge Functions rodando)
- ✅ Frontend rodando localmente (`make dev`)
- ✅ Conta de teste no Stripe configurada
- ✅ Webhook configurado no Stripe Dashboard
- ✅ Usuário STAFF criado e autenticado

---

## 🔧 Setup Inicial

### 1. Iniciar servidor local
```bash
cd /Users/ricore/.claude-worktrees/strikehouse/heuristic-shannon
make dev
```

✅ **Esperado:** Servidor rodando em `http://localhost:8080`

### 2. Login como STAFF
```
URL: http://localhost:8080/login
Credenciais: [seu usuário STAFF]
```

✅ **Esperado:** Redireciona para `/staff/checkin`

### 3. Verificar Stripe Test Mode
```
Stripe Dashboard → Developers → Webhooks
```

✅ **Esperado:**
- Webhook endpoint ativo: `https://[projeto].supabase.co/functions/v1/stripe-webhook`
- Event: `checkout.session.completed`
- Status: ✅ Enabled

---

## 📋 Test Suite

---

## **TEST 1: DINHEIRO - Enrollment (LEAD → ATIVO)**

### Objetivo
Testar matrícula de novo membro com pagamento em dinheiro (fluxo existente).

### Pré-condições
- Membro com status `LEAD` existe no sistema
- Planos visíveis configurados
- Cash session aberta (se necessário)

### Passos

#### 1.1 Navegar para página de matrícula
```
URL: http://localhost:8080/staff/enrollment
```

✅ **Esperado:** Página carrega com 3 steps (Member, Pricing, Payment)

#### 1.2 Selecionar membro LEAD
- Digitar nome/telefone na busca
- Clicar no membro LEAD na lista

✅ **Esperado:**
- Card do membro aparece
- Badge: 🟡 "LEAD" ou "Aguardando Primeiro Pagamento"
- Botão "Próximo" habilitado

#### 1.3 Configurar pricing (Mode: Plan)
- Tab "Planos" selecionada
- Selecionar um plano (ex: "Plano 3x/semana")

✅ **Esperado:**
- Card do plano selecionado com check verde
- Resumo mostra:
  - Preço base do plano
  - Taxa de matrícula (se > 0)
  - Total calculado
- Botão "Próximo" habilitado

#### 1.4 Selecionar método de pagamento: DINHEIRO
- Clicar em "💵 Dinheiro (Pagamento Imediato)"

✅ **Esperado:**
- Card DINHEIRO com borda verde
- Resumo final mostra total
- Botão "Confirmar Matrícula" visível

#### 1.5 Confirmar matrícula
- Clicar "Confirmar Matrícula"

✅ **Esperado:**
- Loading spinner aparece brevemente
- Tela de sucesso aparece:
  - ✅ "Matrícula Confirmada!"
  - Nome do membro
  - Valor pago
  - Mensagem: "[Nome] agora tem acesso ao ginásio"
- Botões: "Ir para Check-in" e "Nova Matrícula"

#### 1.6 Verificar no banco de dados
Abrir Supabase Dashboard → Table Editor

**Tabela `members`:**
```sql
SELECT id, nome, status, access_type, access_expires_at, current_subscription_id
FROM members
WHERE id = '[member_id]';
```

✅ **Esperado:**
- `status` = `'ATIVO'`
- `access_type` = `'SUBSCRIPTION'`
- `access_expires_at` = data futura (hoje + duracao_dias do plano)
- `current_subscription_id` = UUID válido

**Tabela `subscriptions`:**
```sql
SELECT * FROM subscriptions
WHERE member_id = '[member_id]'
ORDER BY created_at DESC
LIMIT 1;
```

✅ **Esperado:**
- `status` = `'active'`
- `enrollment_fee_cents` = valor da taxa (ex: 3000 = €30)
- `final_price_cents` = preço do plano
- `starts_at` = hoje
- `expires_at` = data futura

**Tabela `transactions`:**
```sql
SELECT * FROM transactions
WHERE member_id = '[member_id]'
ORDER BY created_at DESC
LIMIT 2;
```

✅ **Esperado:** 2 transactions criadas:
1. **Transaction 1 (Plano):**
   - `type` = `'RECEITA'`
   - `category` = plano.tipo (ex: `'SUBSCRIPTION'`)
   - `amount_cents` = preço do plano
   - `payment_method` = `'DINHEIRO'`
   - `description` = "Plano: [nome do plano]"

2. **Transaction 2 (Taxa de Matrícula):**
   - `type` = `'RECEITA'`
   - `category` = `'TAXA_MATRICULA'`
   - `amount_cents` = taxa de matrícula
   - `payment_method` = `'DINHEIRO'`
   - `description` = "Taxa de Matrícula - [nome do plano]"

**Tabela `cash_sessions` (se aplicável):**
```sql
SELECT * FROM cash_sessions
WHERE session_date = CURRENT_DATE;
```

✅ **Esperado:**
- `total_cash_in_cents` incrementado com (plano + taxa)

### Resultado Final
- ✅ Membro LEAD → ATIVO
- ✅ 2 transactions criadas
- ✅ Subscription criada
- ✅ Cash session atualizado
- ✅ UI mostra sucesso

---

## **TEST 2: STRIPE - Enrollment (LEAD → ATIVO via Webhook)**

### Objetivo
Testar matrícula de novo membro com pagamento via Stripe Checkout.

### Pré-condições
- Membro com status `LEAD` existe
- Edge Functions deployadas e funcionando
- Stripe webhook configurado

### Passos

#### 2.1 Navegar para página de matrícula
```
URL: http://localhost:8080/staff/enrollment
```

#### 2.2 Selecionar membro LEAD
- Buscar e selecionar membro LEAD
- Clicar "Próximo"

#### 2.3 Configurar pricing
- Selecionar um plano (ex: "Plano 3x/semana + Muay Thai + TRIMESTRAL")
- Clicar "Próximo"

✅ **Esperado:** Resumo mostra total com taxa de matrícula

#### 2.4 Selecionar método de pagamento: STRIPE
- Clicar em "💳 Cartão (Stripe Checkout)"

✅ **Esperado:**
- Card STRIPE com borda verde
- Info banner azul aparece:
  ```
  ℹ️ Checkout Seguro
  Você será redirecionado para o Stripe para completar o pagamento com segurança.
  O membro será ativado automaticamente após confirmação.
  ```
- Botão muda para "Ir para Pagamento"

#### 2.5 Clicar "Ir para Pagamento"

✅ **Esperado:**
- Console mostra: "Creating Stripe checkout session for enrollment: {...}"
- Página redireciona para Stripe Checkout (domínio: `checkout.stripe.com`)

#### 2.6 Completar pagamento no Stripe Checkout
Na página do Stripe:
- **Email:** qualquer email válido (ex: test@example.com)
- **Número do cartão:** `4242 4242 4242 4242` (cartão de teste)
- **Expiração:** qualquer data futura (ex: 12/34)
- **CVC:** qualquer 3 dígitos (ex: 123)
- **Nome:** qualquer nome
- Clicar "Pay"

✅ **Esperado:**
- Loading spinner no Stripe
- Mensagem: "Payment successful" ou similar
- Redireciona de volta para: `http://localhost:8080/staff/enrollment-success?session_id=cs_test_...`

#### 2.7 Verificar página de sucesso

✅ **Esperado:**
- Card verde com:
  ```
  ✅ Pagamento Confirmado!

  O pagamento foi processado com sucesso. O membro será ativado automaticamente
  em alguns segundos.

  Session ID: cs_test_a1b2c3d4...
  ```
- Info banner azul:
  ```
  ℹ️ Ativação Automática
  O webhook do Stripe está processando o pagamento. O membro será ativado
  automaticamente e receberá acesso ao ginásio em até 30 segundos.
  ```
- Botões: "Ir para Check-in" e "Nova Matrícula"

#### 2.8 Aguardar processamento do webhook
- Aguardar 3-10 segundos

#### 2.9 Verificar logs do webhook (Supabase Dashboard)
```
Edge Functions → stripe-webhook → Logs
```

✅ **Esperado:**
- Log mostra: "Received checkout.session.completed event"
- Log mostra: "Processing enrollment for session cs_test_..."
- Log mostra: "Member activated successfully"
- Sem erros

#### 2.10 Verificar no banco de dados

**Tabela `webhook_events` (idempotência):**
```sql
SELECT * FROM webhook_events
WHERE stripe_event_id = '[event_id]';
```

✅ **Esperado:**
- 1 registro com `processed = true`
- `created_at` = timestamp recente

**Tabela `members`:**
```sql
SELECT status, access_type, access_expires_at
FROM members
WHERE id = '[member_id]';
```

✅ **Esperado:**
- `status` = `'ATIVO'`
- `access_type` = `'SUBSCRIPTION'`
- `access_expires_at` = data futura

**Tabela `subscriptions`:**
```sql
SELECT * FROM subscriptions
WHERE member_id = '[member_id]'
ORDER BY created_at DESC
LIMIT 1;
```

✅ **Esperado:**
- `stripe_checkout_session_id` = `'cs_test_...'` (session ID do Stripe)
- `enrollment_fee_cents` > 0
- `final_price_cents` = preço total
- `status` = `'active'`

**Tabela `transactions`:**
```sql
SELECT * FROM transactions
WHERE member_id = '[member_id]'
ORDER BY created_at DESC
LIMIT 2;
```

✅ **Esperado:** 2 transactions:
1. Plano: `payment_method = 'STRIPE'`, `amount_cents = final_price_cents`
2. Taxa: `payment_method = 'STRIPE'`, `amount_cents = enrollment_fee_cents`

### Resultado Final
- ✅ Redirect para Stripe funcionou
- ✅ Pagamento processado
- ✅ Webhook ativou membro automaticamente
- ✅ 2 transactions criadas
- ✅ Session ID registrado
- ✅ Idempotência garantida (webhook_events)

---

## **TEST 3: STRIPE - Checkout Cancelado**

### Objetivo
Testar comportamento quando usuário cancela checkout do Stripe.

### Passos

#### 3.1 Iniciar fluxo de matrícula
- Seguir passos 2.1 a 2.5 (até redirecionar para Stripe)

#### 3.2 Cancelar checkout
Na página do Stripe Checkout:
- Clicar no botão "← Back" (canto superior esquerdo)

✅ **Esperado:**
- Redireciona para: `http://localhost:8080/staff/enrollment-success?cancelled=true`

#### 3.3 Verificar página de cancelamento

✅ **Esperado:**
- Card amarelo/laranja com:
  ```
  ⬅ Pagamento Cancelado

  O checkout foi cancelado. Nenhum pagamento foi processado.
  ```
- Botões: "Ir para Check-in" e "Tentar Novamente"

#### 3.4 Verificar banco de dados

**Tabela `members`:**
```sql
SELECT status FROM members WHERE id = '[member_id]';
```

✅ **Esperado:**
- `status` = `'LEAD'` (não mudou)

**Tabela `transactions`:**
```sql
SELECT COUNT(*) FROM transactions
WHERE member_id = '[member_id]'
AND created_at > NOW() - INTERVAL '5 minutes';
```

✅ **Esperado:**
- `COUNT = 0` (nenhuma transaction criada)

### Resultado Final
- ✅ Cancelamento detectado
- ✅ Membro continua LEAD
- ✅ Nenhuma cobrança efetuada

---

## **TEST 4: DINHEIRO - Renewal (ATIVO/BLOQUEADO → ATIVO)**

### Objetivo
Testar renovação de membro existente com dinheiro.

### Pré-condições
- Membro com status `ATIVO` ou `BLOQUEADO` existe

### Passos

#### 4.1 Navegar para página de pagamento
```
URL: http://localhost:8080/staff/payment
```

✅ **Esperado:** Página carrega com busca de membros

#### 4.2 Buscar e selecionar membro ATIVO/BLOQUEADO
- Digitar nome/telefone
- Clicar no membro

✅ **Esperado:**
- Card do membro aparece
- Badge: 🟢 "ATIVO" ou 🔴 "BLOQUEADO"
- Subscription atual mostrada (se existir)

#### 4.3 Selecionar plano
- Clicar em um plano disponível

✅ **Esperado:**
- Plano selecionado com check
- Resumo mostra preço (SEM taxa de matrícula)

#### 4.4 Selecionar DINHEIRO
- Clicar "💵 Dinheiro (Pagamento Imediato)"

#### 4.5 Confirmar pagamento
- Clicar "Confirmar Pagamento"

✅ **Esperado:**
- Tela de sucesso
- Mensagem: "Pagamento confirmado! Membro ativado."

#### 4.6 Verificar banco de dados

**Tabela `members`:**
```sql
SELECT status, access_expires_at, current_subscription_id
FROM members
WHERE id = '[member_id]';
```

✅ **Esperado:**
- `status` = `'ATIVO'`
- `access_expires_at` = **extendido** (se já tinha acesso válido, soma duração)
- `current_subscription_id` = novo UUID

**Tabela `subscriptions`:**
```sql
SELECT * FROM subscriptions
WHERE member_id = '[member_id]'
ORDER BY created_at DESC
LIMIT 1;
```

✅ **Esperado:**
- `enrollment_fee_cents` = `0` (sem taxa para renovação)
- `status` = `'active'`

**Tabela `transactions`:**
```sql
SELECT * FROM transactions
WHERE member_id = '[member_id]'
ORDER BY created_at DESC
LIMIT 1;
```

✅ **Esperado:** 1 transaction apenas:
- `category` = `'SUBSCRIPTION'`
- `amount_cents` = preço do plano (sem taxa)
- `payment_method` = `'DINHEIRO'`
- `description` = "Renovacao: [plano]"

### Resultado Final
- ✅ Renovação bem-sucedida
- ✅ SEM taxa de matrícula
- ✅ Acesso extendido corretamente
- ✅ 1 transaction criada

---

## **TEST 5: STRIPE - Renewal (ATIVO/BLOQUEADO → ATIVO)**

### Objetivo
Testar renovação com Stripe Checkout.

### Passos

#### 5.1 Navegar e selecionar membro
```
URL: http://localhost:8080/staff/payment
```
- Buscar membro ATIVO/BLOQUEADO
- Selecionar plano

#### 5.2 Selecionar STRIPE
- Clicar "💳 Cartão (Stripe Checkout)"

✅ **Esperado:**
- Info banner aparece
- Botão: "Confirmar Pagamento"

#### 5.3 Confirmar e pagar
- Clicar "Confirmar Pagamento"
- Redireciona para Stripe
- Completar pagamento (4242...)

✅ **Esperado:**
- Redireciona para `/staff/enrollment-success?session_id=...`
- Página de sucesso mostra confirmação

#### 5.4 Verificar webhook e DB
- Aguardar 3-10 segundos
- Verificar logs do webhook
- Verificar tabelas (members, subscriptions, transactions)

✅ **Esperado:**
- Membro status = ATIVO
- `enrollment_fee_cents` = `0` (renewal, sem taxa)
- 1 transaction criada (apenas plano)
- `payment_method` = `'STRIPE'`

### Resultado Final
- ✅ Renewal via Stripe funcionou
- ✅ SEM taxa de matrícula
- ✅ Webhook processou corretamente

---

## **TEST 6: Sales - Produtos (apenas verificação de UI)**

### Objetivo
Verificar que Sales.tsx foi atualizado com 2 métodos.

### Passos

#### 6.1 Navegar para vendas
```
URL: http://localhost:8080/staff/sales
```

#### 6.2 Verificar métodos de pagamento

✅ **Esperado:**
- Apenas 2 opções:
  - 💵 Dinheiro
  - 💳 Cartão (STRIPE)
- Grid com 2 colunas (não 3)

#### 6.3 Criar venda com DINHEIRO
- Selecionar produto
- Quantidade
- Selecionar DINHEIRO
- Confirmar

✅ **Esperado:**
- Transaction criada instantaneamente
- `category` = `'PRODUTOS'`
- `payment_method` = `'DINHEIRO'`

### Resultado Final
- ✅ UI atualizada com 2 métodos
- ✅ DINHEIRO funciona

**Nota:** Lógica de STRIPE para produtos não implementada ainda (apenas UI).

---

## **TEST 7: Webhook Idempotency**

### Objetivo
Garantir que webhook não processa o mesmo evento 2x.

### Passos

#### 7.1 Completar um enrollment via STRIPE
- Seguir TEST 2 até webhook processar

#### 7.2 Forçar reenvio do webhook (Stripe Dashboard)
```
Stripe Dashboard → Developers → Webhooks → [seu webhook]
→ Events → Selecionar evento "checkout.session.completed"
→ Clicar "Resend event"
```

#### 7.3 Verificar logs
```
Supabase → Edge Functions → stripe-webhook → Logs
```

✅ **Esperado:**
- Log mostra: "Event already processed, skipping"
- Nenhum erro

#### 7.4 Verificar banco de dados

**Tabela `webhook_events`:**
```sql
SELECT COUNT(*) FROM webhook_events
WHERE stripe_event_id = '[event_id]';
```

✅ **Esperado:**
- `COUNT = 1` (apenas 1 registro, não duplicado)

**Tabela `transactions`:**
```sql
SELECT COUNT(*) FROM transactions
WHERE member_id = '[member_id]'
AND created_at > NOW() - INTERVAL '5 minutes';
```

✅ **Esperado:**
- `COUNT = 2` (plano + taxa, não 4)

### Resultado Final
- ✅ Webhook é idempotente
- ✅ Não cria transações duplicadas
- ✅ Event registrado em webhook_events

---

## 📊 Test Results Summary

Após completar todos os testes, preencher:

| Test | Status | Notes |
|------|--------|-------|
| TEST 1: DINHEIRO Enrollment | ⏳ Pending | |
| TEST 2: STRIPE Enrollment | ⏳ Pending | |
| TEST 3: STRIPE Cancel | ⏳ Pending | |
| TEST 4: DINHEIRO Renewal | ⏳ Pending | |
| TEST 5: STRIPE Renewal | ⏳ Pending | |
| TEST 6: Sales UI | ⏳ Pending | |
| TEST 7: Webhook Idempotency | ⏳ Pending | |

**Legenda:**
- ✅ Pass
- ❌ Fail
- ⏳ Pending
- ⚠️ Partial (com notas)

---

## 🐛 Bug Report Template

Se encontrar um bug, documentar assim:

```
## Bug: [Título curto]

**Test:** TEST X - [nome do teste]
**Step:** [passo onde falhou]

**Esperado:** [comportamento esperado]
**Atual:** [o que aconteceu]

**Screenshots:** [se aplicável]

**Logs:**
```
[colar logs relevantes]
```

**Database State:**
```sql
-- Query que mostra o problema
```

**Reproduzir:**
1. [passo 1]
2. [passo 2]
3. ...
```

---

## ✅ Checklist Final

Após completar todos os testes:

- [ ] Todos os 7 testes passaram
- [ ] Nenhum erro no console do browser
- [ ] Nenhum erro nos logs do Supabase
- [ ] Webhook processa eventos em <5 segundos
- [ ] Idempotência funciona (teste 7)
- [ ] UI responsiva e sem bugs visuais
- [ ] Transações criadas corretamente
- [ ] Status de membros atualizado corretamente
- [ ] Documentação está atualizada

---

**Última atualização:** 2026-01-23
**Status:** Ready for testing
**Próximo:** Execute os testes e reporte bugs (se houver)
