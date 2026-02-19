#!/usr/bin/env npx tsx
/**
 * Reset Stripe Webhook - Delete and recreate to get new secret
 *
 * This script:
 * 1. Deletes the existing webhook endpoint
 * 2. Creates a new one with all required events
 * 3. Outputs the new secret for you to update in Supabase
 *
 * Usage:
 *   npx tsx scripts/reset-webhook-secret.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import Stripe from 'stripe';
import * as fs from 'fs';
import * as path from 'path';

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY');
  process.exit(1);
}

if (!process.env.VITE_SUPABASE_URL) {
  console.error('Missing VITE_SUPABASE_URL');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/stripe-webhook`;

// All events we need
const ENABLED_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'checkout.session.expired',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
  'invoice.finalized',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'customer.created',
  'customer.updated',
  'customer.deleted',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
];

async function main() {
  console.log('🔄 RESETTING STRIPE WEBHOOK');
  console.log('='.repeat(60));
  console.log(`Target URL: ${WEBHOOK_URL}\n`);

  // 1. Find and delete existing webhook
  console.log('1️⃣ Looking for existing webhook...');
  const webhooks = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = webhooks.data.find(w => w.url === WEBHOOK_URL);

  if (existing) {
    console.log(`   Found: ${existing.id}`);
    console.log('   Deleting...');
    await stripe.webhookEndpoints.del(existing.id);
    console.log('   ✅ Deleted\n');
  } else {
    console.log('   No existing webhook found\n');
  }

  // 2. Create new webhook
  console.log('2️⃣ Creating new webhook endpoint...');
  const created = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: ENABLED_EVENTS,
    description: 'BoxeMaster Pro - Auto-configured webhook',
  });

  console.log(`   ✅ Created: ${created.id}`);
  console.log(`   Status: ${created.status}`);
  console.log(`   Events: ${created.enabled_events.length}\n`);

  // 3. Output the new secret
  const newSecret = created.secret!;

  console.log('='.repeat(60));
  console.log('🔑 NEW WEBHOOK SECRET');
  console.log('='.repeat(60));
  console.log(`\nSTRIPE_WEBHOOK_SECRET=${newSecret}\n`);
  console.log('='.repeat(60));

  // 4. Update .env file
  console.log('\n3️⃣ Updating .env file...');
  const envPath = path.join(process.cwd(), '.env');
  let envContent = fs.readFileSync(envPath, 'utf-8');

  if (envContent.includes('STRIPE_WEBHOOK_SECRET=')) {
    envContent = envContent.replace(
      /STRIPE_WEBHOOK_SECRET=.*/,
      `STRIPE_WEBHOOK_SECRET=${newSecret}`
    );
  } else {
    envContent += `\nSTRIPE_WEBHOOK_SECRET=${newSecret}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log('   ✅ .env file updated\n');

  // 5. Instructions for Supabase
  console.log('='.repeat(60));
  console.log('📋 NEXT STEPS');
  console.log('='.repeat(60));
  console.log(`
⚠️ You MUST update the secret in Supabase Edge Function!

Option A - Via Supabase Dashboard:
   1. Go to: https://supabase.com/dashboard/project/cgdshqmqsqwgwpjfmesr/settings/functions
   2. Click "stripe-webhook" function
   3. Update STRIPE_WEBHOOK_SECRET to the new value above

Option B - Via Supabase CLI:
   supabase secrets set STRIPE_WEBHOOK_SECRET=${newSecret}

After updating, test with:
   npx tsx scripts/test-webhook-delivery.ts
`);
}

main().catch(console.error);
