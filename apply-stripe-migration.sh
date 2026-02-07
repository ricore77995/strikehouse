#!/bin/bash
# Apply Stripe Payment Ledger Migration
# Run this script to create the stripe_payment_ledger table in your Supabase database

echo "🔧 Applying Stripe Payment Ledger Migration..."
echo ""

# You can apply the migration in one of these ways:

echo "Option 1: Via Supabase Dashboard SQL Editor"
echo "  1. Go to https://supabase.com/dashboard/project/cgdshqmqsqwgwpjfmesr/sql"
echo "  2. Create new query"
echo "  3. Paste contents of: supabase/migrations/20260121_create_stripe_payment_ledger.sql"
echo "  4. Click Run"
echo ""

echo "Option 2: Via Supabase CLI (if linked)"
echo "  npx supabase db push --include-all"
echo ""

echo "Option 3: Direct SQL execution"
echo "  cat supabase/migrations/20260121_create_stripe_payment_ledger.sql | \\"
echo "    psql 'postgresql://postgres:[YOUR-PASSWORD]@db.cgdshqmqsqwgwpjfmesr.supabase.co:5432/postgres'"
echo ""

echo "Migration file location:"
echo "  📄 supabase/migrations/20260121_create_stripe_payment_ledger.sql"
echo ""
echo "What it creates:"
echo "  ✓ stripe_payment_ledger table"
echo "  ✓ Indexes for performance"
echo "  ✓ Row Level Security policies"
echo ""
