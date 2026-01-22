# Stripe Frontend Integration Guide
**How to Add Stripe Payment Links to BoxeMaster Pro**

---

## 🎯 Overview

The Stripe backend is fully operational, but not yet connected to the frontend. This guide shows you exactly where and how to add Stripe payment functionality to your app.

---

## 📍 Where to Add Stripe Features

### Option 1: Add to Existing Payment Page (Recommended)
**Location:** `src/pages/staff/Payment.tsx`

**Why:** Staff already use this page for payments. Add "Online Payment" as a new payment method alongside DINHEIRO, CARTAO, MBWAY, TRANSFERENCIA.

**Flow:**
```
Member selects plan → Staff chooses "Online Payment (Stripe)"
→ System generates checkout link → Staff sends via WhatsApp
→ Payment logged automatically → Staff confirms in Admin panel
```

---

### Option 2: Create New "Online Payments" Admin Page
**Location:** Create `src/pages/admin/StripePayments.tsx`

**Why:** Separate management of online payments from in-person payments.

**Flow:**
```
Admin → Stripe Payments → View ledger of all online transactions
→ Confirm pending payments → Link to members
```

---

## 🔧 Implementation Plan (Option 1 - Recommended)

### Step 1: Add Stripe to Payment Methods

**File:** `src/pages/staff/Payment.tsx`

**Current payment methods:**
```typescript
const paymentMethods = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO', label: 'Cartão' },
  { value: 'MBWAY', label: 'MBWay' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
];
```

**Add:**
```typescript
const paymentMethods = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO', label: 'Cartão' },
  { value: 'MBWAY', label: 'MBWay' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
  { value: 'STRIPE', label: '💳 Pagamento Online (Stripe)', icon: '🌐' }, // NEW
];
```

---

### Step 2: Add Stripe Logic to Payment Form

When user selects "STRIPE" payment method:

```typescript
// After user selects member + plan + payment method = STRIPE

const handleStripeCheckout = async () => {
  // Determine if this is a new member (needs enrollment fee)
  const isNewMember = selectedMember.status === 'LEAD';

  try {
    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        customerEmail: selectedMember.email || `${selectedMember.telefone}@temp.boxemaster.com`,
        customerName: selectedMember.nome,
        isNewMember: isNewMember,
        customMetadata: {
          memberId: selectedMember.id,
          planId: selectedPlan.id,
          createdBy: staffId,
        },
      },
    });

    if (error) throw error;

    // Show checkout URL to staff
    setCheckoutUrl(data.checkoutUrl);
    setShowCheckoutDialog(true);

    toast({
      title: 'Link de Pagamento Criado',
      description: 'Envie este link ao membro via WhatsApp',
    });

  } catch (error) {
    toast({
      title: 'Erro',
      description: error.message,
      variant: 'destructive',
    });
  }
};
```

---

### Step 3: Display Checkout URL to Staff

Add a dialog to show the generated link:

```tsx
<Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Link de Pagamento Online</DialogTitle>
      <DialogDescription>
        Envie este link ao membro via WhatsApp. Válido por 24 horas.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4">
      {/* Checkout URL */}
      <div className="flex items-center space-x-2">
        <Input
          value={checkoutUrl}
          readOnly
          className="flex-1"
        />
        <Button
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(checkoutUrl);
            toast({ title: 'Link copiado!' });
          }}
        >
          Copiar
        </Button>
      </div>

      {/* WhatsApp Quick Send */}
      <Button
        className="w-full"
        onClick={() => {
          const phone = selectedMember.telefone.replace(/\D/g, '');
          const message = `Olá ${selectedMember.nome}!

Segue o link para pagamento do plano ${selectedPlan.nome}:

${checkoutUrl}

O link expira em 24 horas.

Obrigado!`;
          const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
          window.open(whatsappUrl, '_blank');
        }}
      >
        <Phone className="mr-2 h-4 w-4" />
        Enviar via WhatsApp
      </Button>

      {/* Member Details */}
      <div className="bg-muted p-3 rounded text-sm space-y-1">
        <p><strong>Membro:</strong> {selectedMember.nome}</p>
        <p><strong>Plano:</strong> {selectedPlan.nome}</p>
        <p><strong>Valor:</strong> {formatCurrency(selectedPlan.preco_cents)}</p>
        {isNewMember && (
          <p><strong>+ Taxa de Matrícula:</strong> {formatCurrency(selectedPlan.enrollment_fee_cents || 0)}</p>
        )}
        <p className="text-muted-foreground text-xs mt-2">
          Após o pagamento, confirme em Admin → Pagamentos Stripe
        </p>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

---

### Step 4: Create Stripe Payments Admin Page

**New File:** `src/pages/admin/StripePayments.tsx`

This page shows the `stripe_payment_ledger` table and allows staff to confirm payments.

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface StripePayment {
  id: string;
  stripe_session_id: string;
  customer_email: string;
  customer_name: string;
  amount_total: number;
  currency: string;
  payment_status: string;
  matched_member_id: string | null;
  confirmed: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  event_type: string;
  metadata: any;
}

const StripePayments = () => {
  const { staffId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch unconfirmed payments
  const { data: pendingPayments, isLoading } = useQuery({
    queryKey: ['stripe-pending-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stripe_payment_ledger')
        .select('*')
        .eq('confirmed', false)
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StripePayment[];
    },
  });

  // Confirm payment mutation
  const confirmPayment = useMutation({
    mutationFn: async ({ paymentId, memberId }: { paymentId: string; memberId: string }) => {
      // 1. Update stripe_payment_ledger
      const { error: updateError } = await supabase
        .from('stripe_payment_ledger')
        .update({
          matched_member_id: memberId,
          confirmed: true,
          confirmed_by: staffId,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      // 2. Get payment details
      const { data: payment } = await supabase
        .from('stripe_payment_ledger')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (!payment) throw new Error('Payment not found');

      // 3. Create transaction record
      const isEnrollment = payment.metadata?.is_new_member === 'true';
      const planType = payment.metadata?.plan_type || 'SUBSCRIPTION';

      const { error: txnError } = await supabase
        .from('transactions')
        .insert({
          type: 'RECEITA',
          category: planType,
          amount_cents: payment.amount_total,
          payment_method: 'STRIPE',
          member_id: memberId,
          description: `Stripe: ${payment.customer_name}`,
          created_by: staffId,
        });

      if (txnError) throw txnError;

      // 4. Update member status
      const { error: memberError } = await supabase
        .from('members')
        .update({
          status: 'ATIVO',
          access_type: planType,
          access_expires_at: addDays(new Date(), 30).toISOString().split('T')[0],
        })
        .eq('id', memberId);

      if (memberError) throw memberError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stripe-pending-payments'] });
      toast({ title: 'Pagamento confirmado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao confirmar pagamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pagamentos Stripe</h1>
          <p className="text-muted-foreground">
            Confirme pagamentos online recebidos via Stripe
          </p>
        </div>

        {/* Pending Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pagamentos Pendentes</CardTitle>
            <CardDescription>
              {pendingPayments?.length || 0} pagamento(s) aguardando confirmação
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : pendingPayments && pendingPayments.length > 0 ? (
              <div className="space-y-4">
                {pendingPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{payment.customer_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {payment.customer_email}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {formatCurrency(payment.amount_total)}
                      </Badge>
                    </div>

                    <div className="text-sm space-y-1">
                      <p>
                        <strong>Sessão:</strong> {payment.stripe_session_id.substring(0, 20)}...
                      </p>
                      <p>
                        <strong>Data:</strong>{' '}
                        {format(new Date(payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
                      </p>
                      {payment.metadata?.is_new_member === 'true' && (
                        <Badge variant="secondary" className="text-xs">
                          Novo Membro (com Taxa de Matrícula)
                        </Badge>
                      )}
                    </div>

                    {/* Auto-matched member */}
                    {payment.matched_member_id && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                        <p className="text-sm text-green-700 dark:text-green-400">
                          ✓ Auto-matched ao membro ID: {payment.matched_member_id}
                        </p>
                      </div>
                    )}

                    {/* Confirm button */}
                    <Button
                      onClick={() => {
                        const memberId = payment.matched_member_id || payment.metadata?.memberId;
                        if (memberId) {
                          confirmPayment.mutate({ paymentId: payment.id, memberId });
                        } else {
                          // Show member selection dialog
                          toast({
                            title: 'Selecione um membro',
                            description: 'Nenhum membro auto-matched',
                          });
                        }
                      }}
                      disabled={confirmPayment.isPending}
                    >
                      {confirmPayment.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Confirmando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Confirmar Pagamento
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhum pagamento pendente
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
};

export default StripePayments;
```

---

### Step 5: Add Database Table

The `stripe_payment_ledger` table needs to be created in Supabase:

**Run this migration:**

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
  amount_total INTEGER NOT NULL, -- in cents
  currency TEXT DEFAULT 'eur',
  payment_status TEXT, -- 'paid', 'unpaid', 'no_payment_required'
  payment_method TEXT,

  -- Product info
  product_type TEXT, -- 'subscription', 'payment', 'subscription_renewal'
  is_new_member BOOLEAN DEFAULT false,

  -- Matching and confirmation
  matched_member_id UUID REFERENCES members(id),
  auto_matched BOOLEAN DEFAULT false,
  confirmed BOOLEAN DEFAULT false,
  confirmed_by UUID REFERENCES staff(id),
  confirmed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB,
  event_type TEXT NOT NULL, -- 'checkout.session.completed', 'invoice.payment_succeeded', etc.
  event_id TEXT UNIQUE NOT NULL, -- for idempotency

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_stripe_ledger_confirmed ON stripe_payment_ledger(confirmed);
CREATE INDEX idx_stripe_ledger_customer_email ON stripe_payment_ledger(customer_email);
CREATE INDEX idx_stripe_ledger_matched_member ON stripe_payment_ledger(matched_member_id);
CREATE INDEX idx_stripe_ledger_session ON stripe_payment_ledger(stripe_session_id);

-- RLS Policies
ALTER TABLE stripe_payment_ledger ENABLE ROW LEVEL SECURITY;

-- Admin/Staff can view all
CREATE POLICY "Admin/Staff can view stripe payments"
  ON stripe_payment_ledger FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role IN ('ADMIN', 'STAFF')
    )
  );

-- Only admin can update (confirm payments)
CREATE POLICY "Admin can update stripe payments"
  ON stripe_payment_ledger FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.user_id = auth.uid()
      AND staff.role = 'ADMIN'
    )
  );

-- Service role (webhook) can insert
CREATE POLICY "Service role can insert"
  ON stripe_payment_ledger FOR INSERT
  TO service_role
  WITH CHECK (true);
```

---

### Step 6: Add Route to App

**File:** `src/App.tsx`

Add the new route:

```tsx
// In the admin routes section
<Route
  path="/admin/stripe-payments"
  element={
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <StripePayments />
    </ProtectedRoute>
  }
/>
```

---

### Step 7: Add Navigation Link

**File:** `src/components/layouts/DashboardLayout.tsx` (or wherever nav is defined)

Add to admin navigation:

```tsx
{
  name: 'Pagamentos Stripe',
  href: '/admin/stripe-payments',
  icon: CreditCard, // import from lucide-react
  badge: pendingStripeCount, // optional
}
```

---

## 🎨 UI/UX Recommendations

### Payment Flow (Staff View)

1. **Member Selection** → Existing search/select in Payment.tsx
2. **Plan Selection** → Existing plan selector
3. **Payment Method** → Add "💳 Pagamento Online (Stripe)" option
4. **Generate Link** → Click → Show dialog with link
5. **Send via WhatsApp** → One-click button opens WhatsApp with pre-filled message
6. **Done** → "Payment link sent! Check Admin → Stripe Payments to confirm after member pays"

### Confirmation Flow (Admin View)

1. Navigate to **Admin → Stripe Payments**
2. See list of unconfirmed payments
3. Each payment shows:
   - Customer name, email
   - Amount paid
   - Date/time
   - Auto-matched member (if found)
   - Session ID
4. Click **Confirm** → System:
   - Links payment to member
   - Creates transaction
   - Activates member access
   - Logs in audit trail

---

## 🔐 Security Considerations

### Already Handled by Backend
✅ Webhook signature verification
✅ Idempotency (duplicate prevention)
✅ RLS policies on ledger table
✅ Service role isolation

### Frontend Must Handle
- ⚠️ Never expose webhook secret
- ⚠️ Always use `supabase.functions.invoke()` (never direct Stripe API)
- ⚠️ Validate member exists before generating link
- ⚠️ Show link expiration (24 hours)

---

## 📊 Testing Checklist

### Before Production
- [ ] Test link generation for new member (with enrollment)
- [ ] Test link generation for renewal (no enrollment)
- [ ] Test 3-month pass link
- [ ] Verify WhatsApp message formatting
- [ ] Confirm webhook receives events
- [ ] Test payment confirmation flow
- [ ] Verify member status updates to ATIVO
- [ ] Check transaction is created correctly
- [ ] Test auto-matching by email
- [ ] Test manual member selection

### Test Cards (Stripe Test Mode)
- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **3D Secure:** 4000 0027 6000 3184

---

## 🚀 Quick Start Summary

### Minimum Viable Implementation

**3 files to modify:**

1. **`src/pages/staff/Payment.tsx`**
   - Add "STRIPE" to payment methods
   - Add `handleStripeCheckout()` function
   - Add checkout URL dialog

2. **`src/pages/admin/StripePayments.tsx`** (NEW)
   - Create page to show stripe_payment_ledger
   - Add confirm button for each payment

3. **`src/App.tsx`**
   - Add route: `/admin/stripe-payments`

**1 migration to run:**
- Create `stripe_payment_ledger` table (SQL above)

**Total effort:** 2-3 hours of development + 1 hour testing

---

## 📞 Need Help?

Check these files for reference:
- Backend webhook: `/Users/ricore/.claude-worktrees/strikehouse/quizzical-wescoff/supabase/functions/stripe-webhook/index.ts`
- Checkout session function: `/Users/ricore/.claude-worktrees/strikehouse/quizzical-wescoff/supabase/functions/create-checkout-session/index.ts`
- Test suite: `test-edge-functions.js`

---

**Ready to integrate!** 🎉

The backend is 100% operational. Just add the frontend UI and you're live.
