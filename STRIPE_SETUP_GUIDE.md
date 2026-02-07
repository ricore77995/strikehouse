# Stripe Integration Setup Guide

Complete guide to set up Stripe payments for BoxeMaster Pro.

## Overview

This guide will help you:
1. Apply the database migration
2. Deploy Edge Functions
3. Configure Stripe environment variables
4. Register webhooks
5. Test the complete flow

---

## Step 1: Apply Database Migration

### Via Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/cgdshqmqsqwgwpjfmesr/sql
2. Copy the entire contents of `supabase/migrations/20260121_create_stripe_payment_ledger.sql`
3. Paste into the SQL Editor
4. Click "Run"
5. Verify success by running:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_name = 'stripe_payment_ledger';
   ```

### Via Supabase CLI (Alternative)

```bash
# Link project first
npx supabase link --project-ref cgdshqmqsqwgwpjfmesr

# Apply migrations
npx supabase db push
```

---

## Step 2: Deploy Edge Functions

### Prerequisites

- Supabase CLI installed: `npm install -g supabase`
- Project linked (from Step 1)

### Deploy Commands

```bash
# Deploy create-checkout-session
npx supabase functions deploy create-checkout-session --project-ref cgdshqmqsqwgwpjfmesr

# Deploy stripe-webhook
npx supabase functions deploy stripe-webhook --project-ref cgdshqmqsqwgwpjfmesr
```

### Verify Deployment

```bash
npx supabase functions list --project-ref cgdshqmqsqwgwpjfmesr
```

Expected output:
```
Functions:
  - create-checkout-session
  - stripe-webhook
```

---

## Step 3: Get Stripe API Keys

### 1. Stripe Secret Key

1. Go to: https://dashboard.stripe.com/test/apikeys
2. Copy the "Secret key" (starts with `sk_test_`)
3. Keep this secure - never commit to git

### 2. Create Stripe Products

Create products in Stripe Dashboard: https://dashboard.stripe.com/test/products

#### Monthly Membership Product

1. Click "Add product"
2. Name: `Monthly Membership`
3. Billing: **Recurring** → Monthly
4. Price: €69.00 (or your price)
5. Click "Save product"
6. Copy the **Price ID** (starts with `price_`)

#### Enrollment Fee Product

1. Click "Add product"
2. Name: `Enrollment Fee`
3. Billing: **One-time**
4. Price: €25.00 (or your price)
5. Click "Save product"
6. Copy the **Price ID** (starts with `price_`)

---

## Step 4: Set Environment Variables

Set all Stripe secrets in Supabase:

```bash
# Stripe API Secret Key
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE --project-ref cgdshqmqsqwgwpjfmesr

# Stripe Price IDs (from Step 3)
npx supabase secrets set STRIPE_PRICE_MONTHLY_MEMBERSHIP=price_YOUR_MONTHLY_PRICE_ID --project-ref cgdshqmqsqwgwpjfmesr
npx supabase secrets set STRIPE_PRICE_ENROLLMENT=price_YOUR_ENROLLMENT_PRICE_ID --project-ref cgdshqmqsqwgwpjfmesr

# Site URL for redirects
npx supabase secrets set SITE_URL=http://localhost:8080 --project-ref cgdshqmqsqwgwpjfmesr

# Webhook secret (will set after Step 5)
# npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref cgdshqmqsqwgwpjfmesr
```

### Verify Secrets

```bash
npx supabase secrets list --project-ref cgdshqmqsqwgwpjfmesr
```

Expected output:
```
STRIPE_SECRET_KEY
STRIPE_PRICE_MONTHLY_MEMBERSHIP
STRIPE_PRICE_ENROLLMENT
SITE_URL
```

---

## Step 5: Register Webhook in Stripe

### 1. Create Webhook Endpoint

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. **Endpoint URL**:
   ```
   https://cgdshqmqsqwgwpjfmesr.supabase.co/functions/v1/stripe-webhook
   ```
4. **Events to send**: Select these events:
   - `checkout.session.completed` ✓
   - `invoice.payment_succeeded` ✓
   - `customer.subscription.deleted` ✓
5. Click "Add endpoint"

### 2. Get Signing Secret

1. Click on your newly created endpoint
2. In the "Signing secret" section, click "Reveal"
3. Copy the secret (starts with `whsec_`)
4. Set it in Supabase:
   ```bash
   npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE --project-ref cgdshqmqsqwgwpjfmesr
   ```

### 3. Test Webhook

Send a test event from Stripe Dashboard:
1. On the webhook page, click "Send test webhook"
2. Select `checkout.session.completed`
3. Click "Send test webhook"
4. Verify response shows "200 OK"

---

## Step 6: Test the Complete Flow

### 1. Start Development Server

```bash
make dev
# or
npm run dev
```

### 2. Test Enrollment Flow

1. **Login as STAFF or ADMIN**
   - Go to: http://localhost:8080/login
   - Use your staff credentials

2. **Navigate to Enrollment**
   - Go to: http://localhost:8080/staff/enrollment

3. **Create/Select LEAD Member**
   - Search for existing LEAD member, or
   - Create new member first at `/staff/members/new`

4. **Select a Plan**
   - Choose any plan from the list
   - Enrollment fee should display automatically

5. **Choose Stripe Payment**
   - Click "🌐 Pagamento Online (Stripe)"
   - Click "Gerar Link de Pagamento"

6. **Verify Dialog Shows**
   - Should see checkout URL
   - "Copiar Link" button
   - "Enviar via WhatsApp" button

7. **Copy Link and Open in Browser**
   - Click "Copiar Link"
   - Open in new tab
   - Stripe Checkout page should load

8. **Complete Test Payment**
   - Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/30)
   - CVC: Any 3 digits (e.g., 123)
   - Fill in email and name
   - Click "Pay"

9. **Check Webhook Delivery**
   - Go to: https://dashboard.stripe.com/test/webhooks
   - Click your webhook endpoint
   - Verify `checkout.session.completed` event shows "✓ Succeeded"

10. **Verify Payment in Ledger**
    - Go to Supabase Dashboard → Table Editor
    - Open `stripe_payment_ledger` table
    - Verify new row exists with:
      - `payment_status`: paid
      - `confirmed`: false
      - `matched_member_id`: (should be auto-matched if email matches)

11. **Confirm Payment as Admin**
    - Go to: http://localhost:8080/admin/stripe-payments
    - See payment in list
    - Click "Confirmar Pagamento"
    - Select member (or use auto-matched)
    - Click "Confirmar e Ativar Membro"

12. **Verify Member Activation**
    - Go to: http://localhost:8080/admin/members
    - Search for member
    - Status should be: **ATIVO**
    - Access type: **SUBSCRIPTION**
    - Expires at: 1 month from today

13. **Verify Transactions Created**
    - Go to: http://localhost:8080/admin/finances
    - Should see 2 new transactions:
      - **SUBSCRIPTION** (plan amount)
      - **TAXA_MATRICULA** (enrollment fee, if > 0)
    - Both with payment_method: **STRIPE**

---

## Troubleshooting

### Edge Functions Return 404

**Problem**: Calling create-checkout-session returns 404

**Solutions**:
1. Verify deployment:
   ```bash
   npx supabase functions list --project-ref cgdshqmqsqwgwpjfmesr
   ```
2. Check function logs in Supabase Dashboard → Edge Functions
3. Redeploy:
   ```bash
   npx supabase functions deploy create-checkout-session --project-ref cgdshqmqsqwgwpjfmesr
   ```

### Webhook Signature Verification Fails

**Problem**: Webhook returns 400 "Webhook signature verification failed"

**Solutions**:
1. Verify STRIPE_WEBHOOK_SECRET is set correctly:
   ```bash
   npx supabase secrets list --project-ref cgdshqmqsqwgwpjfmesr | grep WEBHOOK
   ```
2. Copy the signing secret from Stripe Dashboard → Webhooks → (your endpoint) → Signing secret
3. Reset it:
   ```bash
   npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref cgdshqmqsqwgwpjfmesr
   ```

### No Price IDs Configured

**Problem**: "No Stripe price IDs configured" error

**Solutions**:
1. Create products in Stripe Dashboard (see Step 3)
2. Set price IDs:
   ```bash
   npx supabase secrets set STRIPE_PRICE_MONTHLY_MEMBERSHIP=price_... --project-ref cgdshqmqsqwgwpjfmesr
   npx supabase secrets set STRIPE_PRICE_ENROLLMENT=price_... --project-ref cgdshqmqsqwgwpjfmesr
   ```
3. Verify:
   ```bash
   npx supabase secrets list --project-ref cgdshqmqsqwgwpjfmesr
   ```

### Payment Not Appearing in Ledger

**Problem**: Completed payment doesn't show in admin page

**Solutions**:
1. Check webhook delivery in Stripe Dashboard
2. View Edge Function logs: Supabase Dashboard → Edge Functions → stripe-webhook → Logs
3. Check for errors in logs
4. Verify RLS policies:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'stripe_payment_ledger';
   ```
5. Query directly:
   ```sql
   SELECT * FROM stripe_payment_ledger ORDER BY created_at DESC LIMIT 5;
   ```

### Auto-Match Not Working

**Problem**: `matched_member_id` is null even though member exists

**Solutions**:
1. Verify member has email set:
   ```sql
   SELECT id, nome, email FROM members WHERE email IS NOT NULL;
   ```
2. Check webhook logs for auto-match attempt
3. Use manual member search in confirmation dialog

### Test Card Declined

**Problem**: Test payment fails with "Card declined"

**Solutions**:
1. Ensure using test mode in Stripe Dashboard
2. Use correct test card: `4242 4242 4242 4242`
3. Try other test cards: https://stripe.com/docs/testing#cards
4. Check Stripe Dashboard for detailed error

---

## Testing with Stripe CLI (Advanced)

For local webhook testing without deploying:

### 1. Install Stripe CLI

```bash
brew install stripe/stripe-cli/stripe
# or
npm install -g stripe
```

### 2. Login

```bash
stripe login
```

### 3. Forward Webhooks to Local Edge Function

```bash
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

### 4. Use Webhook Secret from CLI

Copy the webhook signing secret from CLI output and set it:
```bash
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref cgdshqmqsqwgwpjfmesr
```

---

## Production Deployment

When ready for production:

### 1. Switch to Live Mode

In Stripe Dashboard, toggle from "Test mode" to "Live mode"

### 2. Create Live Products

Recreate products in live mode and get live price IDs

### 3. Update Environment Variables

```bash
# Use LIVE keys (sk_live_...)
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_... --project-ref cgdshqmqsqwgwpjfmesr
npx supabase secrets set STRIPE_PRICE_MONTHLY_MEMBERSHIP=price_live_... --project-ref cgdshqmqsqwgwpjfmesr
npx supabase secrets set STRIPE_PRICE_ENROLLMENT=price_live_... --project-ref cgdshqmqsqwgwpjfmesr
npx supabase secrets set SITE_URL=https://yourdomain.com --project-ref cgdshqmqsqwgwpjfmesr
```

### 4. Register Live Webhook

Create new webhook endpoint in live mode with same URL

### 5. Set Live Webhook Secret

```bash
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_live_... --project-ref cgdshqmqsqwgwpjfmesr
```

---

## Quick Reference

### Essential URLs

- Stripe Dashboard: https://dashboard.stripe.com
- Supabase Dashboard: https://supabase.com/dashboard/project/cgdshqmqsqwgwpjfmesr
- Edge Functions: https://cgdshqmqsqwgwpjfmesr.supabase.co/functions/v1/
- Admin Stripe Payments: http://localhost:8080/admin/stripe-payments
- Staff Enrollment: http://localhost:8080/staff/enrollment

### Test Card Numbers

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Auth required: `4000 0025 0000 3155`
- More: https://stripe.com/docs/testing#cards

### Command Cheatsheet

```bash
# Deploy functions
npx supabase functions deploy <function-name> --project-ref cgdshqmqsqwgwpjfmesr

# List secrets
npx supabase secrets list --project-ref cgdshqmqsqwgwpjfmesr

# Set secret
npx supabase secrets set KEY=value --project-ref cgdshqmqsqwgwpjfmesr

# View function logs
# Go to: Supabase Dashboard → Edge Functions → [function] → Logs
```

---

## Support

If you encounter issues not covered here:

1. Check Edge Function logs in Supabase Dashboard
2. Check webhook delivery in Stripe Dashboard
3. Review `DEPLOY_STRIPE_FUNCTIONS.md` for deployment details
4. Check database with SQL queries in Supabase Dashboard

## Next Steps

After successful setup:

1. ✅ Test with multiple scenarios (new member, returning member, different amounts)
2. ✅ Add navigation link to `/admin/stripe-payments` in admin menu
3. ✅ Monitor webhook success rate in Stripe Dashboard
4. ✅ Set up alerts for failed webhooks
5. ✅ Consider auto-confirming payments (skip manual step) if auto-match is reliable
6. ✅ Add email notifications to members after successful payment
