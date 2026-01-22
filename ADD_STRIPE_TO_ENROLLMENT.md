# Add Stripe to Enrollment Page
**Quick Integration Guide for `src/pages/staff/Enrollment.tsx`**

---

## 🎯 Goal

Add "Stripe Online Payment" as a payment method option in the Enrollment flow, so staff can generate payment links for new members.

---

## 📝 Changes Required

### Change 1: Update PaymentMethod Type

**File:** `src/pages/staff/Enrollment.tsx` (Line 64)

**Current:**
```typescript
type PaymentMethod = 'DINHEIRO' | 'CARTAO' | 'MBWAY' | 'TRANSFERENCIA';
```

**Change to:**
```typescript
type PaymentMethod = 'DINHEIRO' | 'CARTAO' | 'MBWAY' | 'TRANSFERENCIA' | 'STRIPE';
```

---

### Change 2: Add State for Stripe Checkout

**File:** `src/pages/staff/Enrollment.tsx` (After line 86)

**Add these state variables:**
```typescript
// Stripe checkout state
const [showStripeDialog, setShowStripeDialog] = useState(false);
const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState('');
const [stripeSessionId, setStripeSessionId] = useState('');
```

---

### Change 3: Add Stripe Mutation

**File:** `src/pages/staff/Enrollment.tsx` (After line 417, before `handleMemberSelect`)

**Add this mutation:**
```typescript
// Stripe checkout mutation
const stripeCheckoutMutation = useMutation({
  mutationFn: async () => {
    if (!selectedMember || !staffId) {
      throw new Error('Missing required data');
    }

    // Determine if new member (needs enrollment fee)
    const isNewMember = selectedMember.status === 'LEAD';

    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        customerEmail: selectedMember.email || `${selectedMember.telefone}@temp.boxemaster.com`,
        customerName: selectedMember.nome,
        isNewMember: isNewMember,
        customMetadata: {
          memberId: selectedMember.id,
          planId: pricingMode === 'plan' ? selectedPlan?.id : undefined,
          createdBy: staffId,
          enrollmentFeeCents: enrollmentFeeCents,
          pricingMode: pricingMode,
        },
      },
    });

    if (error) throw error;

    return {
      checkoutUrl: data.checkoutUrl,
      sessionId: data.sessionId,
      expiresAt: data.expiresAt,
    };
  },
  onSuccess: (data) => {
    setStripeCheckoutUrl(data.checkoutUrl);
    setStripeSessionId(data.sessionId);
    setShowStripeDialog(true);
    toast({
      title: 'Link de Pagamento Criado',
      description: 'Envie o link ao membro via WhatsApp',
    });
  },
  onError: (error: Error) => {
    toast({
      title: 'Erro ao criar checkout Stripe',
      description: error.message,
      variant: 'destructive',
    });
  },
});
```

---

### Change 4: Update Payment Confirmation Handler

**File:** `src/pages/staff/Enrollment.tsx` (Line 444, inside `handlePaymentConfirm`)

**Current logic:**
```typescript
const handlePaymentConfirm = async () => {
  if (!paymentMethod) {
    toast({ title: 'Selecione um metodo de pagamento', variant: 'destructive' });
    return;
  }
  setIsProcessing(true);
  try {
    if (paymentMethod === 'TRANSFERENCIA') {
      await pendingPaymentMutation.mutateAsync();
    } else {
      await enrollMutation.mutateAsync();
    }
  } catch (error) {
    // ...
  }
};
```

**Change to:**
```typescript
const handlePaymentConfirm = async () => {
  if (!paymentMethod) {
    toast({ title: 'Selecione um metodo de pagamento', variant: 'destructive' });
    return;
  }
  setIsProcessing(true);
  try {
    if (paymentMethod === 'TRANSFERENCIA') {
      await pendingPaymentMutation.mutateAsync();
    } else if (paymentMethod === 'STRIPE') {
      await stripeCheckoutMutation.mutateAsync();
      // Don't set isSuccess here - wait for payment confirmation from admin
    } else {
      await enrollMutation.mutateAsync();
    }
  } catch (error) {
    console.error('Payment error:', error);
  } finally {
    setIsProcessing(false);
  }
};
```

---

### Change 5: Add Stripe to Payment Method Selector

**File:** `src/pages/staff/Enrollment.tsx` (Line 1001-1004)

**Current:**
```typescript
<SelectContent>
  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
  <SelectItem value="CARTAO">Cartao (TPA)</SelectItem>
  <SelectItem value="MBWAY">MBWay</SelectItem>
  <SelectItem value="TRANSFERENCIA">Transferencia Bancaria</SelectItem>
</SelectContent>
```

**Change to:**
```typescript
<SelectContent>
  <SelectItem value="DINHEIRO">💵 Dinheiro</SelectItem>
  <SelectItem value="CARTAO">💳 Cartão (TPA)</SelectItem>
  <SelectItem value="MBWAY">📱 MBWay</SelectItem>
  <SelectItem value="TRANSFERENCIA">🏦 Transferência Bancária</SelectItem>
  <SelectItem value="STRIPE">🌐 Pagamento Online (Stripe)</SelectItem>
</SelectContent>
```

---

### Change 6: Add Stripe Info Alert (Optional)

**File:** `src/pages/staff/Enrollment.tsx` (After line 1009, after the TRANSFERENCIA alert)

**Add this alert for Stripe:**
```typescript
{paymentMethod === 'STRIPE' && (
  <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
    <div className="flex gap-2">
      <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
          Pagamento Online via Stripe
        </p>
        <p className="text-xs text-blue-800/80 dark:text-blue-200/80">
          Será gerado um link seguro de pagamento. O membro pode pagar com cartão
          ou Klarna. Após o pagamento, confirme em <strong>Admin → Pagamentos Stripe</strong>.
        </p>
      </div>
    </div>
  </div>
)}
```

---

### Change 7: Add Stripe Checkout Dialog

**File:** `src/pages/staff/Enrollment.tsx` (Add at the end, before closing `</DashboardLayout>`)

**Add this dialog component:**
```tsx
{/* Stripe Checkout Dialog */}
<Dialog open={showStripeDialog} onOpenChange={setShowStripeDialog}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>Link de Pagamento Criado</DialogTitle>
      <DialogDescription>
        Envie este link ao membro via WhatsApp. Válido por 24 horas.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4">
      {/* Checkout URL */}
      <div className="space-y-2">
        <Label>Link de Pagamento</Label>
        <div className="flex gap-2">
          <Input
            value={stripeCheckoutUrl}
            readOnly
            className="flex-1 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(stripeCheckoutUrl);
              toast({ title: '✓ Link copiado!' });
            }}
          >
            Copiar
          </Button>
        </div>
      </div>

      {/* Member Summary */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Membro:</span>
          <span className="font-medium">{selectedMember?.nome}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Plano:</span>
          <span className="font-medium">
            {pricingMode === 'plan' ? selectedPlan?.nome : 'Personalizado'}
          </span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span className="text-muted-foreground">Plano:</span>
          <span className="font-medium">
            {new Intl.NumberFormat('pt-PT', {
              style: 'currency',
              currency: 'EUR',
            }).format(finalPriceCents / 100)}
          </span>
        </div>
        {enrollmentFeeCents > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taxa de Matrícula:</span>
            <span className="font-medium">
              {new Intl.NumberFormat('pt-PT', {
                style: 'currency',
                currency: 'EUR',
              }).format(enrollmentFeeCents / 100)}
            </span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between text-base font-semibold">
          <span>Total:</span>
          <span>
            {new Intl.NumberFormat('pt-PT', {
              style: 'currency',
              currency: 'EUR',
            }).format(totalCents / 100)}
          </span>
        </div>
      </div>

      {/* WhatsApp Send Button */}
      <Button
        className="w-full"
        size="lg"
        onClick={() => {
          const phone = selectedMember?.telefone.replace(/\D/g, '');
          const planName = pricingMode === 'plan' ? selectedPlan?.nome : 'plano personalizado';
          const totalFormatted = new Intl.NumberFormat('pt-PT', {
            style: 'currency',
            currency: 'EUR',
          }).format(totalCents / 100);

          const message = `Olá ${selectedMember?.nome}! 👋

Segue o link para pagamento da sua matrícula:

📦 *${planName}*
💶 Valor: *${totalFormatted}*

🔗 Link de pagamento (válido por 24h):
${stripeCheckoutUrl}

Pode pagar com cartão ou Klarna (parcelado).

Qualquer dúvida, estamos à disposição!`;

          const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
          window.open(whatsappUrl, '_blank');

          toast({
            title: 'WhatsApp aberto',
            description: 'Envie a mensagem ao membro',
          });
        }}
      >
        <Phone className="mr-2 h-5 w-5" />
        Enviar via WhatsApp
      </Button>

      {/* Instructions */}
      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
        <p className="font-medium">Próximos passos:</p>
        <ol className="list-decimal list-inside space-y-1 ml-2">
          <li>Envie o link ao membro via WhatsApp</li>
          <li>Membro completa o pagamento online</li>
          <li>Você confirma em <strong>Admin → Pagamentos Stripe</strong></li>
          <li>Membro é ativado automaticamente após confirmação</li>
        </ol>
      </div>

      {/* Close Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setShowStripeDialog(false);
          // Reset and go back to step 1
          setCurrentStep(1);
          setSelectedMember(null);
          setPaymentMethod('');
          setSelectedPlan(null);
          setIsSuccess(false);
        }}
      >
        Concluir
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

Don't forget to import the missing icon:
```typescript
import { Phone } from 'lucide-react'; // Add to existing imports
```

---

### Change 8: Update Success Message

**File:** `src/pages/staff/Enrollment.tsx` (Line 504)

**Current:**
```typescript
{paymentMethod === 'TRANSFERENCIA'
  ? 'Pagamento pendente criado. O membro sera ativado apos confirmacao.'
  : `${selectedMember?.nome} agora tem acesso ao ginasio.`}
```

**Change to:**
```typescript
{paymentMethod === 'TRANSFERENCIA'
  ? 'Pagamento pendente criado. O membro será ativado após confirmação.'
  : paymentMethod === 'STRIPE'
  ? 'Link de pagamento criado e enviado. Confirme após o membro pagar.'
  : `${selectedMember?.nome} agora tem acesso ao ginásio.`}
```

---

### Change 9: Update Button Text

**File:** `src/pages/staff/Enrollment.tsx` (Line 1072)

**Current:**
```typescript
{paymentMethod === 'TRANSFERENCIA' ? 'Registrar Pendente' : 'Confirmar Matricula'}
```

**Change to:**
```typescript
{paymentMethod === 'TRANSFERENCIA'
  ? 'Registrar Pendente'
  : paymentMethod === 'STRIPE'
  ? 'Gerar Link de Pagamento'
  : 'Confirmar Matrícula'}
```

---

## 🗄️ Database Table Required

You need to create the `stripe_payment_ledger` table. Run this migration:

```sql
-- Create stripe_payment_ledger table
CREATE TABLE IF NOT EXISTS stripe_payment_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stripe identifiers
  stripe_session_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_invoice_id TEXT,

  -- Customer info
  customer_email TEXT NOT NULL,
  customer_name TEXT,

  -- Payment details
  amount_total INTEGER NOT NULL, -- cents
  currency TEXT DEFAULT 'eur',
  payment_status TEXT,
  payment_method TEXT,

  -- Product info
  product_type TEXT,
  is_new_member BOOLEAN DEFAULT false,

  -- Matching and confirmation
  matched_member_id UUID REFERENCES members(id),
  auto_matched BOOLEAN DEFAULT false,
  confirmed BOOLEAN DEFAULT false,
  confirmed_by UUID REFERENCES staff(id),
  confirmed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB,
  event_type TEXT NOT NULL,
  event_id TEXT UNIQUE NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_stripe_ledger_confirmed ON stripe_payment_ledger(confirmed);
CREATE INDEX idx_stripe_ledger_email ON stripe_payment_ledger(customer_email);
CREATE INDEX idx_stripe_ledger_member ON stripe_payment_ledger(matched_member_id);

-- RLS
ALTER TABLE stripe_payment_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Staff can view" ON stripe_payment_ledger
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role IN ('ADMIN', 'STAFF')
    )
  );

CREATE POLICY "Service role can insert" ON stripe_payment_ledger
  FOR INSERT TO service_role
  WITH CHECK (true);
```

---

## ✅ Testing Checklist

After implementing:

1. [ ] Enrollment page loads without errors
2. [ ] "Stripe" appears in payment method dropdown
3. [ ] Selecting Stripe shows blue info alert
4. [ ] Clicking "Gerar Link de Pagamento" opens dialog with URL
5. [ ] "Copiar" button copies URL to clipboard
6. [ ] "Enviar via WhatsApp" opens WhatsApp with pre-filled message
7. [ ] Dialog shows correct pricing breakdown
8. [ ] Test with Stripe test card: 4242 4242 4242 4242
9. [ ] Payment appears in webhook logs
10. [ ] Payment appears in Admin > Stripe Payments (you'll need to create this page)

---

## 🚀 Quick Summary

**Files Modified:** 1 file (`src/pages/staff/Enrollment.tsx`)

**Changes:**
- Add `'STRIPE'` to PaymentMethod type
- Add 3 state variables for Stripe dialog
- Add `stripeCheckoutMutation` mutation
- Update `handlePaymentConfirm` logic
- Add Stripe option to payment selector
- Add Stripe info alert
- Add Stripe checkout dialog component
- Update success message
- Update button text

**Database:** Create `stripe_payment_ledger` table (SQL provided)

**Time:** ~1 hour of work

---

## 📝 Next Step

After implementing this, you'll also need to create the **Admin → Stripe Payments** page to confirm payments. See `STRIPE_FRONTEND_INTEGRATION.md` for the full admin page code.

---

**Happy coding!** 🎉
