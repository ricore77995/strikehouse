#!/usr/bin/env npx tsx
/**
 * Stripe Webhook Setup Script
 *
 * Automatically creates or updates the Stripe webhook endpoint via API.
 * This script should be run as part of system initialization.
 *
 * Usage:
 *   npx tsx scripts/setup-stripe-webhook.ts
 *   npx tsx scripts/setup-stripe-webhook.ts --delete  # Remove webhook
 *   npx tsx scripts/setup-stripe-webhook.ts --list    # List all webhooks
 *
 * Environment variables required:
 *   - STRIPE_SECRET_KEY
 *   - VITE_SUPABASE_URL (to construct webhook URL)
 *
 * Output:
 *   - Creates/updates webhook endpoint
 *   - Prints the webhook secret (save to STRIPE_WEBHOOK_SECRET)
 */

import 'dotenv/config';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY is required');
  process.exit(1);
}

if (!SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL is required');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Webhook URL based on Supabase Edge Function
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/stripe-webhook`;

// Events we need to receive
const ENABLED_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  // Checkout flow
  'checkout.session.completed',
  'checkout.session.expired',

  // Invoice/Payment events
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
  'invoice.finalized',

  // Subscription lifecycle
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',

  // Customer events
  'customer.created',
  'customer.updated',
  'customer.deleted',

  // Payment Intent (for one-time payments)
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
];

async function listWebhooks(): Promise<void> {
  console.log('📋 Listing all webhook endpoints...\n');

  const webhooks = await stripe.webhookEndpoints.list({ limit: 100 });

  if (webhooks.data.length === 0) {
    console.log('No webhook endpoints found.');
    return;
  }

  for (const webhook of webhooks.data) {
    console.log(`ID: ${webhook.id}`);
    console.log(`URL: ${webhook.url}`);
    console.log(`Status: ${webhook.status}`);
    console.log(`Events: ${webhook.enabled_events.length} events`);
    console.log(`Created: ${new Date(webhook.created * 1000).toISOString()}`);
    console.log('---');
  }
}

async function findExistingWebhook(): Promise<Stripe.WebhookEndpoint | null> {
  const webhooks = await stripe.webhookEndpoints.list({ limit: 100 });

  return webhooks.data.find((w) => w.url === WEBHOOK_URL) || null;
}

async function deleteWebhook(): Promise<void> {
  console.log('🗑️  Looking for webhook to delete...');

  const existing = await findExistingWebhook();

  if (!existing) {
    console.log(`No webhook found for URL: ${WEBHOOK_URL}`);
    return;
  }

  await stripe.webhookEndpoints.del(existing.id);
  console.log(`✅ Deleted webhook: ${existing.id}`);
}

async function setupWebhook(): Promise<void> {
  console.log('🔧 Setting up Stripe webhook endpoint...\n');
  console.log(`Target URL: ${WEBHOOK_URL}`);
  console.log(`Events: ${ENABLED_EVENTS.length} event types\n`);

  // Check for existing webhook
  const existing = await findExistingWebhook();

  if (existing) {
    console.log(`Found existing webhook: ${existing.id}`);
    console.log('Updating enabled events...\n');

    // Update existing webhook
    const updated = await stripe.webhookEndpoints.update(existing.id, {
      enabled_events: ENABLED_EVENTS,
      description: 'BoxeMaster Pro - Auto-configured webhook',
    });

    console.log('✅ Webhook updated successfully!\n');
    console.log(`Webhook ID: ${updated.id}`);
    console.log(`Status: ${updated.status}`);
    console.log(`Events enabled: ${updated.enabled_events.length}`);

    // Note: Cannot retrieve secret for existing webhook
    console.log('\n⚠️  Note: Webhook secret cannot be retrieved for existing webhooks.');
    console.log('   If you need a new secret, delete and recreate the webhook:');
    console.log('   npx tsx scripts/setup-stripe-webhook.ts --delete');
    console.log('   npx tsx scripts/setup-stripe-webhook.ts');
  } else {
    console.log('No existing webhook found. Creating new one...\n');

    // Create new webhook
    const created = await stripe.webhookEndpoints.create({
      url: WEBHOOK_URL,
      enabled_events: ENABLED_EVENTS,
      description: 'BoxeMaster Pro - Auto-configured webhook',
    });

    console.log('✅ Webhook created successfully!\n');
    console.log(`Webhook ID: ${created.id}`);
    console.log(`Status: ${created.status}`);
    console.log(`Events enabled: ${created.enabled_events.length}`);

    // IMPORTANT: The secret is only returned on creation!
    console.log('\n' + '='.repeat(60));
    console.log('🔑 WEBHOOK SECRET (save this to your .env file):');
    console.log('='.repeat(60));
    console.log(`\nSTRIPE_WEBHOOK_SECRET=${created.secret}\n`);
    console.log('='.repeat(60));
    console.log('\n⚠️  IMPORTANT: This secret is only shown once!');
    console.log('   Save it to your .env file and Supabase secrets.');
  }

  // List enabled events
  console.log('\n📋 Enabled events:');
  for (const event of ENABLED_EVENTS) {
    console.log(`   • ${event}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  try {
    if (args.includes('--list')) {
      await listWebhooks();
    } else if (args.includes('--delete')) {
      await deleteWebhook();
    } else {
      await setupWebhook();
    }
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error(`\n❌ Stripe API Error: ${error.message}`);
      console.error(`   Type: ${error.type}`);
      console.error(`   Code: ${error.code}`);
    } else {
      throw error;
    }
    process.exit(1);
  }
}

main();
