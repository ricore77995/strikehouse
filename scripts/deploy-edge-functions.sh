#!/bin/bash
#
# Deploy Supabase Edge Functions
#
# Usage:
#   ./scripts/deploy-edge-functions.sh
#
# Prerequisites:
#   1. supabase CLI installed
#   2. Run: supabase login
#

set -e

echo "============================================"
echo "🚀 DEPLOYING SUPABASE EDGE FUNCTIONS"
echo "============================================"

# Check if supabase is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ supabase CLI not found. Install with:"
    echo "   brew install supabase/tap/supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Run:"
    echo "   supabase login"
    exit 1
fi

PROJECT_REF="cgdshqmqsqwgwpjfmesr"

# ⚠️ CRÍTICO: --no-verify-jwt é necessário para funções que recebem webhooks externos (Stripe)
# ou que precisam ser acessíveis sem autenticação Supabase

echo ""
echo "📦 Deploying stripe-webhook (no-verify-jwt - receives Stripe webhooks)..."
supabase functions deploy stripe-webhook --project-ref $PROJECT_REF --no-verify-jwt
echo "✅ stripe-webhook deployed"

echo ""
echo "📦 Deploying list-payment-links (no-verify-jwt - public access)..."
supabase functions deploy list-payment-links --project-ref $PROJECT_REF --no-verify-jwt
echo "✅ list-payment-links deployed"

echo ""
echo "📦 Deploying create-offline-invoice (no-verify-jwt - called from frontend)..."
supabase functions deploy create-offline-invoice --project-ref $PROJECT_REF --no-verify-jwt
echo "✅ create-offline-invoice deployed"

echo ""
echo "📦 Deploying create-checkout-session..."
supabase functions deploy create-checkout-session --project-ref $PROJECT_REF
echo "✅ create-checkout-session deployed"

echo ""
echo "📦 Deploying update-subscription..."
supabase functions deploy update-subscription --project-ref $PROJECT_REF
echo "✅ update-subscription deployed"

echo ""
echo "📦 Deploying pause-subscription..."
supabase functions deploy pause-subscription --project-ref $PROJECT_REF
echo "✅ pause-subscription deployed"

echo ""
echo "📦 Deploying cancel-subscription..."
supabase functions deploy cancel-subscription --project-ref $PROJECT_REF
echo "✅ cancel-subscription deployed"

echo ""
echo "📦 Deploying sync-plan-prices..."
supabase functions deploy sync-plan-prices --project-ref $PROJECT_REF
echo "✅ sync-plan-prices deployed"

echo ""
echo "============================================"
echo "✅ ALL EDGE FUNCTIONS DEPLOYED SUCCESSFULLY"
echo "============================================"

echo ""
echo "📋 Verify deployment at:"
echo "   https://supabase.com/dashboard/project/${PROJECT_REF}/functions"
