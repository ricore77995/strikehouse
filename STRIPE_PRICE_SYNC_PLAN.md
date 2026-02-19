# STRIPE PRICE SYNC PLAN

**Data:** 2026-02-17
**Status:** ✅ IMPLEMENTADO E DEPLOYED
**Spec Completa:** `.claude/plans/silly-sprouting-neumann-agent-a9d1f9c.md`

---

## OBJECTIVO

Sincronizar preços dos planos locais com Stripe (source of truth). Cada plano pode ter um Payment Link associado.

---

## DECISÕES

| Questão | Decisão |
|---------|---------|
| Modo de Sync | Manual + Webhook automático |
| Planos Locais | Manter funcionando para DINHEIRO |

---

## FASE 1: Database Migration

```sql
-- supabase/migrations/20260218_sync_plans_with_stripe.sql

-- 1. Novos campos
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS stripe_payment_link_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS price_source VARCHAR(20) DEFAULT 'LOCAL'
  CHECK (price_source IN ('STRIPE', 'OVERRIDE', 'LOCAL')),
ADD COLUMN IF NOT EXISTS stripe_synced_at TIMESTAMPTZ;

-- 2. Index único para Payment Link
CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_unique_payment_link
ON plans(stripe_payment_link_id)
WHERE stripe_payment_link_id IS NOT NULL AND ativo = true;

-- 3. Actualizar planos existentes com Stripe
UPDATE plans SET price_source = 'STRIPE'
WHERE stripe_price_id IS NOT NULL AND price_source = 'LOCAL';

-- Comments
COMMENT ON COLUMN plans.stripe_payment_link_id IS 'Stripe Payment Link ID (plink_xxx)';
COMMENT ON COLUMN plans.price_source IS 'STRIPE (sync), OVERRIDE (manual), LOCAL (sem Stripe)';
COMMENT ON COLUMN plans.stripe_synced_at IS 'Última sincronização';
```

**Comandos:**
```bash
make db-push
make db-types
```

---

## FASE 2: Edge Function - Sync

```typescript
// supabase/functions/sync-plan-prices/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Buscar planos com price_source = 'STRIPE'
  const { data: plans } = await supabase
    .from('plans')
    .select('id, nome, preco_cents, stripe_price_id')
    .eq('price_source', 'STRIPE')
    .not('stripe_price_id', 'is', null);

  const updates: Array<{ id: string; oldPrice: number; newPrice: number }> = [];

  for (const plan of plans || []) {
    const price = await stripe.prices.retrieve(plan.stripe_price_id);

    if (price.unit_amount !== plan.preco_cents) {
      await supabase
        .from('plans')
        .update({
          preco_cents: price.unit_amount,
          stripe_synced_at: new Date().toISOString(),
        })
        .eq('id', plan.id);

      updates.push({
        id: plan.id,
        oldPrice: plan.preco_cents,
        newPrice: price.unit_amount!,
      });
    }
  }

  return new Response(JSON.stringify({
    synced: updates.length,
    updates,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

---

## FASE 3: Webhook - price.updated

Adicionar ao `supabase/functions/stripe-webhook/index.ts`:

```typescript
case 'price.updated':
  await handlePriceUpdated(event.data.object as Stripe.Price);
  break;

// Handler
async function handlePriceUpdated(price: Stripe.Price) {
  const { data: plan } = await supabase
    .from('plans')
    .select('id, price_source')
    .eq('stripe_price_id', price.id)
    .single();

  if (plan && plan.price_source === 'STRIPE') {
    await supabase
      .from('plans')
      .update({
        preco_cents: price.unit_amount,
        stripe_synced_at: new Date().toISOString(),
      })
      .eq('id', plan.id);

    console.log(`Auto-synced plan ${plan.id} to ${price.unit_amount} cents`);
  }
}
```

---

## FASE 4: UI - Plans.tsx

### 4.1 Badges de Estado

```tsx
// Componente Badge de sincronização
function SyncBadge({ source }: { source: 'STRIPE' | 'OVERRIDE' | 'LOCAL' }) {
  const variants = {
    STRIPE: { label: 'Stripe', className: 'bg-green-500' },
    OVERRIDE: { label: 'Override', className: 'bg-yellow-500' },
    LOCAL: { label: 'Local', className: 'bg-gray-500' },
  };
  const v = variants[source];
  return <Badge className={v.className}>{v.label}</Badge>;
}
```

### 4.2 PaymentLinkSelector

```tsx
// src/components/PaymentLinkSelector.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PaymentLink {
  id: string;
  url: string;
  display_name: string;
  price_cents: number;
  metadata: Record<string, string>;
}

export function PaymentLinkSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (linkId: string, data: PaymentLink) => void;
}) {
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLinks() {
      const { data } = await supabase.functions.invoke('list-payment-links');
      setLinks(data?.links || []);
      setLoading(false);
    }
    fetchLinks();
  }, []);

  return (
    <Select
      value={value || undefined}
      onValueChange={(id) => {
        const link = links.find((l) => l.id === id);
        if (link) onChange(id, link);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder={loading ? 'Carregando...' : 'Seleccionar Payment Link'} />
      </SelectTrigger>
      <SelectContent>
        {links.map((link) => (
          <SelectItem key={link.id} value={link.id}>
            {link.display_name} - €{(link.price_cents / 100).toFixed(2)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### 4.3 Formulário de Plano (adicionar campos)

```tsx
// No formulário de edição de plano
<FormField
  control={form.control}
  name="stripe_payment_link_id"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Payment Link (Stripe)</FormLabel>
      <FormControl>
        <PaymentLinkSelector
          value={field.value}
          onChange={(id, link) => {
            field.onChange(id);
            // Auto-preencher preço do Stripe
            form.setValue('preco_cents', link.price_cents);
            form.setValue('price_source', 'STRIPE');
          }}
        />
      </FormControl>
      <FormDescription>
        Associar a um Payment Link sincroniza o preço automaticamente
      </FormDescription>
    </FormItem>
  )}
/>

{/* Toggle de Override */}
{form.watch('price_source') === 'STRIPE' && (
  <FormField
    control={form.control}
    name="price_source"
    render={({ field }) => (
      <FormItem className="flex items-center gap-2">
        <FormControl>
          <Switch
            checked={field.value === 'OVERRIDE'}
            onCheckedChange={(checked) =>
              field.onChange(checked ? 'OVERRIDE' : 'STRIPE')
            }
          />
        </FormControl>
        <FormLabel>Override Preço (ignorar Stripe)</FormLabel>
      </FormItem>
    )}
  />
)}
```

### 4.4 Botão Sincronizar

```tsx
async function handleSync() {
  const { data, error } = await supabase.functions.invoke('sync-plan-prices');

  if (error) {
    toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    return;
  }

  if (data.synced === 0) {
    toast({ title: 'Tudo sincronizado', description: 'Nenhuma alteração necessária' });
  } else {
    toast({
      title: `${data.synced} plano(s) actualizado(s)`,
      description: data.updates.map(u =>
        `${u.id}: €${(u.oldPrice/100).toFixed(2)} → €${(u.newPrice/100).toFixed(2)}`
      ).join('\n'),
    });
  }

  // Refresh lista
  refetch();
}

// No header da página
<Button onClick={handleSync} variant="outline">
  <RefreshCw className="h-4 w-4 mr-2" />
  Sincronizar Preços
</Button>
```

---

## CHECKLIST

### Database
- [x] Criar migration `20260218_sync_plans_with_stripe.sql`
- [x] `make db-push`
- [x] `make db-types`

### Edge Functions
- [x] Criar `sync-plan-prices/index.ts`
- [x] Adicionar handler `price.updated` ao webhook
- [x] Deploy: `./scripts/deploy-edge-functions.sh`

### UI
- [x] Criar `PaymentLinkSelector.tsx`
- [x] Actualizar `Plans.tsx`:
  - [x] Campo Payment Link
  - [x] Badges de estado
  - [x] Toggle Override
  - [x] Botão Sincronizar
- [ ] Testar associação

### Testes
- [ ] Associar plano a Payment Link
- [ ] Override de preço
- [ ] Sync batch
- [ ] Webhook price.updated

---

## REGRAS DE NEGÓCIO

| ID | Regra |
|----|-------|
| RN-SYNC-01 | Stripe é source of truth para cobrança |
| RN-SYNC-02 | `price_source` controla: STRIPE / OVERRIDE / LOCAL |
| RN-SYNC-03 | 1 plano : 1 Payment Link (unique) |
| RN-SYNC-04 | Webhook `price.updated` auto-sync se `price_source = 'STRIPE'` |
| RN-SYNC-05 | Planos LOCAL continuam para DINHEIRO |

---

## FLUXO DE ASSOCIAÇÃO

```
1. Admin edita plano
2. Selecciona Payment Link no dropdown
3. Sistema pre-preenche:
   - preco_cents ← Price.unit_amount
   - price_source ← 'STRIPE'
4. Admin pode activar "Override" se quiser preço diferente
5. Ao guardar:
   - stripe_payment_link_id = link.id
   - stripe_synced_at = now()
```

---

## FLUXO DE SYNC AUTOMÁTICO

```
1. Admin altera preço no Stripe Dashboard
2. Stripe envia webhook price.updated
3. Webhook verifica: plano tem price_source = 'STRIPE'?
4. Se sim: actualiza preco_cents e stripe_synced_at
5. Se não (OVERRIDE/LOCAL): ignora
```
