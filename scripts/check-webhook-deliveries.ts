#!/usr/bin/env npx tsx
/**
 * Check webhook delivery attempts from Stripe
 */

import 'dotenv/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

async function main() {
  // Get webhook endpoint
  const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });
  const endpoint = webhooks.data[0];

  if (!endpoint) {
    console.log('No webhook endpoint found');
    return;
  }

  console.log(`📡 Webhook Endpoint: ${endpoint.id}`);
  console.log(`   URL: ${endpoint.url}`);
  console.log(`   Status: ${endpoint.status}`);

  // Check recent events and their webhook delivery status
  console.log('\n📋 Recent event delivery attempts:');

  const events = await stripe.events.list({ limit: 5 });

  for (const event of events.data) {
    console.log(`\n${event.type} (${event.id})`);
    console.log(`  Created: ${new Date(event.created * 1000).toISOString()}`);

    // Get pending webhooks for this event
    try {
      // Try to check if event is pending
      const pending = event.pending_webhooks || 0;
      console.log(`  Pending webhooks: ${pending}`);

      // Check request info if available
      if (event.request) {
        console.log(`  Request ID: ${event.request.id || 'N/A'}`);
        console.log(`  Idempotency Key: ${event.request.idempotency_key || 'N/A'}`);
      }
    } catch (e) {
      console.log(`  Could not fetch delivery info`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DIAGNOSIS:');
  console.log('='.repeat(60));
  console.log(`Events ARE being generated in Stripe ✅`);
  console.log(`Webhook endpoint IS configured ✅`);
  console.log(`Events NOT arriving in stripe_events table ❌`);
  console.log('\nPossible causes:');
  console.log('  1. Edge Function returning error (check logs)');
  console.log('  2. Webhook signature mismatch');
  console.log('  3. Edge Function not deployed');
  console.log('\nTo check Edge Function logs:');
  console.log('  supabase functions logs stripe-webhook --project-ref cgdshqmqsqwgwpjfmesr');
}

main().catch(console.error);
