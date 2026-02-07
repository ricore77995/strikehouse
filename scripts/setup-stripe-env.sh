#!/bin/bash

# Setup Stripe Environment Variables
# This script helps configure Stripe keys in Supabase

set -e

PROJECT_REF="cgdshqmqsqwgwpjfmesr"

echo "🔐 Stripe Environment Setup"
echo "================================"
echo ""

# Load access token from .env
if [ -f .env ]; then
  export $(cat .env | grep SUPABASE_ACCESS_TOKEN | xargs)
fi

# Check if STRIPE_SECRET_KEY is set
if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo "⚠️  STRIPE_SECRET_KEY not set"
  echo ""
  echo "Get your Stripe Secret Key from:"
  echo "👉 https://dashboard.stripe.com/test/apikeys"
  echo ""
  read -p "Enter Stripe Secret Key (sk_test_...): " STRIPE_SECRET_KEY
  echo ""
fi

# Check if STRIPE_WEBHOOK_SECRET is set
if [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
  echo "⚠️  STRIPE_WEBHOOK_SECRET not set"
  echo ""
  echo "After registering webhook, get the signing secret from:"
  echo "👉 https://dashboard.stripe.com/test/webhooks"
  echo ""
  echo "Webhook URL should be:"
  echo "https://cgdshqmqsqwgwpjfmesr.supabase.co/functions/v1/stripe-webhook"
  echo ""
  read -p "Enter Webhook Signing Secret (whsec_...) [skip for now]: " STRIPE_WEBHOOK_SECRET
  echo ""
fi

# Check if price IDs are set
if [ -z "$STRIPE_PRICE_MONTHLY" ]; then
  echo "⚠️  STRIPE_PRICE_MONTHLY_MEMBERSHIP not set"
  echo ""
  echo "Create products in Stripe Dashboard:"
  echo "👉 https://dashboard.stripe.com/test/products"
  echo ""
  echo "1. Create 'Monthly Membership' (recurring, €69)"
  echo "2. Copy the Price ID (starts with price_)"
  echo ""
  read -p "Enter Monthly Membership Price ID (price_...): " STRIPE_PRICE_MONTHLY
  echo ""
fi

if [ -z "$STRIPE_PRICE_ENROLLMENT" ]; then
  echo "⚠️  STRIPE_PRICE_ENROLLMENT not set"
  echo ""
  echo "Create enrollment fee product:"
  echo "1. Create 'Enrollment Fee' (one-time, €25)"
  echo "2. Copy the Price ID"
  echo ""
  read -p "Enter Enrollment Fee Price ID (price_...): " STRIPE_PRICE_ENROLLMENT
  echo ""
fi

# Set SITE_URL
SITE_URL="${SITE_URL:-http://localhost:8080}"

echo "📝 Setting environment variables in Supabase..."
echo ""

# Set secrets
npx supabase secrets set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" --project-ref $PROJECT_REF
echo "✅ STRIPE_SECRET_KEY set"

if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
  npx supabase secrets set STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" --project-ref $PROJECT_REF
  echo "✅ STRIPE_WEBHOOK_SECRET set"
else
  echo "⚠️  STRIPE_WEBHOOK_SECRET skipped (set after webhook registration)"
fi

npx supabase secrets set STRIPE_PRICE_MONTHLY_MEMBERSHIP="$STRIPE_PRICE_MONTHLY" --project-ref $PROJECT_REF
echo "✅ STRIPE_PRICE_MONTHLY_MEMBERSHIP set"

npx supabase secrets set STRIPE_PRICE_ENROLLMENT="$STRIPE_PRICE_ENROLLMENT" --project-ref $PROJECT_REF
echo "✅ STRIPE_PRICE_ENROLLMENT set"

npx supabase secrets set SITE_URL="$SITE_URL" --project-ref $PROJECT_REF
echo "✅ SITE_URL set ($SITE_URL)"

echo ""
echo "🎉 Environment variables configured!"
echo ""
echo "Next steps:"
echo "1. Register webhook at: https://dashboard.stripe.com/test/webhooks"
echo "   URL: https://cgdshqmqsqwgwpjfmesr.supabase.co/functions/v1/stripe-webhook"
echo "   Events: checkout.session.completed, invoice.payment_succeeded, customer.subscription.deleted"
echo ""
echo "2. If you skipped webhook secret, set it now:"
echo "   npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref $PROJECT_REF"
echo ""
echo "3. Test the integration:"
echo "   make dev"
echo "   Go to: http://localhost:8080/staff/enrollment"
echo ""
