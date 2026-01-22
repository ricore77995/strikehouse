/**
 * Simple Stripe integration test
 * Tests that we can create a checkout session and verify webhook signature
 */

import Stripe from 'stripe';

// You'll need to paste your actual test keys here temporarily
const STRIPE_SECRET_KEY = 'sk_test_...'; // Get from: stripe.com/test/apikeys
const STRIPE_WEBHOOK_SECRET = 'whsec_...'; // Get from: stripe.com/test/webhooks

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

async function testStripeCheckout() {
  console.log('🧪 Testing Stripe Checkout Session Creation...\n');

  try {
    // Test 1: Create a checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Test Membership',
            },
            unit_amount: 6900, // €69.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      metadata: {
        member_id: 'test-123',
        plan_id: 'test-plan',
      },
    });

    console.log('✅ Checkout Session Created:');
    console.log(`   ID: ${session.id}`);
    console.log(`   URL: ${session.url}`);
    console.log(`   Amount: €${session.amount_total / 100}`);
    console.log('');

    // Test 2: Verify webhook signature (mock)
    const mockPayload = JSON.stringify({
      id: 'evt_test_123',
      type: 'checkout.session.completed',
      data: {
        object: session,
      },
    });

    const mockSignature = stripe.webhooks.generateTestHeaderString({
      payload: mockPayload,
      secret: STRIPE_WEBHOOK_SECRET,
    });

    const event = stripe.webhooks.constructEvent(
      mockPayload,
      mockSignature,
      STRIPE_WEBHOOK_SECRET
    );

    console.log('✅ Webhook Signature Verified:');
    console.log(`   Event Type: ${event.type}`);
    console.log(`   Event ID: ${event.id}`);
    console.log('');

    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testStripeCheckout();
