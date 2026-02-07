# Deploy Stripe Edge Functions

## Prerequisites

You need the Supabase CLI installed and authenticated.

## Step 1: Link Project (if not already linked)

```bash
npx supabase link --project-ref cgdshqmqsqwgwpjfmesr
```

You'll be prompted for your Supabase database password.

## Step 2: Deploy Edge Functions

Deploy both Edge Functions to Supabase:

```bash
# Deploy create-checkout-session function
npx supabase functions deploy create-checkout-session --project-ref cgdshqmqsqwgwpjfmesr

# Deploy stripe-webhook function
npx supabase functions deploy stripe-webhook --project-ref cgdshqmqsqwgwpjfmesr
```

## Step 3: Set Environment Variables

Set the required Stripe secrets in Supabase:

```bash
# Get these from https://dashboard.stripe.com/test/apikeys
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... --project-ref cgdshqmqsqwgwpjfmesr

# Get webhook secret after creating endpoint (Step 4)
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref cgdshqmqsqwgwpjfmesr

# Create products/prices in Stripe Dashboard first, then set their price IDs
npx supabase secrets set STRIPE_PRICE_MONTHLY_MEMBERSHIP=price_... --project-ref cgdshqmqsqwgwpjfmesr
npx supabase secrets set STRIPE_PRICE_ENROLLMENT=price_... --project-ref cgdshqmqsqwgwpjfmesr

# Set your site URL for redirects
npx supabase secrets set SITE_URL=http://localhost:8080 --project-ref cgdshqmqsqwgwpjfmesr
```

## Step 4: Register Webhook in Stripe Dashboard

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Enter URL: `https://cgdshqmqsqwgwpjfmesr.supabase.co/functions/v1/stripe-webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `customer.subscription.deleted`
5. Click "Add endpoint"
6. Copy the "Signing secret" (starts with `whsec_`)
7. Run: `npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref cgdshqmqsqwgwpjfmesr`

## Step 5: Create Stripe Products

In the Stripe Dashboard (https://dashboard.stripe.com/test/products):

1. **Create Monthly Membership Product:**
   - Name: "Monthly Membership"
   - Billing: Recurring monthly
   - Price: €69.00 (or your price)
   - Copy the Price ID (starts with `price_`)

2. **Create Enrollment Fee Product:**
   - Name: "Enrollment Fee"
   - Billing: One-time
   - Price: €25.00 (or your price)
   - Copy the Price ID

3. Set these in Supabase:
   ```bash
   npx supabase secrets set STRIPE_PRICE_MONTHLY_MEMBERSHIP=price_1ABC... --project-ref cgdshqmqsqwgwpjfmesr
   npx supabase secrets set STRIPE_PRICE_ENROLLMENT=price_1XYZ... --project-ref cgdshqmqsqwgwpjfmesr
   ```

## Step 6: Apply Database Migration

Go to Supabase Dashboard → SQL Editor:
https://supabase.com/dashboard/project/cgdshqmqsqwgwpjfmesr/sql

Copy and paste the contents of `supabase/migrations/20260121_create_stripe_payment_ledger.sql` and run it.

## Verification

Test the functions are deployed:

```bash
# Test create-checkout-session
curl -X POST https://cgdshqmqsqwgwpjfmesr.supabase.co/functions/v1/create-checkout-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "customerEmail": "test@example.com",
    "customerName": "Test User",
    "isNewMember": true,
    "customMetadata": {
      "memberId": "123",
      "createdBy": "staff-id",
      "enrollmentFeeCents": 2500,
      "pricingMode": "plan"
    }
  }'

# Should return: {"checkoutUrl": "https://checkout.stripe.com/...", "sessionId": "cs_...", "expiresAt": ...}
```

## Troubleshooting

### Functions not found (404)
- Verify deployment: `npx supabase functions list --project-ref cgdshqmqsqwgwpjfmesr`
- Check function logs: Supabase Dashboard → Edge Functions → Logs

### Environment variables not set
- List secrets: `npx supabase secrets list --project-ref cgdshqmqsqwgwpjfmesr`
- Check for STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, price IDs

### Webhook signature verification fails
- Ensure STRIPE_WEBHOOK_SECRET matches the signing secret from Stripe Dashboard
- Test with Stripe CLI: `stripe listen --forward-to https://cgdshqmqsqwgwpjfmesr.supabase.co/functions/v1/stripe-webhook`

### Payments not appearing in ledger
- Check webhook delivery status in Stripe Dashboard
- View Edge Function logs in Supabase Dashboard
- Verify RLS policies allow service_role to INSERT
