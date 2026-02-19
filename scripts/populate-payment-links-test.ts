#!/usr/bin/env npx tsx
/**
 * Populate stripe_payment_links table with TEST Payment Links from Stripe API
 *
 * This script:
 * 1. Fetches all active Payment Links from Stripe TEST API (sk_test_*)
 * 2. Gets line items and price metadata for each link
 * 3. Inserts into stripe_payment_links with is_test=true
 *
 * SAFETY:
 * - Only reads from Stripe API (no writes to Stripe)
 * - Only inserts TEST links (is_test=true)
 * - Does not modify existing PRODUCTION links
 *
 * Usage: npx tsx scripts/populate-payment-links-test.ts
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Stripe setup
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY in .env');
  process.exit(1);
}

// Verify this is a TEST key
if (!STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  console.error('STRIPE_SECRET_KEY must be a TEST key (sk_test_*)');
  console.error('Using production keys is DANGEROUS and not allowed by this script');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

// Supabase setup
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface PaymentLinkData {
  frequencia: string;
  compromisso: string;
  includes_enrollment_fee: boolean;
  is_family_friends: boolean;
  payment_link_id: string;
  payment_link_url: string;
  price_id: string;
  amount_cents: number;
  display_name: string;
  is_test: boolean;
}

/**
 * Parse frequencia from price metadata or amount
 */
function parseFrequencia(metadata: Stripe.Metadata, amountCents: number): string {
  // Check metadata first
  if (metadata.weekly_limit) {
    const limit = parseInt(metadata.weekly_limit, 10);
    if (limit === 1) return '1x';
    if (limit === 2) return '2x';
    if (limit === 3) return '3x';
  }
  if (metadata.frequencia) {
    return metadata.frequencia;
  }

  // Infer from price amount (based on known pricing structure)
  // Without enrollment: 30=1x, 40=2x, 50=3x, 60=unlimited
  // With enrollment (+15): 55=2x, 65=3x, 75=unlimited
  const baseAmounts: Record<number, string> = {
    3000: '1x',
    4000: '2x',
    5000: '3x',
    6000: 'unlimited',
    5500: '2x', // 40 + 15
    6500: '3x', // 50 + 15
    7500: 'unlimited', // 60 + 15
    4500: 'unlimited', // F&F
    16500: 'unlimited', // trimestral
    28500: 'unlimited', // semestral
    51900: 'unlimited', // anual
  };

  return baseAmounts[amountCents] || 'unlimited';
}

/**
 * Parse compromisso (commitment period) from metadata or amount
 */
function parseCompromisso(metadata: Stripe.Metadata, amountCents: number): string {
  if (metadata.compromisso) {
    return metadata.compromisso;
  }

  // Infer from amount
  if (amountCents >= 50000) return 'anual';
  if (amountCents >= 25000) return 'semestral';
  if (amountCents >= 15000) return 'trimestral';
  return 'mensal';
}

/**
 * Determine if link includes enrollment fee
 */
function hasEnrollmentFee(lineItems: Stripe.LineItem[]): boolean {
  // If there are 2 line items, one is likely the enrollment fee
  if (lineItems.length >= 2) return true;

  // Otherwise check metadata or price name
  for (const item of lineItems) {
    const price = item.price as Stripe.Price;
    if (price?.metadata?.includes_enrollment === 'true') return true;
    if (price?.nickname?.toLowerCase().includes('matrícula')) return true;
    if (price?.nickname?.toLowerCase().includes('matricula')) return true;
  }

  return false;
}

/**
 * Determine if this is a Family & Friends link
 */
function isFamilyFriends(metadata: Stripe.Metadata, name: string): boolean {
  if (metadata.is_family_friends === 'true') return true;
  const lowerName = name.toLowerCase();
  return lowerName.includes('f&f') || lowerName.includes('family') || lowerName.includes('friends');
}

/**
 * Generate display name from link data
 */
function generateDisplayName(
  frequencia: string,
  amountCents: number,
  includesEnrollment: boolean,
  isFnF: boolean,
  compromisso: string
): string {
  const price = `€${(amountCents / 100).toFixed(0)}`;

  if (isFnF) {
    return `F&F + Matrícula ${price}`;
  }

  const freqLabels: Record<string, string> = {
    '1x': '1x/semana',
    '2x': '2x/semana',
    '3x': '3x/semana',
    'unlimited': 'Ilimitado',
  };

  const freqLabel = freqLabels[frequencia] || frequencia;

  if (compromisso !== 'mensal') {
    const compLabels: Record<string, string> = {
      'trimestral': 'Trimestral',
      'semestral': 'Semestral',
      'anual': 'Anual',
    };
    const compLabel = compLabels[compromisso] || compromisso;
    return includesEnrollment
      ? `${compLabel} + Matrícula ${price}`
      : `${compLabel} ${price}`;
  }

  return includesEnrollment
    ? `${freqLabel} + Matrícula ${price}`
    : `${freqLabel} ${price}`;
}

async function main() {
  console.log('Fetching TEST Payment Links from Stripe API...\n');

  // Step 1: List all active Payment Links
  const paymentLinks = await stripe.paymentLinks.list({
    active: true,
    limit: 100,
  });

  console.log(`Found ${paymentLinks.data.length} active Payment Links\n`);

  if (paymentLinks.data.length === 0) {
    console.log('No Payment Links found. Create some in Stripe Dashboard (Test Mode).');
    process.exit(0);
  }

  // Step 2: Check for existing TEST links in database
  const { data: existingTest, error: checkError } = await supabase
    .from('stripe_payment_links')
    .select('payment_link_id')
    .eq('is_test', true);

  if (checkError) {
    console.error('Error checking existing TEST links:', checkError.message);
    process.exit(1);
  }

  const existingIds = new Set((existingTest || []).map((l) => l.payment_link_id));
  console.log(`Found ${existingIds.size} existing TEST links in database\n`);

  // Step 3: Process each Payment Link
  const linksToInsert: PaymentLinkData[] = [];

  for (const link of paymentLinks.data) {
    // Skip if already exists
    if (existingIds.has(link.id)) {
      console.log(`Skipping ${link.id} (already in database)`);
      continue;
    }

    try {
      // Get line items for this Payment Link
      const lineItems = await stripe.paymentLinks.listLineItems(link.id);

      if (lineItems.data.length === 0) {
        console.log(`Skipping ${link.id} (no line items)`);
        continue;
      }

      // Get total amount
      let totalAmountCents = 0;
      let mainPriceId = '';
      const allMetadata: Stripe.Metadata = {};

      for (const item of lineItems.data) {
        const price = item.price as Stripe.Price;
        if (price) {
          totalAmountCents += (price.unit_amount || 0) * (item.quantity || 1);
          if (!mainPriceId) mainPriceId = price.id;

          // Merge metadata from all prices
          Object.assign(allMetadata, price.metadata || {});
        }
      }

      // Parse fields
      const frequencia = parseFrequencia(allMetadata, totalAmountCents);
      const compromisso = parseCompromisso(allMetadata, totalAmountCents);
      const includesEnrollment = hasEnrollmentFee(lineItems.data);
      const isFnF = isFamilyFriends(allMetadata, link.metadata?.name || '');

      const displayName = generateDisplayName(
        frequencia,
        totalAmountCents,
        includesEnrollment,
        isFnF,
        compromisso
      );

      const linkData: PaymentLinkData = {
        frequencia,
        compromisso,
        includes_enrollment_fee: includesEnrollment,
        is_family_friends: isFnF,
        payment_link_id: link.id,
        payment_link_url: link.url,
        price_id: mainPriceId,
        amount_cents: totalAmountCents,
        display_name: displayName,
        is_test: true, // CRITICAL: Mark as TEST
      };

      linksToInsert.push(linkData);
      console.log(`Prepared: ${displayName} (${link.url})`);
    } catch (err) {
      console.error(`Error processing ${link.id}:`, err);
    }
  }

  // Step 4: De-duplicate links by config (unique constraint)
  // Keep only the first occurrence of each (frequencia, compromisso, includes_enrollment_fee, is_family_friends)
  const seen = new Set<string>();
  const uniqueLinks: PaymentLinkData[] = [];

  for (const link of linksToInsert) {
    const key = `${link.frequencia}|${link.compromisso}|${link.includes_enrollment_fee}|${link.is_family_friends}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueLinks.push(link);
    } else {
      console.log(`Skipping duplicate config: ${link.display_name}`);
    }
  }

  console.log(`\nAfter de-duplication: ${uniqueLinks.length} unique links`);

  // Step 5: Insert into database
  if (uniqueLinks.length === 0) {
    console.log('\nNo new links to insert.');
    process.exit(0);
  }

  console.log(`\nInserting ${uniqueLinks.length} TEST Payment Links...`);

  const { data: inserted, error: insertError } = await supabase
    .from('stripe_payment_links')
    .insert(uniqueLinks)
    .select();

  if (insertError) {
    console.error('Error inserting links:', insertError.message);
    process.exit(1);
  }

  console.log(`\nInserted ${inserted.length} TEST Payment Links:`);
  for (const link of inserted) {
    console.log(`  - ${link.display_name}`);
    console.log(`    URL: ${link.payment_link_url}`);
    console.log(`    is_test: ${link.is_test}`);
    console.log();
  }

  console.log('Done! TEST links are now available in the database.');
  console.log('Set VITE_STRIPE_MODE=test in .env to use them in the UI.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
