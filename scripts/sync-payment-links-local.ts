#!/usr/bin/env npx tsx
/**
 * Sync Payment Links from Stripe to local database
 */
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

async function sync() {
  console.log('🗑️  Clearing old payment links...');
  const { error: deleteError } = await supabase
    .from('stripe_payment_links')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (deleteError) {
    console.error('Delete error:', deleteError.message);
  } else {
    console.log('✅ Old links deleted');
  }

  console.log('\n📥 Fetching payment links from Stripe...');
  const links = await stripe.paymentLinks.list({ limit: 100, active: true });
  console.log(`Found ${links.data.length} active links`);

  let inserted = 0;
  let errors = 0;

  for (const link of links.data) {
    const meta = link.metadata || {};
    const tags: string[] = [];
    if (meta.includes_enrollment_fee === 'true') tags.push('matricula');
    if (meta.is_family_friends === 'true') tags.push('family_friends');

    // Get line items to extract price_id
    const lineItems = await stripe.paymentLinks.listLineItems(link.id, { limit: 5 });
    const priceId = lineItems.data[0]?.price?.id || '';
    const enrollmentPriceId = lineItems.data.length > 1 ? lineItems.data[1]?.price?.id : null;

    // Calculate total amount
    let amountCents = 0;
    for (const item of lineItems.data) {
      amountCents += (item.price?.unit_amount || 0);
    }

    const record = {
      payment_link_id: link.id,
      payment_link_url: link.url,
      price_id: priceId,
      enrollment_price_id: enrollmentPriceId,
      frequencia: meta.frequencia || 'unlimited',
      compromisso: meta.compromisso || 'mensal',
      tags,
      includes_enrollment_fee: meta.includes_enrollment_fee === 'true',
      is_family_friends: meta.is_family_friends === 'true',
      amount_cents: amountCents,
      display_name: meta.display_name || link.id,
      ativo: true,
    };

    const { error } = await supabase.from('stripe_payment_links').insert(record);
    if (error) {
      console.error(`❌ ${record.display_name}: ${error.message}`);
      errors++;
    } else {
      console.log(`✅ ${record.display_name}`);
      inserted++;
    }
  }

  console.log(`\n🎉 Sync complete! ${inserted} inserted, ${errors} errors`);
}

sync().catch(console.error);
