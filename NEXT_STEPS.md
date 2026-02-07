# 🎯 Next Steps - Stripe Integration

## ✅ What's Done

- ✅ Database migration applied (`stripe_payment_ledger` table created)
- ✅ Edge Functions deployed:
  - `create-checkout-session` - ACTIVE
  - `stripe-webhook` - ACTIVE
- ✅ Admin confirmation page created (`/admin/stripe-payments`)
- ✅ Routes configured in App.tsx
- ✅ Git worktree setup fixed (Makefile auto-loads `.env`)

---

## 📋 What You Need to Do (Manual Steps)

### Step 1: Configure Stripe Products (5 min)

1. Go to: https://dashboard.stripe.com/test/products
2. Click "**Add product**"

#### Product 1: Monthly Membership

- **Name**: `Monthly Membership`
- **Billing**: `Recurring` → `Monthly`
- **Price**: `€69.00` (ou o teu preço)
- Click "**Save product**"
- **📋 Copy the Price ID** (starts with `price_...`)

#### Product 2: Enrollment Fee

- **Name**: `Enrollment Fee`
- **Billing**: `One time`
- **Price**: `€25.00` (ou o teu preço)
- Click "**Save product**"
- **📋 Copy the Price ID** (starts with `price_...`)

---

### Step 2: Get Stripe API Keys (1 min)

1. Go to: https://dashboard.stripe.com/test/apikeys
2. **📋 Copy "Secret key"** (starts with `sk_test_...`)

⚠️ **Important**: Keep this secret! Never commit to git.

---

### Step 3: Set Environment Variables (3 min)

#### Option A: Interactive Script (Recommended)

```bash
cd /Users/ricore/.claude-worktrees/strikehouse/gracious-almeida
./scripts/setup-stripe-env.sh
```

The script will ask for:
- Stripe Secret Key
- Monthly Membership Price ID
- Enrollment Fee Price ID
- Webhook Secret (pode skip, fazes depois)

#### Option B: Manual Commands

```bash
export SUPABASE_ACCESS_TOKEN="$(cat .env | grep SUPABASE_ACCESS_TOKEN | cut -d'=' -f2 | tr -d '\"')"

# Set Stripe keys
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY --project-ref cgdshqmqsqwgwpjfmesr
npx supabase secrets set STRIPE_PRICE_MONTHLY_MEMBERSHIP=price_YOUR_ID --project-ref cgdshqmqsqwgwpjfmesr
npx supabase secrets set STRIPE_PRICE_ENROLLMENT=price_YOUR_ID --project-ref cgdshqmqsqwgwpjfmesr
npx supabase secrets set SITE_URL=http://localhost:8080 --project-ref cgdshqmqsqwgwpjfmesr
```

**Verify**:
```bash
npx supabase secrets list --project-ref cgdshqmqsqwgwpjfmesr | grep STRIPE
```

---

### Step 4: Register Webhook (3 min)

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click "**Add endpoint**"
3. **Endpoint URL**:
   ```
   https://cgdshqmqsqwgwpjfmesr.supabase.co/functions/v1/stripe-webhook
   ```
4. **Description**: `BoxeMaster Webhook`
5. **Events to send**: Select these 3 events:
   - ✅ `checkout.session.completed`
   - ✅ `invoice.payment_succeeded`
   - ✅ `customer.subscription.deleted`
6. Click "**Add endpoint**"
7. In the endpoint page, click "**Reveal**" on "Signing secret"
8. **📋 Copy the signing secret** (starts with `whsec_...`)

**Set the webhook secret**:
```bash
export SUPABASE_ACCESS_TOKEN="$(cat .env | grep SUPABASE_ACCESS_TOKEN | cut -d'=' -f2 | tr -d '\"')"
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET --project-ref cgdshqmqsqwgwpjfmesr
```

---

### Step 5: Test the Integration (10 min)

#### 5.1 Start Dev Server

```bash
make dev
```

#### 5.2 Test Enrollment Flow

1. **Login**: http://localhost:8080/login
   - Use STAFF or ADMIN credentials

2. **Go to Enrollment**: http://localhost:8080/staff/enrollment
   - Search for a LEAD member (or create one at `/staff/members/new`)

3. **Select Plan**: Choose any plan

4. **Generate Payment Link**:
   - Click "🌐 Pagamento Online (Stripe)"
   - Click "Gerar Link de Pagamento"
   - Should see dialog with checkout URL

5. **Test Payment**:
   - Copy the checkout URL
   - Open in new tab
   - Use test card: `4242 4242 4242 4242`
   - Expiry: `12/30`
   - CVC: `123`
   - Complete payment

6. **Check Webhook**:
   - Go to: https://dashboard.stripe.com/test/webhooks
   - Click your webhook
   - Should see `checkout.session.completed` event with ✅ status

7. **Confirm Payment**:
   - Go to: http://localhost:8080/admin/stripe-payments
   - Should see the payment in list
   - Check if auto-matched (green badge)
   - Click "Confirmar Pagamento"
   - Select member (or use auto-matched)
   - Click "Confirmar e Ativar Membro"

8. **Verify Member Activated**:
   - Go to: http://localhost:8080/admin/members
   - Search for member
   - Status should be: **ATIVO**
   - Access type: **SUBSCRIPTION**
   - Expires at: 1 month from today

9. **Check Transactions**:
   - Go to: http://localhost:8080/admin/finances
   - Should see 2 transactions:
     - **SUBSCRIPTION** (plan amount)
     - **TAXA_MATRICULA** (enrollment fee)
   - Both with payment_method: **STRIPE**

---

## ✅ Success Criteria

- [ ] Stripe products created (Monthly + Enrollment)
- [ ] API keys copied and configured
- [ ] Environment variables set in Supabase
- [ ] Webhook registered and secret configured
- [ ] Test payment completed successfully
- [ ] Webhook delivered (200 OK in Stripe Dashboard)
- [ ] Payment appears in `/admin/stripe-payments`
- [ ] Member activated (status = ATIVO)
- [ ] Transactions created correctly

---

## 🐛 Troubleshooting

### "No Stripe price IDs configured"

**Problem**: Edge Function returns error

**Solution**: Verify environment variables are set:
```bash
npx supabase secrets list --project-ref cgdshqmqsqwgwpjfmesr | grep STRIPE
```

### Webhook returns 400 "Signature verification failed"

**Problem**: STRIPE_WEBHOOK_SECRET incorrect

**Solution**:
1. Go to Stripe Dashboard → Webhooks → Your endpoint
2. Copy the "Signing secret" again
3. Set it: `npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref cgdshqmqsqwgwpjfmesr`

### Payment doesn't appear in admin page

**Problem**: Webhook not delivered or failed

**Check**:
1. Stripe Dashboard → Webhooks → Event delivery logs
2. Supabase Dashboard → Edge Functions → stripe-webhook → Logs
3. Query directly:
   ```sql
   SELECT * FROM stripe_payment_ledger ORDER BY created_at DESC LIMIT 5;
   ```

### Auto-match not working

**Problem**: Member email doesn't match Stripe email

**Solution**: Use manual search in confirmation dialog to select correct member

---

## 📚 Documentation

- **Setup Guide**: `STRIPE_SETUP_GUIDE.md` - Complete walkthrough
- **Implementation Status**: `STRIPE_IMPLEMENTATION_STATUS.md` - Architecture details
- **Deployment**: `DEPLOY_STRIPE_FUNCTIONS.md` - Edge Function info
- **Worktree Setup**: `WORKTREE_SETUP.md` - Git worktree configuration

---

## 🚀 After Testing

Once everything works:

1. **Add Navigation Link**: Add link to `/admin/stripe-payments` in admin menu
2. **Production Setup**: Switch to live Stripe keys when ready
3. **Monitor**: Check webhook success rate daily
4. **Notify Members**: Add email notifications after successful payment

---

## 🎓 Quick Commands Reference

```bash
# Start dev server
make dev

# List Supabase secrets
npx supabase secrets list --project-ref cgdshqmqsqwgwpjfmesr | grep STRIPE

# Set a secret
npx supabase secrets set KEY=value --project-ref cgdshqmqsqwgwpjfmesr

# View Edge Function logs
# Go to: https://supabase.com/dashboard/project/cgdshqmqsqwgwpjfmesr/functions

# List deployed functions
npx supabase functions list --project-ref cgdshqmqsqwgwpjfmesr

# Query payment ledger
# Go to: https://supabase.com/dashboard/project/cgdshqmqsqwgwpjfmesr/editor
SELECT * FROM stripe_payment_ledger ORDER BY created_at DESC LIMIT 10;
```

---

**Status**: ✅ Database + Edge Functions deployed
**Next**: Configure Stripe products and test integration

**Estimated time**: 15-20 minutes total
