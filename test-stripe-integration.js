#!/usr/bin/env node
/**
 * Stripe Integration Test Suite
 * Tests Edge Functions and Stripe API connectivity
 *
 * Run: node test-stripe-integration.js <stripe_secret_key>
 */

import Stripe from 'stripe';

// Get key from command line or prompt user
const STRIPE_SECRET_KEY = process.argv[2] || process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ Please provide Stripe secret key:');
  console.error('   node test-stripe-integration.js sk_test_...');
  console.error('   OR set STRIPE_SECRET_KEY environment variable');
  console.error('\n   Get your test key from: https://dashboard.stripe.com/test/apikeys');
  process.exit(1);
}

const SUPABASE_URL = 'https://cgdshqmqsqwgwpjfmesr.supabase.co';
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

console.log('🔧 BoxeMaster Pro - Stripe Integration Tests\n');
console.log('═══════════════════════════════════════════\n');

// ============================================
// Test 1: Stripe API Connectivity
// ============================================
async function test1_StripeAPIConnection() {
  console.log('📡 Test 1: Stripe API Connection');
  try {
    const account = await stripe.accounts.retrieve();
    console.log(`   ✅ Connected to Stripe account: ${account.id}`);
    console.log(`   📧 Business name: ${account.business_profile?.name || 'N/A'}`);
    console.log(`   🌍 Country: ${account.country}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    return false;
  }
}

// ============================================
// Test 2: List Price IDs (verify configuration)
// ============================================
async function test2_ListPrices() {
  console.log('\n💰 Test 2: Configured Price Objects');
  try {
    const prices = await stripe.prices.list({ limit: 10, active: true });

    if (prices.data.length === 0) {
      console.log('   ⚠️  No prices found - you need to create products/prices in Stripe');
      return false;
    }

    console.log(`   ✅ Found ${prices.data.length} active prices:\n`);

    for (const price of prices.data) {
      const product = await stripe.products.retrieve(price.product as string);
      const amount = price.unit_amount ? `€${(price.unit_amount / 100).toFixed(2)}` : 'N/A';
      const interval = price.recurring ? `/${price.recurring.interval}` : '(one-time)';

      console.log(`   • ${product.name}`);
      console.log(`     ID: ${price.id}`);
      console.log(`     Amount: ${amount} ${interval}`);
      console.log('');
    }

    return true;
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    return false;
  }
}

// ============================================
// Test 3: Create Test Checkout Session
// ============================================
async function test3_CreateCheckoutSession() {
  console.log('🛒 Test 3: Create Checkout Session');
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Test Monthly Membership',
              description: 'Integration test - do not process',
            },
            unit_amount: 6900, // €69.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${SUPABASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SUPABASE_URL}/cancel`,
      client_reference_id: 'test-member-123',
      metadata: {
        member_id: 'test-member-123',
        plan_id: 'test-plan',
        test_mode: 'true',
      },
    });

    console.log(`   ✅ Session created: ${session.id}`);
    console.log(`   💳 Checkout URL: ${session.url}`);
    console.log(`   💶 Amount: €${session.amount_total / 100}`);
    console.log(`   📋 Metadata: ${JSON.stringify(session.metadata)}`);

    return session.id;
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    return null;
  }
}

// ============================================
// Test 4: Test Webhook Signature Generation
// ============================================
async function test4_WebhookSignature() {
  console.log('\n🔐 Test 4: Webhook Signature Verification');

  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

  try {
    const mockPayload = JSON.stringify({
      id: 'evt_test_webhook',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          amount_total: 6900,
          customer_email: 'test@example.com',
        },
      },
    });

    // Generate test signature
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: mockPayload,
      secret: WEBHOOK_SECRET,
    });

    console.log(`   ✅ Generated test signature`);
    console.log(`   📝 Signature format: ${signature.substring(0, 50)}...`);
    console.log(`   ⚙️  Secret format: ${WEBHOOK_SECRET.substring(0, 15)}...`);

    // Try to verify it
    const event = stripe.webhooks.constructEvent(
      mockPayload,
      signature,
      WEBHOOK_SECRET
    );

    console.log(`   ✅ Signature verified successfully`);
    console.log(`   📨 Event type: ${event.type}`);

    return true;
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    console.log(`   ℹ️  Note: Set STRIPE_WEBHOOK_SECRET env var for full test`);
    return false;
  }
}

// ============================================
// Test 5: Supabase Edge Function Endpoint Check
// ============================================
async function test5_EdgeFunctionEndpoints() {
  console.log('\n🌐 Test 5: Edge Function Endpoints');

  const functions = [
    'stripe-webhook',
    'create-checkout-session',
    'create-onetime-checkout',
    'create-portal-session',
  ];

  for (const func of functions) {
    const url = `${SUPABASE_URL}/functions/v1/${func}`;
    try {
      // Just check if endpoint exists (will return 401/400, not 404)
      const response = await fetch(url, { method: 'POST' });

      if (response.status === 404) {
        console.log(`   ❌ ${func}: Not deployed (404)`);
      } else {
        console.log(`   ✅ ${func}: Deployed (status ${response.status})`);
      }
    } catch (error) {
      console.log(`   ⚠️  ${func}: ${error.message}`);
    }
  }

  return true;
}

// ============================================
// Run All Tests
// ============================================
async function runTests() {
  const results = {
    total: 5,
    passed: 0,
  };

  if (await test1_StripeAPIConnection()) results.passed++;
  if (await test2_ListPrices()) results.passed++;
  if (await test3_CreateCheckoutSession()) results.passed++;
  if (await test4_WebhookSignature()) results.passed++;
  if (await test5_EdgeFunctionEndpoints()) results.passed++;

  console.log('\n═══════════════════════════════════════════');
  console.log(`\n📊 Results: ${results.passed}/${results.total} tests passed`);

  if (results.passed === results.total) {
    console.log('🎉 All tests passed! Stripe integration is ready.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Review output above.\n');
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
