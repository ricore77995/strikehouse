/**
 * Script to update Payment Links with metadata
 *
 * Usage: npx tsx scripts/update-payment-links-metadata.ts
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

interface PaymentLinkMetadata {
  weekly_limit?: string;
  modalities_count: string;
  access_type: string;
  commitment_months?: string;
  special?: string;
  days_access?: string;
}

// Mapping based on display name patterns to metadata
const metadataMapping: Record<string, PaymentLinkMetadata> = {
  // 1x/semana plans
  '1x/semana': { weekly_limit: '1', modalities_count: '1', access_type: 'SUBSCRIPTION' },
  '1x por semana': { weekly_limit: '1', modalities_count: '1', access_type: 'SUBSCRIPTION' },

  // 2x/semana plans
  '2x/semana': { weekly_limit: '2', modalities_count: '1', access_type: 'SUBSCRIPTION' },
  '2x por semana': { weekly_limit: '2', modalities_count: '1', access_type: 'SUBSCRIPTION' },

  // 3x/semana plans
  '3x/semana': { weekly_limit: '3', modalities_count: '1', access_type: 'SUBSCRIPTION' },
  '3x por semana': { weekly_limit: '3', modalities_count: '1', access_type: 'SUBSCRIPTION' },

  // Unlimited monthly plans (€60 and €75)
  'Ilimitado': { modalities_count: '1', access_type: 'SUBSCRIPTION' },
  'ilimitado': { modalities_count: '1', access_type: 'SUBSCRIPTION' },

  // Commitment plans
  'Trimestral': { modalities_count: '1', access_type: 'SUBSCRIPTION', commitment_months: '3' },
  '3 Month': { modalities_count: '1', access_type: 'SUBSCRIPTION', commitment_months: '3' },
  'trimestral': { modalities_count: '1', access_type: 'SUBSCRIPTION', commitment_months: '3' },

  'Semestral': { modalities_count: '1', access_type: 'SUBSCRIPTION', commitment_months: '6' },
  '6 Month': { modalities_count: '1', access_type: 'SUBSCRIPTION', commitment_months: '6' },
  'semestral': { modalities_count: '1', access_type: 'SUBSCRIPTION', commitment_months: '6' },

  'Anual': { modalities_count: '1', access_type: 'SUBSCRIPTION', commitment_months: '12' },
  'Yearly': { modalities_count: '1', access_type: 'SUBSCRIPTION', commitment_months: '12' },
  'anual': { modalities_count: '1', access_type: 'SUBSCRIPTION', commitment_months: '12' },

  // Passe Livre (all modalities)
  'Passe Livre': { modalities_count: 'ALL', access_type: 'SUBSCRIPTION' },
  'passe livre': { modalities_count: 'ALL', access_type: 'SUBSCRIPTION' },

  // Family & Friends
  'Family': { modalities_count: '1', access_type: 'SUBSCRIPTION', special: 'family_friends' },
  'Friends': { modalities_count: '1', access_type: 'SUBSCRIPTION', special: 'family_friends' },

  // Drop-in (daily pass)
  'Drop-in': { modalities_count: '1', access_type: 'DAILY_PASS', days_access: '1' },
  'drop-in': { modalities_count: '1', access_type: 'DAILY_PASS', days_access: '1' },
  'Aula Avulsa': { modalities_count: '1', access_type: 'DAILY_PASS', days_access: '1' },

  // +1 Modalidade addon
  '+1 Modalidade': { modalities_count: '1', access_type: 'ADDON' },
  'Modalidade Extra': { modalities_count: '1', access_type: 'ADDON' },
};

function getMetadataForLink(name: string, priceCents: number): PaymentLinkMetadata | null {
  // Try exact match first
  for (const [pattern, metadata] of Object.entries(metadataMapping)) {
    if (name.toLowerCase().includes(pattern.toLowerCase())) {
      return metadata;
    }
  }

  // Fallback: try to determine by price
  const priceEuros = priceCents / 100;

  if (priceEuros === 30 && name.toLowerCase().includes('semana')) {
    return metadataMapping['1x/semana'];
  }
  if (priceEuros === 40 && name.toLowerCase().includes('semana')) {
    return metadataMapping['2x/semana'];
  }
  if (priceEuros === 50 && name.toLowerCase().includes('semana')) {
    return metadataMapping['3x/semana'];
  }
  if (priceEuros === 60 || priceEuros === 75) {
    return metadataMapping['Ilimitado'];
  }
  if (priceEuros === 165) {
    return metadataMapping['Trimestral'];
  }
  if (priceEuros === 285) {
    return metadataMapping['Semestral'];
  }
  if (priceEuros === 519 || priceEuros === 504) {
    return metadataMapping['Anual'];
  }
  if (priceEuros === 120) {
    return metadataMapping['Passe Livre'];
  }
  if (priceEuros === 15) {
    return metadataMapping['Drop-in'];
  }

  return null;
}

async function main() {
  console.log('🔄 Fetching active Payment Links...\n');

  const paymentLinks = await stripe.paymentLinks.list({
    active: true,
    limit: 100,
    expand: ['data.line_items'],
  });

  console.log(`Found ${paymentLinks.data.length} active Payment Links\n`);

  const updates: Array<{ id: string; name: string; metadata: PaymentLinkMetadata }> = [];
  const skipped: Array<{ id: string; name: string; reason: string }> = [];

  for (const link of paymentLinks.data) {
    const name = link.metadata?.display_name ||
                 (link as any).line_items?.data?.[0]?.price?.product?.name ||
                 'Unknown';

    // Get price from line items
    const lineItems = (link as any).line_items?.data || [];
    const priceCents = lineItems[0]?.price?.unit_amount || 0;

    // Check if already has our metadata
    if (link.metadata?.access_type) {
      skipped.push({ id: link.id, name, reason: 'Already has metadata' });
      continue;
    }

    const metadata = getMetadataForLink(name, priceCents);

    if (metadata) {
      updates.push({ id: link.id, name, metadata });
    } else {
      skipped.push({ id: link.id, name, reason: 'Could not determine metadata' });
    }
  }

  console.log('📋 Summary:\n');
  console.log(`  ✅ To update: ${updates.length}`);
  console.log(`  ⏭️  Skipped: ${skipped.length}\n`);

  if (skipped.length > 0) {
    console.log('Skipped links:');
    for (const s of skipped) {
      console.log(`  - ${s.name} (${s.id}): ${s.reason}`);
    }
    console.log('');
  }

  if (updates.length === 0) {
    console.log('✅ No updates needed. All Payment Links already have metadata.');
    return;
  }

  console.log('Updates to apply:');
  for (const u of updates) {
    console.log(`  - ${u.name}:`);
    console.log(`      ${JSON.stringify(u.metadata)}`);
  }
  console.log('');

  // Ask for confirmation
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question('Apply these updates? (yes/no): ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
    console.log('❌ Aborted.');
    return;
  }

  console.log('\n🚀 Applying updates...\n');

  for (const u of updates) {
    try {
      await stripe.paymentLinks.update(u.id, {
        metadata: u.metadata as Stripe.MetadataParam,
      });
      console.log(`  ✅ ${u.name}`);
    } catch (error: any) {
      console.log(`  ❌ ${u.name}: ${error.message}`);
    }
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
