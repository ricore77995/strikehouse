# Plano de Deploy para Produção - BoxeMaster Pro

---

## ÍNDICE

1. [Pré-Requisitos](#1-pré-requisitos)
2. [Criar Projecto Supabase de Produção](#2-criar-projecto-supabase-de-produção)
3. [Aplicar Migrations](#3-aplicar-migrations)
4. [Deploy Edge Functions](#4-deploy-edge-functions)
5. [Configurar Stripe para Produção](#5-configurar-stripe-para-produção)
6. [Popular Payment Links](#6-popular-payment-links)
7. [Configurar Vercel](#7-configurar-vercel)
8. [DNS e Domínio](#8-dns-e-domínio)
9. [Testes Pré-Launch](#9-testes-pré-launch)
10. [Go-Live Checklist](#10-go-live-checklist)
11. [Monitorização Pós-Launch](#11-monitorização-pós-launch)
12. [Rollback Plan](#12-rollback-plan)

---

## 1. PRÉ-REQUISITOS

### Contas Necessárias
- [ ] Conta Supabase (plano Pro recomendado para produção)
- [ ] Conta Stripe (verificada para pagamentos live)
- [ ] Conta Vercel (conectada ao repositório GitHub)
- [ ] Domínio próprio (ex: strikehouse.pt)
- [ ] Conta Resend (para emails transacionais)

### Ferramentas Instaladas
```bash
# Verificar versões
node --version      # >= 20.x
npm --version       # >= 10.x
supabase --version  # >= 2.67.x

# Login nas CLIs
supabase login
vercel login
```

### Chaves a Obter do Stripe Dashboard
```
# Em https://dashboard.stripe.com/apikeys (modo LIVE)
sk_live_xxx...      # Secret Key (NUNCA commitar!)
pk_live_xxx...      # Publishable Key (pode ser público)
```

---

## 2. CRIAR PROJECTO SUPABASE DE PRODUÇÃO

### 2.1 Criar Novo Projecto

1. Ir a https://supabase.com/dashboard
2. **New Project** → Escolher organização
3. **Configurações:**
   - Name: `strikehouse-prod` (ou similar)
   - Database Password: Gerar password forte (GUARDAR!)
   - Region: `eu-west-1` (Frankfurt) - mais próximo de Portugal
   - Pricing Plan: **Pro** (recomendado para produção)

4. Aguardar ~2 minutos até o projecto estar ready

### 2.2 Copiar Credenciais

Ir a **Project Settings → API**:

```bash
# Guardar estas credenciais de forma SEGURA
PROD_PROJECT_REF=<project-ref>           # Ex: abcdefghijklmnop
PROD_SUPABASE_URL=https://<project-ref>.supabase.co
PROD_ANON_KEY=eyJ...                     # Publishable Key
PROD_SERVICE_ROLE_KEY=eyJ...             # Service Role (SECRETO)
```

### 2.3 Linkar CLI ao Projecto PROD

```bash
# Criar ficheiro de configuração para PROD
cd /Users/ricore/strikehouse

# Linkar ao projecto de produção
supabase link --project-ref <PROD_PROJECT_REF>
```

**⚠️ ATENÇÃO:** Isto vai mudar o link do CLI. Para voltar ao DEV:
```bash
supabase link --project-ref cgdshqmqsqwgwpjfmesr
```

---

## 3. APLICAR MIGRATIONS

### 3.1 Verificar Migrations Pendentes

```bash
# Listar todas as migrations
ls -la supabase/migrations/

# Total: 41 migrations
# De 20260110214515 até 20260218110000
```

### 3.2 Push para Produção

```bash
# Certificar que está linkado ao PROD
supabase link --project-ref <PROD_PROJECT_REF>

# Aplicar TODAS as migrations
supabase db push

# Verificar status
supabase db remote info
```

### 3.3 Verificar Tabelas Críticas

Ir a **Table Editor** no Supabase Dashboard PROD e verificar:

| Tabela | Verificação |
|--------|-------------|
| `members` | Existe com colunas `stripe_customer_id`, `stripe_subscription_id`, `weekly_limit` |
| `staff` | Tem registo de sistema: `id=00000000-0000-0000-0000-000000000001` |
| `stripe_payment_links` | Existe (vazia por agora) |
| `stripe_events` | Existe para idempotência do webhook |
| `cash_transactions` | Existe para pagamentos offline |
| `transactions` | Tem `payment_method` incluindo `STRIPE` |

### 3.4 Criar Staff de Sistema

O webhook precisa de um `staff` com ID fixo para `created_by`:

```sql
-- Executar no SQL Editor do Supabase PROD
INSERT INTO staff (id, nome, role, user_id, activo)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Sistema Automático',
  'ADMIN',
  NULL,
  true
)
ON CONFLICT (id) DO NOTHING;
```

---

## 4. DEPLOY EDGE FUNCTIONS

### 4.1 Lista de Funções a Deploy

| Função | Prioridade | Descrição |
|--------|------------|-----------|
| `stripe-webhook` | **CRÍTICA** | Processa pagamentos Stripe |
| `list-payment-links` | **CRÍTICA** | Lista links para staff |
| `create-checkout-session` | Alta | Cria sessões de checkout |
| `create-offline-invoice` | Alta | Pagamentos offline |
| `cancel-subscription` | Média | Cancelar subscrição |
| `pause-subscription` | Média | Pausar subscrição |
| `update-subscription` | Média | Upgrade/downgrade |
| `scheduled-jobs` | Média | Cron jobs diários |
| `send-notification` | Média | Emails via Resend |
| `get-member-by-qr` | Média | QR code público |
| `sync-plan-prices` | Baixa | Sincronizar preços |
| `seed-test-users` | **NÃO DEPLOY** | Apenas DEV |
| `fix-audit-trigger` | **NÃO DEPLOY** | Utilitário one-time |

### 4.2 Deploy das Funções

```bash
# Certificar que está linkado ao PROD
supabase link --project-ref <PROD_PROJECT_REF>

# Deploy uma a uma (recomendado para verificar erros)
supabase functions deploy stripe-webhook
supabase functions deploy list-payment-links
supabase functions deploy create-checkout-session
supabase functions deploy create-offline-invoice
supabase functions deploy cancel-subscription
supabase functions deploy pause-subscription
supabase functions deploy update-subscription
supabase functions deploy scheduled-jobs
supabase functions deploy send-notification
supabase functions deploy get-member-by-qr
supabase functions deploy sync-plan-prices

# Ou todas de uma vez:
./scripts/deploy-edge-functions.sh
```

### 4.3 Configurar Secrets das Edge Functions

Ir a **Edge Functions → Secrets** no Supabase Dashboard PROD:

```bash
# Via CLI (mais rápido):
supabase secrets set --project-ref <PROD_PROJECT_REF> \
  STRIPE_SECRET_KEY=sk_live_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  SITE_URL=https://strikehouse.pt \
  RESEND_API_KEY=re_xxx
```

Ou via Dashboard:

| Secret | Valor | Onde obter |
|--------|-------|------------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe Dashboard → API Keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Criado no passo 5.3 |
| `SITE_URL` | `https://strikehouse.pt` | Seu domínio |
| `RESEND_API_KEY` | `re_...` | Resend Dashboard |

**Nota:** `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injectados automaticamente.

---

## 5. CONFIGURAR STRIPE PARA PRODUÇÃO

### 5.1 Verificar Conta Stripe

A conta Stripe já está activa em modo LIVE com produtos/preços existentes.

1. Ir a https://dashboard.stripe.com (verificar que está em modo LIVE)
2. Ir a **Products** → verificar produtos existentes
3. Anotar os `price_id` de cada preço (ex: `price_1Abc...`)

### 5.2 Actualizar Metadata dos Preços Existentes

O webhook lê metadata dos **Price objects** para configurar o acesso do membro.
Cada preço precisa dos seguintes campos de metadata:

**Metadata obrigatória por Price:**

| Campo | Valores | Descrição |
|-------|---------|-----------|
| `weekly_limit` | `1`, `2`, `3` ou vazio | Limite de check-ins por semana |
| `access_type` | `SUBSCRIPTION`, `DAILY_PASS`, `CREDITS`, `ENROLLMENT_FEE` | Tipo de acesso |
| `display_name` | Ex: `2x/semana €40` | Nome para mostrar no UI |
| `commitment_months` | `1`, `3`, `6`, `12` | Período de compromisso (opcional) |
| `modalities_count` | `1`, `ALL` ou número | Quantas modalidades (opcional) |
| `is_family_friends` | `true` ou vazio | Se é plano F&F (opcional) |

**Opção A: Via Dashboard (manual)**

1. Stripe Dashboard → Products → [Produto]
2. Clicar no **Price** específico
3. Scroll down até **Metadata**
4. Adicionar cada campo

**Opção B: Via Script (automatizado)**

Criar script `scripts/update-stripe-metadata.ts`:

```typescript
#!/usr/bin/env npx tsx
import Stripe from 'stripe';
import 'dotenv/config';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Mapeamento dos preços existentes para metadata
const PRICE_METADATA: Record<string, Stripe.MetadataParam> = {
  'price_1Abc...': { // ← Substituir pelo price_id real
    weekly_limit: '2',
    access_type: 'SUBSCRIPTION',
    display_name: '2x/semana €40',
    commitment_months: '1',
  },
  'price_2Def...': {
    weekly_limit: '3',
    access_type: 'SUBSCRIPTION',
    display_name: '3x/semana €50',
    commitment_months: '1',
  },
  // ... adicionar todos os preços
};

async function main() {
  for (const [priceId, metadata] of Object.entries(PRICE_METADATA)) {
    console.log(`Updating ${priceId}...`);
    await stripe.prices.update(priceId, { metadata });
    console.log(`✓ ${priceId} updated`);
  }
  console.log('Done!');
}

main();
```

Executar:
```bash
STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/update-stripe-metadata.ts
```

### 5.2.1 Verificar Metadata Existente

Antes de actualizar, verificar o que já existe:

```bash
# Script para listar preços e sua metadata
npx tsx -e "
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function list() {
  const prices = await stripe.prices.list({ active: true, limit: 100 });
  for (const p of prices.data) {
    console.log(\`\${p.id}: \${p.nickname || 'no name'}\`);
    console.log(\`  Amount: \${p.unit_amount / 100} \${p.currency.toUpperCase()}\`);
    console.log(\`  Metadata: \${JSON.stringify(p.metadata)}\`);
    console.log();
  }
}
list();
"
```

### 5.2.2 Mapeamento Esperado

| Plano (teu nome) | price_id | Metadata a adicionar |
|------------------|----------|---------------------|
| 1x/semana | `price_???` | `weekly_limit=1, access_type=SUBSCRIPTION` |
| 2x/semana | `price_???` | `weekly_limit=2, access_type=SUBSCRIPTION` |
| 3x/semana | `price_???` | `weekly_limit=3, access_type=SUBSCRIPTION` |
| Ilimitado | `price_???` | `access_type=SUBSCRIPTION` (sem weekly_limit) |
| Trimestral | `price_???` | `commitment_months=3, access_type=SUBSCRIPTION` |
| Semestral | `price_???` | `commitment_months=6, access_type=SUBSCRIPTION` |
| Anual | `price_???` | `commitment_months=12, access_type=SUBSCRIPTION` |
| Matrícula | `price_???` | `access_type=ENROLLMENT_FEE` |
| F&F | `price_???` | `is_family_friends=true, access_type=SUBSCRIPTION` |

**⚠️ NOTA:** Preencher os `price_???` com os IDs reais do teu Stripe

### 5.3 Criar Webhook Endpoint

**Via Dashboard (recomendado):**

1. Stripe Dashboard → Developers → Webhooks
2. **Add endpoint**
3. **URL:** `https://<PROD_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`
4. **Events to listen:**
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
   - `customer.subscription.resumed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. **Add endpoint** → Copiar o `whsec_...` (mostrado apenas uma vez!)

**Via Script:**

```bash
STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/setup-stripe-webhook.ts
```

### 5.4 Payment Links

**Verificar se já existem Payment Links:**

```bash
# Listar Payment Links existentes
npx tsx -e "
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function list() {
  const links = await stripe.paymentLinks.list({ active: true, limit: 100 });
  console.log(\`Found \${links.data.length} active Payment Links:\\n\`);
  for (const link of links.data) {
    const items = await stripe.paymentLinks.listLineItems(link.id);
    const total = items.data.reduce((sum, i) => sum + (i.price?.unit_amount || 0), 0);
    console.log(\`ID: \${link.id}\`);
    console.log(\`URL: \${link.url}\`);
    console.log(\`Items: \${items.data.length}\`);
    console.log(\`Total: €\${total/100}\`);
    console.log();
  }
}
list();
"
```

**Opção A: Payment Links já existem**

Se já tens Payment Links criados no Stripe, podes usar o script existente:
```bash
STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/populate-payment-links-test.ts
```

Este script:
1. Lista todos os Payment Links activos da API Stripe
2. Busca line items e metadata de cada um
3. Infere `frequencia`, `compromisso`, etc. da metadata/preço
4. Insere na tabela `stripe_payment_links`

**Opção B: Criar Payment Links novos**

Se precisas criar novos Payment Links:

Para cada plano, criar 2 Payment Links:

1. **Com Matrícula** (novos membros):
   - Products: Plano + Taxa de Matrícula (2 items)
   - Allow promotion codes: ✅
   - After payment → Redirect: `https://strikehouse.pt/checkout/success?session_id={CHECKOUT_SESSION_ID}`

2. **Sem Matrícula** (renovações):
   - Products: Apenas o plano
   - Allow promotion codes: ✅
   - After payment → Redirect: mesmo URL

**Total: ~14 Payment Links** (7 planos × 2 versões)

**Opção C: Criar via API (automatizado)**

```typescript
// scripts/create-payment-links.ts
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PLANS = [
  { priceId: 'price_xxx', enrollmentPriceId: 'price_yyy' },
  // ... outros planos
];

for (const plan of PLANS) {
  // Com matrícula
  const withEnrollment = await stripe.paymentLinks.create({
    line_items: [
      { price: plan.priceId, quantity: 1 },
      { price: plan.enrollmentPriceId, quantity: 1 },
    ],
    allow_promotion_codes: true,
    after_completion: {
      type: 'redirect',
      redirect: { url: 'https://strikehouse.pt/checkout/success?session_id={CHECKOUT_SESSION_ID}' }
    },
  });

  // Sem matrícula
  const withoutEnrollment = await stripe.paymentLinks.create({
    line_items: [{ price: plan.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    after_completion: {
      type: 'redirect',
      redirect: { url: 'https://strikehouse.pt/checkout/success?session_id={CHECKOUT_SESSION_ID}' }
    },
  });

  console.log(`Created: ${withEnrollment.url}`);
  console.log(`Created: ${withoutEnrollment.url}`);
}
```

---

## 6. POPULAR PAYMENT LINKS

### 6.1 Abordagem: Puxar da API Stripe

Em vez de hardcodar IDs, usar o script que busca automaticamente da API:

**Script existente:** `scripts/populate-payment-links-test.ts`

Este script já faz:
1. `stripe.paymentLinks.list({ active: true })` - Lista todos os links
2. `stripe.paymentLinks.listLineItems(link.id)` - Busca items de cada link
3. Lê metadata dos Price objects para inferir configuração
4. Insere na tabela `stripe_payment_links`

### 6.2 Adaptar Script para LIVE

O script tem uma verificação de segurança que só permite `sk_test_*`.
Para usar em LIVE, criar uma cópia:

```bash
cp scripts/populate-payment-links-test.ts scripts/populate-payment-links-live.ts
```

Editar `scripts/populate-payment-links-live.ts`:
- Linha 30-34: Remover ou comentar a verificação de `sk_test_`

```typescript
// ANTES:
if (!STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  console.error('STRIPE_SECRET_KEY must be a TEST key');
  process.exit(1);
}

// DEPOIS:
// Verificação removida para permitir LIVE
console.log('⚠️  RUNNING WITH LIVE KEY - BE CAREFUL!');
```

### 6.3 Executar

```bash
# Configurar variáveis para PROD
export VITE_SUPABASE_URL=https://<PROD_PROJECT_REF>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ...prod...
export STRIPE_SECRET_KEY=sk_live_xxx

# Executar
npx tsx scripts/populate-payment-links-live.ts
```

### 6.4 Verificar Mapeamento

Antes de inserir, o script mostra o que vai ser inserido:
```
Prepared: 2x/semana + Matrícula €55 (https://buy.stripe.com/xxx)
Prepared: 3x/semana €50 (https://buy.stripe.com/yyy)
...
```

**Verificar que:**
- `display_name` está correcto
- `frequencia` foi inferida correctamente (`1x`, `2x`, `3x`, `unlimited`)
- `includes_enrollment_fee` está correcto (2 items = true)
- `compromisso` está correcto (`mensal`, `trimestral`, etc.)

### 6.3 Verificar na Base de Dados

```sql
-- No SQL Editor do Supabase PROD
SELECT
  display_name,
  frequencia,
  compromisso,
  includes_enrollment_fee,
  amount_cents,
  payment_link_url
FROM stripe_payment_links
WHERE ativo = true
ORDER BY amount_cents;
```

---

## 7. CONFIGURAR VERCEL

### 7.1 Environment Variables

Ir a Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Value | Environments |
|----------|-------|--------------|
| `VITE_SUPABASE_PROJECT_ID` | `<PROD_PROJECT_REF>` | Production |
| `VITE_SUPABASE_URL` | `https://<PROD_PROJECT_REF>.supabase.co` | Production |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJ...prod-anon...` | Production |

**⚠️ IMPORTANTE:** Não adicionar `STRIPE_SECRET_KEY` ao Vercel - só é usado nas Edge Functions!

### 7.2 Configurar Build

No ficheiro `vercel.json` (já existe):

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

### 7.3 Deploy

```bash
# Trigger deploy manual
vercel --prod

# Ou push para main (auto-deploy)
git push origin main
```

### 7.4 Verificar Deploy

1. Ir a https://strikehouse.vercel.app (URL temporário)
2. Verificar que a app carrega
3. Verificar consola do browser (sem erros de Supabase)

---

## 8. DNS E DOMÍNIO

### 8.1 Adicionar Domínio no Vercel

1. Vercel Dashboard → Project → Settings → Domains
2. Add: `strikehouse.pt` e `www.strikehouse.pt`
3. Copiar os registos DNS mostrados

### 8.2 Configurar DNS

No provider do domínio (ex: Cloudflare, GoDaddy):

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| A | @ | `76.76.21.21` | Auto |
| CNAME | www | `cname.vercel-dns.com` | Auto |

### 8.3 SSL/HTTPS

- Vercel provisiona certificado SSL automaticamente
- Aguardar ~10 minutos após DNS propagação
- Verificar em https://strikehouse.pt

---

## 9. TESTES PRÉ-LAUNCH

### 9.1 Testes de Autenticação

- [ ] Login com credenciais de teste (criar staff temporário)
- [ ] Logout funciona
- [ ] Redirect baseado em role funciona

### 9.2 Testes de Pagamento

**Usar cartão de teste Stripe (mesmo em LIVE, funciona):**
- Cartão: `4242 4242 4242 4242`
- Data: Qualquer futura
- CVC: Qualquer 3 dígitos

- [ ] Criar membro LEAD
- [ ] Seleccionar plano com matrícula
- [ ] Completar checkout Stripe
- [ ] Verificar webhook recebido (Stripe Dashboard → Webhooks → Events)
- [ ] Verificar membro activado (status = ATIVO)
- [ ] Verificar `stripe_events` tem o evento
- [ ] Verificar `transactions` tem 2 registos (plano + matrícula)

### 9.3 Testes de Check-in

- [ ] Scan QR code de membro activo → ALLOWED
- [ ] Scan QR code de membro bloqueado → BLOCKED
- [ ] Verificar `check_ins` regista entrada

### 9.4 Testes de Admin

- [ ] `/admin/stripe-links` mostra Payment Links
- [ ] `/admin/finances` mostra transacções
- [ ] `/admin/members` lista membros

---

## 10. GO-LIVE CHECKLIST

### Antes de Anunciar

- [ ] Todos os testes do ponto 9 passam
- [ ] DNS propagado (verificar em https://dnschecker.org)
- [ ] SSL activo (https funciona)
- [ ] Webhook Stripe a funcionar (eventos chegam)
- [ ] Backup da base DEV feito

### Dados Iniciais

- [ ] Criar staff accounts reais (OWNER, ADMIN, STAFF)
- [ ] Remover staff de teste
- [ ] Configurar `gym_settings` (kiosk PIN, etc.)

### Configurações Finais

```bash
# Definir kiosk PIN de produção
# No SQL Editor PROD:
INSERT INTO gym_settings (key, value)
VALUES ('kiosk_pin', '123456')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

### Comunicação

- [ ] Notificar equipa sobre go-live
- [ ] Preparar manual de uso para staff
- [ ] Configurar emails transacionais (Resend)

---

## 11. MONITORIZAÇÃO PÓS-LAUNCH

### Supabase Dashboard

- **Database → Reports**: Verificar queries lentas
- **Edge Functions → Logs**: Verificar erros
- **Auth → Users**: Monitorizar registos

### Stripe Dashboard

- **Payments**: Verificar pagamentos a entrar
- **Webhooks**: Verificar delivery success rate
- **Disputes**: Monitorizar chargebacks

### Vercel Dashboard

- **Analytics**: Tráfego e performance
- **Logs**: Erros de build/runtime

### Alertas a Configurar

1. **Stripe:** Webhook delivery failures
2. **Supabase:** Database usage > 80%
3. **Vercel:** Build failures

---

## 12. ROLLBACK PLAN

### Se Algo Correr Mal

**Nível 1: Problemas de UI**
```bash
# Reverter para último deploy funcional
vercel rollback
```

**Nível 2: Problemas de Edge Functions**
```bash
# Re-deploy versão anterior
git checkout <commit-anterior>
supabase functions deploy <function-name>
```

**Nível 3: Problemas de Base de Dados**
```bash
# Supabase tem backups automáticos
# Ir a Dashboard → Database → Backups → Restore
```

**Nível 4: Desastre Total**
```bash
# 1. Desligar Stripe webhook
# 2. Colocar página de manutenção
# 3. Investigar logs
# 4. Restaurar backup
# 5. Re-deploy
```

### Contactos de Emergência

- Supabase Support: support@supabase.io
- Stripe Support: https://support.stripe.com
- Vercel Support: https://vercel.com/help

---

## RESUMO DE COMANDOS

```bash
# 1. Linkar ao projecto PROD
supabase link --project-ref <PROD_PROJECT_REF>

# 2. Aplicar migrations
supabase db push

# 3. Deploy Edge Functions
supabase functions deploy stripe-webhook
supabase functions deploy list-payment-links
# ... etc

# 4. Configurar secrets
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  SITE_URL=https://strikehouse.pt \
  RESEND_API_KEY=re_xxx

# 5. Popular Payment Links
npx tsx scripts/populate-payment-links.ts

# 6. Deploy Vercel
git push origin main
# ou
vercel --prod
```

---

## TIMELINE ESTIMADA

| Fase | Tempo | Dependências |
|------|-------|--------------|
| 1. Criar Supabase PROD | 15 min | - |
| 2. Aplicar Migrations | 10 min | 1 |
| 3. Deploy Edge Functions | 20 min | 2 |
| 4. Configurar Stripe | 45 min | - |
| 5. Popular Payment Links | 15 min | 4 |
| 6. Configurar Vercel | 10 min | - |
| 7. DNS | 10 min + 24h propagação | 6 |
| 8. Testes | 60 min | Tudo acima |
| **TOTAL** | **~3 horas** (+ DNS) | - |

---

## FICHEIROS RELEVANTES

| Ficheiro | Propósito |
|----------|-----------|
| `supabase/migrations/*.sql` | 41 migrations a aplicar |
| `supabase/functions/stripe-webhook/index.ts` | Webhook handler |
| `scripts/populate-payment-links.ts` | Popular tabela de links |
| `scripts/setup-stripe-webhook.ts` | Criar webhook endpoint |
| `scripts/setup-stripe-env.sh` | Configurar secrets |
| `.env.example` | Template de variáveis |
| `vercel.json` | Configuração Vercel |
