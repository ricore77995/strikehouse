#!/usr/bin/env npx tsx
/**
 * Populate stripe_payment_links table with production data
 *
 * Usage: npx tsx scripts/populate-payment-links.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cgdshqmqsqwgwpjfmesr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PAYMENT_LINKS = [
  // Subscription Discount (sem matrícula)
  {
    frequencia: '1x',
    compromisso: 'mensal',
    includes_enrollment_fee: false,
    is_family_friends: false,
    payment_link_id: 'plink_1SxoG52O8gvs4xuVjecxokKt',
    payment_link_url: 'https://buy.stripe.com/cNi00c6zXauDgXbaBwcQU0l',
    price_id: 'price_1SxoF02O8gvs4xuVbEMhteO5',
    amount_cents: 3000,
    display_name: '1x/semana €30',
  },
  {
    frequencia: '2x',
    compromisso: 'mensal',
    includes_enrollment_fee: false,
    is_family_friends: false,
    payment_link_id: 'plink_1SuxVF2O8gvs4xuVA5qX6Y25',
    payment_link_url: 'https://buy.stripe.com/eVq9AMaQd1Y7ayN9xscQU0e',
    price_id: 'price_1SuDPp2O8gvs4xuVKiOrizPI',
    amount_cents: 4000,
    display_name: '2x/semana €40',
  },
  {
    frequencia: '3x',
    compromisso: 'mensal',
    includes_enrollment_fee: false,
    is_family_friends: false,
    payment_link_id: 'plink_1SwqpS2O8gvs4xuVTxv1Spdl',
    payment_link_url: 'https://buy.stripe.com/6oUaEQgaxdGP0Yd4d8cQU0j',
    price_id: 'price_1SuxPT2O8gvs4xuVN0XMm3m9',
    amount_cents: 5000,
    display_name: '3x/semana €50',
  },
  {
    frequencia: 'unlimited',
    compromisso: 'mensal',
    includes_enrollment_fee: false,
    is_family_friends: false,
    payment_link_id: 'plink_1Swqqp2O8gvs4xuVSexv4q6l',
    payment_link_url: 'https://buy.stripe.com/5kQeV69M932b0YdfVQcQU0k',
    price_id: 'price_1SrcCI2O8gvs4xuVL2vsGscu',
    amount_cents: 6000,
    display_name: 'Ilimitado €60',
  },

  // Membership (com matrícula €15)
  {
    frequencia: '2x',
    compromisso: 'mensal',
    includes_enrollment_fee: true,
    is_family_friends: false,
    payment_link_id: 'plink_1SuDR42O8gvs4xuVgdGpfgSA',
    payment_link_url: 'https://buy.stripe.com/dRm00caQdfOX36l250cQU0b',
    price_id: 'price_1SuDPp2O8gvs4xuVKiOrizPI',
    amount_cents: 5500,
    display_name: '2x/semana + Matrícula €55',
  },
  {
    frequencia: '3x',
    compromisso: 'mensal',
    includes_enrollment_fee: true,
    is_family_friends: false,
    payment_link_id: 'plink_1SuxR32O8gvs4xuVUfedxZwg',
    payment_link_url: 'https://buy.stripe.com/00w8wI8I51Y75et10WcQU0d',
    price_id: 'price_1SuxPT2O8gvs4xuVN0XMm3m9',
    amount_cents: 6500,
    display_name: '3x/semana + Matrícula €65',
  },
  {
    frequencia: 'unlimited',
    compromisso: 'mensal',
    includes_enrollment_fee: true,
    is_family_friends: false,
    payment_link_id: 'plink_1Srf352O8gvs4xuVHuav1h5D',
    payment_link_url: 'https://buy.stripe.com/dRm28kgax8mv36l4d8cQU06',
    price_id: 'price_1SrcCI2O8gvs4xuVL2vsGscu',
    amount_cents: 7500,
    display_name: 'Ilimitado + Matrícula €75',
  },
  {
    frequencia: 'unlimited',
    compromisso: 'trimestral',
    includes_enrollment_fee: true,
    is_family_friends: false,
    payment_link_id: 'plink_1SsCq52O8gvs4xuVb4xVwcRE',
    payment_link_url: 'https://buy.stripe.com/bJe5kw7E1byHgXbcJEcQU08',
    price_id: 'price_1SsChA2O8gvs4xuVgUQepzTh',
    amount_cents: 16500,
    display_name: 'Trimestral + Matrícula €165',
  },
  {
    frequencia: 'unlimited',
    compromisso: 'semestral',
    includes_enrollment_fee: true,
    is_family_friends: false,
    payment_link_id: 'plink_1SsCw32O8gvs4xuVbDwoQCHf',
    payment_link_url: 'https://buy.stripe.com/bJe6oA8I5dGPayNeRMcQU09',
    price_id: 'price_1SsChe2O8gvs4xuV2BZJ6rZE',
    amount_cents: 28500,
    display_name: 'Semestral + Matrícula €285',
  },
  {
    frequencia: 'unlimited',
    compromisso: 'anual',
    includes_enrollment_fee: true,
    is_family_friends: false,
    payment_link_id: 'plink_1SsCzG2O8gvs4xuVw2nPH5hI',
    payment_link_url: 'https://buy.stripe.com/cNiaEQ2jH46feP3eRMcQU0a',
    price_id: 'price_1SsCiV2O8gvs4xuVMkQged4q',
    amount_cents: 51900,
    display_name: 'Anual + Matrícula €519',
  },

  // Family & Friends
  {
    frequencia: 'unlimited',
    compromisso: 'mensal',
    includes_enrollment_fee: true,
    is_family_friends: true,
    payment_link_id: 'plink_1SuIIg2O8gvs4xuVVg6TC6Qt',
    payment_link_url: 'https://buy.stripe.com/3cIdR2f6t6enayNdNIcQU0c',
    price_id: 'price_1SuIFX2O8gvs4xuVeQI41rNw',
    amount_cents: 4500,
    display_name: 'F&F + Matrícula €45',
  },
];

async function main() {
  console.log('🔄 Populating stripe_payment_links table...');

  // Check if table exists and is empty
  const { data: existing, error: checkError } = await supabase
    .from('stripe_payment_links')
    .select('id')
    .limit(1);

  if (checkError) {
    console.error('❌ Error checking table:', checkError.message);
    process.exit(1);
  }

  if (existing && existing.length > 0) {
    console.log('⚠️  Table already has data. Skipping to avoid duplicates.');
    console.log('   To re-populate, delete existing rows first.');
    process.exit(0);
  }

  // Insert all payment links
  const { data, error } = await supabase
    .from('stripe_payment_links')
    .insert(PAYMENT_LINKS)
    .select();

  if (error) {
    console.error('❌ Error inserting data:', error.message);
    process.exit(1);
  }

  console.log(`✅ Inserted ${data.length} payment links:`);
  for (const link of data) {
    console.log(`   - ${link.display_name} (${link.frequencia}/${link.compromisso})`);
  }
}

main().catch(console.error);
