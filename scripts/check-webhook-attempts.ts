#!/usr/bin/env npx tsx
/**
 * Check recent webhook delivery attempts from Stripe
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

  console.log(`Webhook: ${endpoint.url}`);
  console.log(`Status: ${endpoint.status}`);
  console.log(`Events: ${endpoint.enabled_events.length} types enabled\n`);

  // Check if invoice.paid is enabled
  const hasInvoicePaid = endpoint.enabled_events.includes('invoice.paid');
  console.log(`invoice.paid enabled: ${hasInvoicePaid ? '✅' : '❌'}`);

  // List recent events
  console.log('\n📋 Recent Stripe events (last 10):');
  const events = await stripe.events.list({ limit: 10 });

  for (const event of events.data) {
    const obj = event.data.object as any;
    const customer = obj.customer || obj.id;
    const created = new Date(event.created * 1000).toISOString();
    console.log(`  ${event.type}`);
    console.log(`    ID: ${event.id}`);
    console.log(`    Customer: ${customer}`);
    console.log(`    Created: ${created}`);
    console.log('');
  }
}

main().catch(console.error);
