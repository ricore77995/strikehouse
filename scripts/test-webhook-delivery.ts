#!/usr/bin/env npx tsx
/**
 * Test webhook delivery by creating a real subscription and monitoring events
 */

import * as dotenv from 'dotenv';
dotenv.config();

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY');
  process.exit(1);
}

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 WEBHOOK DELIVERY TEST');
  console.log('='.repeat(60));

  // 1. Get webhook endpoint details
  const webhooks = await stripe.webhookEndpoints.list({ limit: 1 });
  const webhook = webhooks.data[0];

  if (!webhook) {
    console.error('No webhook endpoint found!');
    return;
  }

  console.log(`\n📡 Webhook Endpoint:`);
  console.log(`   ID: ${webhook.id}`);
  console.log(`   URL: ${webhook.url}`);
  console.log(`   Status: ${webhook.status}`);
  console.log(`   Events enabled: ${webhook.enabled_events.length}`);

  // Check if key events are enabled
  const criticalEvents = ['invoice.paid', 'checkout.session.completed', 'customer.subscription.created'];
  console.log(`\n📋 Critical events check:`);
  for (const evt of criticalEvents) {
    const enabled = webhook.enabled_events.includes(evt as Stripe.WebhookEndpointCreateParams.EnabledEvent);
    console.log(`   ${evt}: ${enabled ? '✅' : '❌'}`);
  }

  // 2. Check recent events in Stripe
  console.log(`\n📋 Last 5 Stripe events:`);
  const events = await stripe.events.list({ limit: 5 });
  for (const event of events.data) {
    const created = new Date(event.created * 1000);
    const obj = event.data.object as any;
    console.log(`   ${event.type}`);
    console.log(`     Created: ${created.toISOString()}`);
    console.log(`     Customer: ${obj.customer || 'N/A'}`);
    console.log(`     Pending webhooks: ${event.pending_webhooks}`);
  }

  // 3. Check stripe_events table
  console.log(`\n📋 Last 5 entries in stripe_events table:`);
  const { data: dbEvents, error } = await supabase
    .from('stripe_events')
    .select('event_id, event_type, processed_at, success')
    .order('processed_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('   Error fetching from DB:', error.message);
  } else if (!dbEvents || dbEvents.length === 0) {
    console.log('   ⚠️ NO EVENTS FOUND IN DATABASE');
    console.log('   This means webhooks are NOT being processed!');
  } else {
    for (const evt of dbEvents) {
      console.log(`   ${evt.event_type} (${evt.event_id})`);
      console.log(`     Processed: ${evt.processed_at}`);
      console.log(`     Success: ${evt.success}`);
    }
  }

  // 4. Diagnosis
  console.log('\n' + '='.repeat(60));
  console.log('🔍 DIAGNOSIS');
  console.log('='.repeat(60));

  if (!dbEvents || dbEvents.length === 0) {
    console.log(`
⚠️ WEBHOOKS ARE NOT ARRIVING!

Possible causes:
1. STRIPE_WEBHOOK_SECRET mismatch
   - Check .env: ${process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 20)}...
   - Make sure Supabase Edge Function has the SAME secret

2. Edge Function not deployed
   - Run: supabase functions deploy stripe-webhook

3. Edge Function crashing
   - Check logs: supabase functions logs stripe-webhook

4. Webhook URL incorrect
   - Current: ${webhook.url}
   - Should match your Supabase project URL

5. Network/firewall issue
   - Stripe cannot reach your endpoint

To fix:
   a) Verify secrets match between Stripe Dashboard → local .env → Supabase secrets
   b) Redeploy: supabase functions deploy stripe-webhook
   c) If still failing, delete webhook and recreate to get new secret:
      npx tsx scripts/setup-stripe-webhook.ts --delete
      npx tsx scripts/setup-stripe-webhook.ts
`);
  } else {
    console.log('✅ Webhooks appear to be working!');
    console.log('   Events are being recorded in the database.');
  }
}

main().catch(console.error);
