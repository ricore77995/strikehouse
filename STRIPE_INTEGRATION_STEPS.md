# 🎯 Stripe Integration - Step by Step

**Decisão:** Apenas 2 métodos de pagamento:
1. **DINHEIRO** - Cash, instant activation
2. **STRIPE** - Card via Stripe Checkout, activation via webhook

---

## Changes Required

### 1. Update Type Definition

**Before:**
```typescript
type PaymentMethod = 'DINHEIRO' | 'CARTAO' | 'MBWAY' | 'TRANSFERENCIA';
```

**After:**
```typescript
type PaymentMethod = 'DINHEIRO' | 'STRIPE';
```

### 2. Update Payment Method Selector (Step 3)

**Before:**
```typescript
<SelectContent>
  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
  <SelectItem value="CARTAO">Cartão (TPA)</SelectItem>
  <SelectItem value="MBWAY">MBWay</SelectItem>
  <SelectItem value="TRANSFERENCIA">Transferência Bancária</SelectItem>
</SelectContent>
```

**After:**
```typescript
<SelectContent>
  <SelectItem value="DINHEIRO">💵 Dinheiro (Pagamento Imediato)</SelectItem>
  <SelectItem value="STRIPE">💳 Cartão (Stripe Checkout)</SelectItem>
</SelectContent>
```

### 3. Add Info Banner for STRIPE

**Add after payment method selector:**
```typescript
{paymentMethod === 'STRIPE' && (
  <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
    <div className="flex gap-2">
      <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-semibold text-blue-600 mb-1">Checkout Seguro</p>
        <p className="text-muted-foreground">
          Você será redirecionado para o Stripe para completar o pagamento com segurança.
          O membro será ativado automaticamente após confirmação.
        </p>
      </div>
    </div>
  </div>
)}
```

### 4. Refactor handlePaymentConfirm

**Before:**
```typescript
const handlePaymentConfirm = async () => {
  if (!paymentMethod) {
    toast({ title: 'Selecione um método de pagamento', variant: 'destructive' });
    return;
  }
  setIsProcessing(true);
  try {
    if (paymentMethod === 'TRANSFERENCIA') {
      await pendingPaymentMutation.mutateAsync();
    } else {
      await enrollMutation.mutateAsync();
    }
  } finally {
    setIsProcessing(false);
  }
};
```

**After:**
```typescript
const handlePaymentConfirm = async () => {
  if (!paymentMethod) {
    toast({ title: 'Selecione um método de pagamento', variant: 'destructive' });
    return;
  }

  setIsProcessing(true);

  try {
    if (paymentMethod === 'STRIPE') {
      await handleStripeCheckout();
    } else {
      // DINHEIRO - instant activation
      await enrollMutation.mutateAsync();
    }
  } finally {
    setIsProcessing(false);
  }
};
```

### 5. Add handleStripeCheckout Function

**Add new function:**
```typescript
const handleStripeCheckout = async () => {
  if (!selectedMember || !staffId) {
    toast({ title: 'Dados inválidos', variant: 'destructive' });
    return;
  }

  // Get plan ID and modalityIds based on pricing mode
  let planId: string;
  let modalityIds: string[];
  let commitmentMonths: number;

  if (pricingMode === 'plan') {
    if (!selectedPlan) {
      toast({ title: 'Selecione um plano', variant: 'destructive' });
      return;
    }
    planId = selectedPlan.id;
    modalityIds = selectedPlan.modalities || [];
    commitmentMonths = selectedPlan.commitment_months || 1;
  } else {
    // Custom mode - get from pricing hook
    const subscriptionData = pricing.getSubscriptionData();
    if (!subscriptionData) {
      toast({ title: 'Dados de pricing inválidos', variant: 'destructive' });
      return;
    }

    // For custom mode, we need a "virtual" plan ID
    // TODO: Create a generic plan in DB or use null + pass raw pricing data
    toast({ title: 'Modo custom não suportado com Stripe ainda', variant: 'destructive' });
    return;
  }

  // Map commitment months to period enum
  const commitmentPeriod = mapCommitmentMonthsToPeriod(commitmentMonths);

  // Get promo code ID if applied
  let promoCodeId: string | undefined;
  if (pricing.promoCode && pricing.result.success) {
    // TODO: Get actual promo code ID from validation
    // For now, query it
    const { data: promoData } = await supabase
      .from('promo_codes')
      .select('id')
      .ilike('code', pricing.promoCode)
      .single();

    if (promoData) {
      promoCodeId = promoData.id;
    }
  }

  // Build Stripe checkout session input
  const input: CreateCheckoutSessionInput = {
    memberId: selectedMember.id,
    memberEmail: selectedMember.email || `${selectedMember.telefone}@noemail.com`,
    memberName: selectedMember.nome,
    memberStatus: selectedMember.status as 'LEAD' | 'BLOQUEADO' | 'CANCELADO',
    planId,
    modalityIds,
    commitmentPeriod,
    promoCodeId,
    chargeEnrollmentFee: selectedMember.status === 'CANCELADO' ? true : undefined,
    staffId,
  };

  console.log('Creating Stripe checkout session:', input);

  // Call Edge Function via API client
  const result = await createCheckoutSession(input);

  if (result.success) {
    console.log('Redirecting to Stripe:', result.checkoutUrl);
    // Redirect to Stripe Checkout
    window.location.href = result.checkoutUrl;
  } else {
    console.error('Failed to create checkout session:', result);
    toast({
      title: 'Erro ao criar checkout',
      description: result.message || result.error,
      variant: 'destructive',
    });
  }
};
```

### 6. Add Imports

**Add at top of file:**
```typescript
import { createCheckoutSession, mapCommitmentMonthsToPeriod } from '@/api/stripe';
import type { CreateCheckoutSessionInput } from '@/api/stripe';
import { Info } from 'lucide-react';
```

### 7. Remove Unused Mutations

**Delete:**
- `pendingPaymentMutation` (no longer needed)
- All TRANSFERENCIA-specific logic
- MBWAY-specific logic
- CARTAO TPA logic

**Keep:**
- `enrollMutation` (for DINHEIRO instant payment)
- `createMemberMutation` (still needed)

### 8. Simplify enrollMutation

**Before:** Complex logic with TRANSFERENCIA check
**After:** Only handles DINHEIRO

```typescript
const enrollMutation = useMutation({
  mutationFn: async () => {
    if (!selectedMember || !staffId) {
      throw new Error('Missing required data');
    }

    // Only DINHEIRO uses this mutation now
    // STRIPE goes through webhook

    // ... rest of existing logic ...
    // (keep subscription creation, transaction creation, cash session update)
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['enrollment-members'] });
    queryClient.invalidateQueries({ queryKey: ['members'] });
    setIsSuccess(true);
    toast({ title: 'Matrícula concluída!', description: `${selectedMember?.nome} foi matriculado.` });
  },
  onError: (error) => {
    console.error('Enrollment error:', error);
    toast({ title: 'Erro na matrícula', variant: 'destructive' });
  },
});
```

### 9. Update Button Text (Step 3)

**Before:**
```typescript
{paymentMethod === 'TRANSFERENCIA' ? 'Registrar Pendente' : 'Confirmar Matrícula'}
```

**After:**
```typescript
{paymentMethod === 'STRIPE' ? 'Ir para Pagamento' : 'Confirmar Matrícula'}
```

### 10. Update Success Message

**Modify success card:**
```typescript
<CardDescription>
  {paymentMethod === 'STRIPE'
    ? 'Aguardando confirmação do Stripe. O membro será ativado automaticamente.'
    : `${selectedMember?.nome} agora tem acesso ao ginásio.`}
</CardDescription>
```

---

## Implementation Order

1. ✅ Create API client (`src/api/stripe.ts`) - DONE
2. ✅ Update Enrollment page with Stripe integration - DONE
3. ✅ Create EnrollmentSuccess page - DONE
4. ✅ Add route for success page - DONE
5. ⏳ Test DINHEIRO flow (should work as before)
6. ⏳ Test STRIPE flow (end-to-end with test card)

---

## Testing Plan

**Test 1: DINHEIRO (Existing Flow)**
- Select LEAD member
- Configure plan (Plano 3x + Muay Thai + TRIMESTRAL)
- Select DINHEIRO
- Confirm
- ✅ Should activate instantly
- ✅ Member status = ATIVO
- ✅ 2 transactions created (subscription + enrollment fee)
- ✅ Cash session updated

**Test 2: STRIPE (New Flow)**
- Select LEAD member
- Configure plan (same as above)
- Select STRIPE
- Confirm
- ✅ Should redirect to Stripe Checkout
- ✅ Complete payment with `4242 4242 4242 4242`
- ✅ Should redirect to `/staff/enrollment-success?session_id=xxx`
- ✅ Wait for webhook (~3 seconds)
- ✅ Check member status = ATIVO
- ✅ Check 2 transactions created
- ✅ Check subscription record with snapshots

**Test 3: STRIPE Cancel**
- Start STRIPE flow
- Redirect to Stripe
- Click "← Back" button
- ✅ Should redirect to `/staff/enrollment?cancelled=true`
- ✅ Member status should remain LEAD (not activated)

**Test 4: CANCELADO Reactivation**
- Select CANCELADO member
- Configure plan
- Select STRIPE
- ✅ Should charge enrollment fee (staff decides)
- ✅ Member activated after payment

---

**Next:** Implement these changes in the actual file
