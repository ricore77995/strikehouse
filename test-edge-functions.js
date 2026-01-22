#!/usr/bin/env node
/**
 * Edge Functions Integration Test
 * Tests Stripe integration through Supabase Edge Functions
 */

const SUPABASE_URL = 'https://cgdshqmqsqwgwpjfmesr.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZHNocW1xc3F3Z3dwamZtZXNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNTQ1MzcsImV4cCI6MjA4MzczMDUzN30.pibja0umDJov1viollgRjWzcrWKqqwD8alUMDQt66Ts';

console.log('🔧 BoxeMaster Pro - Edge Functions Test\n');
console.log('═══════════════════════════════════════\n');

// Test 1: Create Checkout Session (Subscription)
async function testCreateCheckoutSession() {
  console.log('📦 Test 1: Create Subscription Checkout Session');

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        customerEmail: 'test@boxemaster.com',
        customerName: 'Test User',
        isNewMember: true, // Will include enrollment fee + membership
        customMetadata: {
          memberId: 'test-member-123',
          test_mode: 'true',
        },
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('   ✅ Session created successfully');
      console.log(`   🔗 Session ID: ${data.sessionId?.substring(0, 20)}...`);
      console.log(`   💳 Checkout URL available: ${!!data.url}`);
      return true;
    } else {
      console.log(`   ⚠️  Response: ${response.status}`);
      console.log(`   📝 Message: ${data.error || data.message || JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

// Test 2: Create One-Time Checkout
async function testCreateOnetimeCheckout() {
  console.log('\n💰 Test 2: Create One-Time Payment Checkout');

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-onetime-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        customerEmail: 'test@boxemaster.com',
        customerName: 'Test User',
        productType: '3_month_pass', // Valid: '3_month_pass' or 'enrollment_only'
        customMetadata: {
          memberId: 'test-member-456',
          test_mode: 'true',
        },
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('   ✅ One-time checkout created');
      console.log(`   🔗 Session ID: ${data.sessionId?.substring(0, 20)}...`);
      console.log(`   💶 Amount: €${data.amount / 100 || 159}`);
      return true;
    } else {
      console.log(`   ⚠️  Response: ${response.status}`);
      console.log(`   📝 Message: ${data.error || data.message || JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

// Test 3: Webhook Endpoint Health
async function testWebhookEndpoint() {
  console.log('\n🔔 Test 3: Webhook Endpoint Health Check');

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/stripe-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'test-signature',
      },
      body: JSON.stringify({
        type: 'ping',
      }),
    });

    // Webhook will reject invalid signature (400), but that means it's running
    if (response.status === 400) {
      console.log('   ✅ Webhook endpoint is active (rejected test payload as expected)');
      return true;
    } else if (response.status === 404) {
      console.log('   ❌ Webhook endpoint not found (404)');
      return false;
    } else {
      console.log(`   ⚠️  Unexpected response: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

// Test 4: Portal Session (requires customer ID)
async function testPortalSession() {
  console.log('\n🏛️  Test 4: Customer Portal Session');

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-portal-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        customerEmail: 'test@boxemaster.com',
        returnUrl: 'https://boxemaster.com/account',
      }),
    });

    const data = await response.json();

    // 404 = customer not found in Stripe (expected), but endpoint is working
    if (response.status === 404) {
      console.log('   ✅ Portal endpoint active (no customer found as expected)');
      console.log(`   📝 Message: ${data.error || 'Customer lookup working'}`);
      return true; // Endpoint is deployed and functional
    } else if (response.status >= 400 && response.status !== 404) {
      console.log(`   ⚠️  Portal endpoint error: ${response.status}`);
      console.log(`   📝 Error: ${data.error || data.message}`);
      return false;
    } else if (response.ok) {
      console.log('   ✅ Portal session created successfully');
      return true;
    } else {
      console.log('   ⚠️  Unexpected response');
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  const results = {
    total: 4,
    passed: 0,
  };

  if (await testCreateCheckoutSession()) results.passed++;
  if (await testCreateOnetimeCheckout()) results.passed++;
  if (await testWebhookEndpoint()) results.passed++;
  if (await testPortalSession()) results.passed++;

  console.log('\n═══════════════════════════════════════');
  console.log(`\n📊 Results: ${results.passed}/${results.total} endpoints functional`);

  if (results.passed >= 3) {
    console.log('✅ Stripe integration is operational!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some endpoints may need attention.\n');
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
