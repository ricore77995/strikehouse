# Enrollment Page Refactor Plan

## Current State Analysis

**File:** `src/pages/staff/Enrollment.tsx` (1080 lines)

**Current Flow:**
1. **Step 1:** Select/Create Member (LEAD or CANCELADO)
2. **Step 2:** Configure Pricing
   - Mode A: Select pre-defined plan
   - Mode B: Custom (select modalities + commitment + promo code)
3. **Step 3:** Select Payment Method
   - DINHEIRO / CARTAO / MBWAY → Instant activation
   - TRANSFERENCIA → Create pending_payment

**Current Architecture:**
- Uses local `usePricing` hook for calculations
- Creates `subscriptions` record directly in Supabase
- Creates 1 or 2 `transactions` records
- Updates `member` status to ATIVO
- Increments promo code usage locally

**Problems:**
1. ❌ No Stripe integration (payment confirmation relies on staff honesty)
2. ❌ Pricing calculated client-side (can be manipulated)
3. ❌ CARTAO doesn't actually charge card (just marks as paid)
4. ❌ No idempotency for promo codes
5. ❌ No audit trail with pricing snapshots

---

## Target State (After Refactor)

**New Flow for CARTAO (Stripe Checkout):**
1. **Step 1:** Select/Create Member (same)
2. **Step 2:** Configure Pricing (same UI)
3. **Step 3:** Select Payment Method
   - **CARTAO** → Redirect to Stripe Checkout ✨ NEW
   - **DINHEIRO / MBWAY** → Instant activation (same)
   - **TRANSFERENCIA** → Pending payment (same)

**Flow Diagram (CARTAO):**
```
[Step 3: Select CARTAO]
         ↓
[Call createCheckoutSession API]
         ↓
[Redirect to Stripe Checkout]
         ↓
[User pays with card]
         ↓
[Stripe webhook activates member]
         ↓
[Redirect to success page: /staff/enrollment-success?session_id=xxx]
```

**New Architecture for CARTAO:**
- ✅ Call `createCheckoutSession()` from `src/api/stripe.ts`
- ✅ Pricing calculated server-side (pricing engine)
- ✅ Stripe charges actual card
- ✅ Webhook handles activation (idempotent)
- ✅ Audit trail with snapshots

**Keep Existing Logic for Other Methods:**
- ✅ DINHEIRO / MBWAY / TRANSFERENCIA use current flow (no Stripe)
- ✅ Instant activation for cash/mbway
- ✅ Pending payment for transferencia

---

## Refactor Strategy

### Phase 1: Minimal Changes (Low Risk)

**Goal:** Add Stripe Checkout for CARTAO without breaking existing flows.

**Changes:**
1. Import `createCheckoutSession` from `src/api/stripe.ts`
2. Modify `handlePaymentConfirm()`:
   - If `paymentMethod === 'CARTAO'` → Call Stripe API + redirect
   - Else → Keep existing logic (no changes)
3. Create new success page: `src/pages/staff/EnrollmentSuccess.tsx`
4. Add loading state during Stripe redirect

**What stays the same:**
- Step 1 (Member selection)
- Step 2 (Pricing configuration)
- Step 3 UI (payment method selector)
- DINHEIRO / MBWAY / TRANSFERENCIA logic

**Risk:** Low (additive change, doesn't touch existing flows)

### Phase 2: Extract Components (Refactor for Maintainability)

**Goal:** Reduce file size, improve testability.

**Extract:**
1. `<MemberSearch>` component (Step 1 search tab)
2. `<MemberCreate>` component (Step 1 create tab)
3. `<PricingBreakdown>` component (reusable price display)
4. `<PaymentMethodSelector>` component (Step 3)

**Benefits:**
- Smaller files (200-300 lines each)
- Reusable components
- Easier to test
- Better separation of concerns

**Risk:** Medium (requires testing all flows after extraction)

### Phase 3: Migrate to Server-Side Pricing (Future)

**Goal:** Remove local pricing hook, use Edge Function for all methods.

**Changes:**
- Remove `usePricing` hook
- Call Edge Function for price preview (read-only)
- Use Edge Function pricing for all payment methods

**Benefits:**
- Single source of truth (backend)
- No client-side manipulation
- Consistent pricing across all flows

**Risk:** High (breaks existing flows, requires full regression testing)

---

## Implementation Plan (Phase 1 Only)

### Task 1: Add Stripe Integration to Enrollment Page

**File:** `src/pages/staff/Enrollment.tsx`

**Changes:**
```typescript
// Add import
import { createCheckoutSession, shouldUseStripeCheckout } from '@/api/stripe';

// Modify handlePaymentConfirm
const handlePaymentConfirm = async () => {
  if (!paymentMethod) {
    toast({ title: 'Selecione um método de pagamento', variant: 'destructive' });
    return;
  }

  setIsProcessing(true);

  try {
    // NEW: Stripe Checkout for CARTAO
    if (shouldUseStripeCheckout(paymentMethod)) {
      await handleStripeCheckout();
    }
    // EXISTING: Other payment methods
    else if (paymentMethod === 'TRANSFERENCIA') {
      await pendingPaymentMutation.mutateAsync();
    } else {
      await enrollMutation.mutateAsync();
    }
  } finally {
    setIsProcessing(false);
  }
};

// NEW: Stripe Checkout handler
const handleStripeCheckout = async () => {
  if (!selectedMember || !staffId) return;

  // Build input based on pricing mode
  const input = {
    memberId: selectedMember.id,
    memberEmail: selectedMember.email || `${selectedMember.telefone}@temp.com`,
    memberName: selectedMember.nome,
    memberStatus: selectedMember.status as 'LEAD' | 'BLOQUEADO' | 'CANCELADO',
    planId: pricingMode === 'plan' ? selectedPlan!.id : 'custom-plan-id', // TODO
    modalityIds: pricingMode === 'plan' ? selectedPlan!.modalities || [] : pricing.selectedModalities,
    commitmentPeriod: mapCommitmentMonthsToPeriod(
      pricingMode === 'plan' ? selectedPlan!.commitment_months : pricing.selectedCommitmentMonths
    ),
    promoCodeId: pricing.promoCode ? 'promo-id' : undefined, // TODO: Get actual ID
    chargeEnrollmentFee: selectedMember.status === 'CANCELADO' ? true : undefined,
    staffId: staffId,
  };

  const result = await createCheckoutSession(input);

  if (result.success) {
    // Redirect to Stripe Checkout
    window.location.href = result.checkoutUrl;
  } else {
    toast({
      title: 'Erro ao criar checkout',
      description: result.message || result.error,
      variant: 'destructive',
    });
  }
};
```

### Task 2: Create EnrollmentSuccess Page

**File:** `src/pages/staff/EnrollmentSuccess.tsx`

**Purpose:** Handle redirect after Stripe Checkout success.

```typescript
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/layouts/DashboardLayout';

const EnrollmentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');

  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // Optional: Verify session status via API
    // For now, just assume success
    setTimeout(() => setIsVerifying(false), 1000);
  }, [sessionId]);

  if (isVerifying) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto p-6 lg:p-8">
        <Card className="border-green-500/50 bg-green-500/5">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Pagamento Confirmado!</CardTitle>
            <CardDescription>
              O membro será ativado automaticamente após confirmação do Stripe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-secondary/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Session ID:</p>
              <p className="text-sm font-mono">{sessionId}</p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => navigate('/staff/checkin')} className="flex-1">
                Ir para Check-in
              </Button>
              <Button onClick={() => navigate('/staff/enrollment')} className="flex-1 bg-accent hover:bg-accent/90">
                Nova Matrícula
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default EnrollmentSuccess;
```

### Task 3: Add Route for Success Page

**File:** `src/App.tsx`

Add route:
```typescript
<Route path="/staff/enrollment-success" element={<ProtectedRoute allowedRoles={['STAFF', 'ADMIN', 'OWNER']}><EnrollmentSuccess /></ProtectedRoute>} />
```

### Task 4: Update Payment Method Description

**File:** `src/pages/staff/Enrollment.tsx`

Update CARTAO description in Step 3:
```typescript
<SelectItem value="CARTAO">
  Cartão (Stripe Checkout) {/* Updated */}
</SelectItem>
```

Add info banner for CARTAO:
```typescript
{paymentMethod === 'CARTAO' && (
  <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
    <div className="flex gap-2">
      <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-semibold text-blue-600 mb-1">Stripe Checkout</p>
        <p className="text-muted-foreground">
          Você será redirecionado para o Stripe para completar o pagamento com segurança.
        </p>
      </div>
    </div>
  </div>
)}
```

---

## Testing Checklist

### Manual Testing (After Implementation)

**Test 1: CARTAO (Stripe Checkout) - LEAD**
- [ ] Select LEAD member
- [ ] Configure plan (with promo code)
- [ ] Select CARTAO
- [ ] Should redirect to Stripe Checkout
- [ ] Complete payment with test card `4242 4242 4242 4242`
- [ ] Should redirect to `/staff/enrollment-success?session_id=xxx`
- [ ] Verify member status = ATIVO (after webhook)
- [ ] Verify 2 transactions created

**Test 2: CARTAO (Stripe Checkout) - CANCELADO**
- [ ] Select CANCELADO member
- [ ] Configure plan
- [ ] Select CARTAO
- [ ] Should redirect to Stripe Checkout
- [ ] Complete payment
- [ ] Verify member status = ATIVO

**Test 3: DINHEIRO (Existing Flow - No Changes)**
- [ ] Select LEAD member
- [ ] Configure plan
- [ ] Select DINHEIRO
- [ ] Should activate instantly (no redirect)
- [ ] Verify member status = ATIVO

**Test 4: TRANSFERENCIA (Existing Flow - No Changes)**
- [ ] Select LEAD member
- [ ] Configure plan
- [ ] Select TRANSFERENCIA
- [ ] Should create pending_payment
- [ ] Verify member status = LEAD (not activated yet)

**Test 5: Cancel Stripe Checkout**
- [ ] Start CARTAO flow
- [ ] Redirect to Stripe
- [ ] Click "Back" button
- [ ] Should redirect to `/staff/enrollment?cancelled=true`
- [ ] Member status should remain LEAD

---

## Migration Notes

### Breaking Changes
**None** - This is an additive change. Existing flows remain unchanged.

### Deployment Order
1. Deploy backend (Edge Functions + migrations)
2. Deploy frontend (with Stripe integration)
3. Configure Stripe webhook in dashboard
4. Test with test mode
5. Switch to production mode

### Rollback Plan
If Stripe integration has issues:
1. Change `shouldUseStripeCheckout('CARTAO')` to return `false`
2. CARTAO will fall back to instant activation (existing logic)
3. No data loss, no downtime

---

## Future Improvements (Phase 2/3)

1. **Extract Components:**
   - `<PricingBreakdown>` for reuse in other pages
   - `<MemberSearch>` for cleaner code
   - `<PaymentMethodSelector>` for better testability

2. **Migrate All Methods to Server-Side:**
   - Remove local pricing hook
   - Use Edge Function for price preview (GET endpoint)
   - Single source of truth

3. **Add Stripe Customer Portal:**
   - Allow members to manage their own subscriptions
   - Cancel, update payment method, etc.

4. **Add Invoice Generation:**
   - PDF invoices for all transactions
   - Email delivery

---

**Status:** Ready to implement Phase 1 (minimal changes, low risk)
**Estimated Time:** 2-3 hours
**Next Step:** Implement Task 1 (Add Stripe integration to handlePaymentConfirm)
