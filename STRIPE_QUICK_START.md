# Stripe Integration - Quick Start Guide
**BoxeMaster Pro** | For Developers & Staff

---

## 🎯 TL;DR - It's Working!

✅ **Status:** All 4 Stripe Edge Functions are deployed and operational
✅ **Test Passed:** 4/4 endpoints verified
✅ **Ready for:** Staff training and production deployment

---

## 🚀 Quick Test

Run this to verify everything is working:

```bash
node test-edge-functions.js
```

**Expected Output:**
```
✅ Subscription Checkout: Session created
✅ One-Time Checkout: Session created
✅ Webhook Endpoint: Active
✅ Portal Session: Active
📊 Results: 4/4 endpoints functional
```

---

## 💳 Payment Types Available

### 1. **Recurring Membership** (Subscription)
- Monthly billing
- Automatic renewals
- Includes enrollment fee for new members

**Use For:**
- New member signup (with enrollment fee)
- Existing member renewal (no enrollment fee)

**Endpoint:** `create-checkout-session`

---

### 2. **3-Month Pass** (One-Time)
- Single payment, no recurring charges
- 90-day unlimited access
- Supports Klarna payment

**Use For:**
- Members who don't want subscriptions
- Trial periods
- Special promotions

**Endpoint:** `create-onetime-checkout`

---

### 3. **Enrollment Fee Only** (One-Time)
- Just the signup fee
- No membership included

**Use For:**
- Rare - usually enrollment comes with first month

**Endpoint:** `create-onetime-checkout` with `productType: 'enrollment_only'`

---

## 📋 Staff Workflow (Summary)

### Creating Payment Links

```
1. Admin dashboard → Members → Select member
2. Click "Generate Payment Link"
3. Choose:
   - New member (enrollment + subscription)
   - Renewal (subscription only)
   - 3-month pass (one-time)
4. System generates private Stripe Checkout URL
5. Send link to member via WhatsApp
6. Member pays online
7. Payment appears in Admin > Pending Payments
8. Staff reviews and confirms
9. Member access activated
```

### Confirming Payments

```
1. Admin > Pending Payments
2. System shows:
   - Payment amount
   - Customer email
   - Auto-matched member (if found)
3. Staff verifies match or selects correct member
4. Click "Confirm"
5. System:
   - Creates transaction record
   - Updates member status to ATIVO
   - Sets access expiration date
6. Member can now check in
```

---

## 🔧 For Developers

### Available Functions

| Function | URL | Purpose |
|----------|-----|---------|
| `create-checkout-session` | `/functions/v1/create-checkout-session` | Recurring subscriptions |
| `create-onetime-checkout` | `/functions/v1/create-onetime-checkout` | One-time payments |
| `create-portal-session` | `/functions/v1/create-portal-session` | Customer billing portal |
| `stripe-webhook` | `/functions/v1/stripe-webhook` | Payment event handler |

### Example: Create Subscription Checkout

```javascript
const { data, error } = await supabase.functions.invoke('create-checkout-session', {
  body: {
    customerEmail: 'member@example.com',
    customerName: 'João Silva',
    isNewMember: true, // false for renewals
    customMetadata: {
      memberId: 'abc-123',
    },
  },
});

if (data) {
  const checkoutUrl = data.checkoutUrl; // Send this via WhatsApp
  const sessionId = data.sessionId;
  const expiresAt = data.expiresAt; // Unix timestamp (24 hours)
}
```

### Example: Create 3-Month Pass

```javascript
const { data, error } = await supabase.functions.invoke('create-onetime-checkout', {
  body: {
    customerEmail: 'member@example.com',
    customerName: 'João Silva',
    productType: '3_month_pass',
    customMetadata: {
      memberId: 'abc-456',
    },
  },
});

if (data) {
  const checkoutUrl = data.checkoutUrl;
  const productName = data.productName; // "3-Month Pass"
}
```

### Example: Create Portal Link

```javascript
const { data, error } = await supabase.functions.invoke('create-portal-session', {
  body: {
    customerEmail: 'member@example.com',
  },
});

if (data) {
  const portalUrl = data.portalUrl; // Customer can manage subscription
  const customerId = data.customerId; // Stripe customer ID
}
```

---

## 🔐 Security Notes

### Webhook Protection
- All events verified with signature
- Invalid signatures rejected automatically
- No manual verification needed

### Payment Flow
1. Link generated with unique session ID
2. Expires after 24 hours
3. Can only be used once
4. Staff must manually confirm before access granted

### Data Privacy
- Card data never touches our servers
- All payment processing on Stripe
- PCI compliance handled by Stripe
- We only store: amount, email, status

---

## 🗄️ Database Tables

### `stripe_payment_ledger`
**Purpose:** Immutable log of all Stripe events

**Auto-populated by:** Webhook function

**Key Fields:**
- `stripe_session_id` - Unique checkout session
- `customer_email` - Who paid
- `amount_total` - Amount in cents
- `payment_status` - 'paid', 'open', etc.
- `matched_member_id` - Auto-matched member (may be null)
- `confirmed` - Staff confirmed (default false)

**Staff Action Required:**
- Review new entries daily
- Verify auto-match is correct
- Confirm to activate member access

---

## 🐛 Troubleshooting

### "No customer found" Error
**Cause:** Member hasn't paid yet via Stripe
**Solution:** Generate new checkout link

### "Session expired" Error
**Cause:** Checkout link older than 24 hours
**Solution:** Generate fresh link

### Payment Not Appearing
**Check:**
1. Webhook is receiving events (Stripe Dashboard > Webhooks)
2. `stripe_payment_ledger` table has new row
3. Email matches member record

### Auto-Match Not Working
**Cause:** Email in Stripe ≠ email in `members` table
**Solution:** Manually select correct member when confirming

---

## 📊 Monitoring

### What to Check Daily
- [ ] Pending payments in admin dashboard
- [ ] Failed webhook deliveries (Stripe Dashboard)
- [ ] Payment success rate
- [ ] Member access activations

### Where to Look
- **Admin Dashboard:** Pending Payments tab
- **Stripe Dashboard:** Payments, Webhooks sections
- **Database:** `stripe_payment_ledger` table
- **Supabase Logs:** Edge Function execution logs

---

## 🎓 Staff Training Checklist

Before using in production, staff should:
- [ ] Understand 3 payment types (subscription, pass, enrollment)
- [ ] Practice generating checkout links
- [ ] Know how to send links via WhatsApp
- [ ] Understand auto-matching logic
- [ ] Practice confirming payments
- [ ] Know how to handle mismatches
- [ ] Understand 24-hour link expiration

---

## 🚦 Going to Production

### Current Status: TEST MODE
All payments use test credit cards. No real money processed.

### To Enable Live Payments:
1. Get production Stripe API keys
2. Update Supabase secrets:
   ```bash
   npx supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```
3. Update webhook endpoint in Stripe Dashboard
4. Test with real card (small amount)
5. Monitor first week closely

### Test Cards (for testing only)
- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **3D Secure:** 4000 0027 6000 3184

---

## 📞 Get Help

**Integration Issues:**
- Read: `STRIPE_INTEGRATION_STATUS.md` (detailed report)
- Check: Supabase Edge Function logs
- Review: `supabase/functions/stripe-webhook/index.ts`

**Stripe Account Issues:**
- Dashboard: https://dashboard.stripe.com
- Support: https://support.stripe.com

**BoxeMaster Specific:**
- Check: `CLAUDE.md` for project patterns
- Check: `spec.md` for business rules

---

**Ready to Go!** 🎉

All systems tested and operational. Train your staff and start processing payments.
