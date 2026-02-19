#!/usr/bin/env npx tsx
/**
 * Stripe Seed Script - Reproducible Test Data (CORRECTED v2)
 *
 * Creates all Stripe products, prices, and payment links for test mode.
 * Now creates 2 Payment Links per plan:
 * - "Subscription Discount" (só plano) - para renovações
 * - "Membership" (plano + matrícula €15) - para novos membros
 *
 * Usage:
 *   npx tsx scripts/seed-stripe.ts           # Create all products and payment links
 *   npx tsx scripts/seed-stripe.ts --list    # List current payment links
 *   npx tsx scripts/seed-stripe.ts --clean   # Archive all and recreate
 *   npx tsx scripts/seed-stripe.ts --dry-run # Show what would be created
 */

import Stripe from 'stripe'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ESM compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || process.env.VITE_STRIPE_SECRET_KEY

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not found in .env')
  process.exit(1)
}

// Verify we're in test mode
if (!STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  console.error('❌ SAFETY: This script only runs in TEST mode (sk_test_*)')
  console.error('   Current key starts with:', STRIPE_SECRET_KEY.substring(0, 10))
  process.exit(1)
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

// Base URL for redirects (use APP_URL env var or default to localhost for testing)
const APP_BASE_URL = process.env.APP_URL || 'http://localhost:8080'
console.log(`Using APP_URL: ${APP_BASE_URL}`)

// ============================================================================
// PRODUCT DEFINITIONS - CORRECT STRUCTURE WITH BUNDLES
// ============================================================================

interface PaymentLinkConfig {
  type: 'discount' | 'membership'  // discount = só plano, membership = plano + matrícula
  includeEnrollmentFee: boolean
}

interface PriceDefinition {
  nickname: string
  amountCents: number
  interval?: 'month' | 'year'
  intervalCount?: number
  isRecurring: boolean
  metadata: Record<string, string>
  paymentLinks: PaymentLinkConfig[]  // Agora é um array - pode criar múltiplos links
}

interface ProductDefinition {
  name: string
  description: string
  prices: PriceDefinition[]
}

const PRODUCTS: ProductDefinition[] = [
  // GROUP TRAINING - ONE product with MULTIPLE prices
  {
    name: 'Group Training',
    description: 'Treino de grupo - todas as frequências e compromissos',
    prices: [
      // 1x/semana
      {
        nickname: '1x/semana €30',
        amountCents: 3000,
        interval: 'month',
        intervalCount: 1,
        isRecurring: true,
        metadata: {
          weekly_limit: '1',
          modalities_count: '1',
          access_type: 'SUBSCRIPTION',
          display_name: '1x/semana €30/mês',
        },
        paymentLinks: [
          { type: 'discount', includeEnrollmentFee: false },
          { type: 'membership', includeEnrollmentFee: true },
        ],
      },
      // 2x/semana
      {
        nickname: '2x/semana €40',
        amountCents: 4000,
        interval: 'month',
        intervalCount: 1,
        isRecurring: true,
        metadata: {
          weekly_limit: '2',
          modalities_count: '1',
          access_type: 'SUBSCRIPTION',
          display_name: '2x/semana €40/mês',
        },
        paymentLinks: [
          { type: 'discount', includeEnrollmentFee: false },
          { type: 'membership', includeEnrollmentFee: true },
        ],
      },
      // 3x/semana
      {
        nickname: '3x/semana €50',
        amountCents: 5000,
        interval: 'month',
        intervalCount: 1,
        isRecurring: true,
        metadata: {
          weekly_limit: '3',
          modalities_count: '1',
          access_type: 'SUBSCRIPTION',
          display_name: '3x/semana €50/mês',
        },
        paymentLinks: [
          { type: 'discount', includeEnrollmentFee: false },
          { type: 'membership', includeEnrollmentFee: true },
        ],
      },
      // Ilimitado €60
      {
        nickname: 'Ilimitado €60',
        amountCents: 6000,
        interval: 'month',
        intervalCount: 1,
        isRecurring: true,
        metadata: {
          modalities_count: '1',
          access_type: 'SUBSCRIPTION',
          display_name: 'Ilimitado €60/mês',
        },
        paymentLinks: [
          { type: 'discount', includeEnrollmentFee: false },
          { type: 'membership', includeEnrollmentFee: true },
        ],
      },
      // Trimestral €150 (plano) + €15 (matrícula) = €165
      {
        nickname: 'Trimestral €150',
        amountCents: 15000,
        interval: 'month',
        intervalCount: 3,
        isRecurring: true,
        metadata: {
          modalities_count: '1',
          access_type: 'SUBSCRIPTION',
          commitment_months: '3',
          display_name: 'Trimestral €150',
        },
        paymentLinks: [
          { type: 'discount', includeEnrollmentFee: false },
          { type: 'membership', includeEnrollmentFee: true },
        ],
      },
      // Semestral €270 (plano) + €15 (matrícula) = €285
      {
        nickname: 'Semestral €270',
        amountCents: 27000,
        interval: 'month',
        intervalCount: 6,
        isRecurring: true,
        metadata: {
          modalities_count: '1',
          access_type: 'SUBSCRIPTION',
          commitment_months: '6',
          display_name: 'Semestral €270',
        },
        paymentLinks: [
          { type: 'discount', includeEnrollmentFee: false },
          { type: 'membership', includeEnrollmentFee: true },
        ],
      },
      // Anual €504 (plano) + €15 (matrícula) = €519
      {
        nickname: 'Anual €504 (Atleta)',
        amountCents: 50400,
        interval: 'year',
        intervalCount: 1,
        isRecurring: true,
        metadata: {
          modalities_count: '1',
          access_type: 'SUBSCRIPTION',
          commitment_months: '12',
          display_name: 'Anual €504 (Atleta)',
        },
        paymentLinks: [
          { type: 'discount', includeEnrollmentFee: false },
          { type: 'membership', includeEnrollmentFee: true },
        ],
      },
    ],
  },
  // PASSE LIVRE - Separate product
  {
    name: 'Passe Livre',
    description: 'Acesso ilimitado a TODAS as modalidades',
    prices: [
      {
        nickname: 'Passe Livre €120',
        amountCents: 12000,
        interval: 'month',
        intervalCount: 1,
        isRecurring: true,
        metadata: {
          modalities_count: 'ALL',
          access_type: 'SUBSCRIPTION',
          display_name: 'Passe Livre €120/mês',
        },
        paymentLinks: [
          { type: 'discount', includeEnrollmentFee: false },
          { type: 'membership', includeEnrollmentFee: true },
        ],
      },
    ],
  },
  // FAMILY & FRIENDS - Separate product
  {
    name: 'Family & Friends',
    description: 'Desconto especial para familiares e amigos',
    prices: [
      {
        nickname: 'F&F €30',
        amountCents: 3000,
        interval: 'month',
        intervalCount: 1,
        isRecurring: true,
        metadata: {
          modalities_count: '1',
          access_type: 'SUBSCRIPTION',
          special: 'family_friends',
          display_name: 'Family & Friends €30/mês',
        },
        paymentLinks: [
          { type: 'discount', includeEnrollmentFee: false },
          { type: 'membership', includeEnrollmentFee: true },
        ],
      },
    ],
  },
  // DROP-IN - One-time (sem bundles, é pagamento único)
  {
    name: 'Drop-in',
    description: 'Acesso por um dia (diária)',
    prices: [
      {
        nickname: 'Drop-in €15',
        amountCents: 1500,
        isRecurring: false,
        metadata: {
          modalities_count: '1',
          access_type: 'DAILY_PASS',
          days_access: '1',
          display_name: 'Drop-in €15',
        },
        paymentLinks: [
          { type: 'discount', includeEnrollmentFee: false },  // Drop-in não tem matrícula
        ],
      },
    ],
  },
  // TAXA DE MATRÍCULA - Internal use only (não cria Payment Link)
  {
    name: 'Taxa de Matrícula',
    description: 'Taxa de inscrição para novos membros',
    prices: [
      {
        nickname: 'Matrícula €15',
        amountCents: 1500,
        isRecurring: false,
        metadata: {
          access_type: 'ENROLLMENT_FEE',
          display_name: 'Taxa de Matrícula €15',
        },
        paymentLinks: [],  // Sem Payment Link - usado internamente nos bundles
      },
    ],
  },
  // ADDON +1 MODALIDADE
  {
    name: 'Addon +1 Modalidade',
    description: 'Adicionar mais uma modalidade ao plano base',
    prices: [
      {
        nickname: '+1 Modalidade €30',
        amountCents: 3000,
        interval: 'month',
        intervalCount: 1,
        isRecurring: true,
        metadata: {
          modalities_count: '1',
          access_type: 'ADDON',
          display_name: '+1 Modalidade €30/mês',
        },
        paymentLinks: [
          { type: 'discount', includeEnrollmentFee: false },  // Addon não tem matrícula
        ],
      },
    ],
  },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function findProductByName(name: string): Promise<Stripe.Product | null> {
  const products = await stripe.products.search({
    query: `name:'${name}'`,
    limit: 1,
  })
  return products.data[0] || null
}

async function findPriceByNickname(productId: string, nickname: string): Promise<Stripe.Price | null> {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  })
  return prices.data.find(p => p.nickname === nickname) || null
}

async function findPaymentLinkByMetadata(displayName: string, linkType: string): Promise<Stripe.PaymentLink | null> {
  const links = await stripe.paymentLinks.list({
    active: true,
    limit: 100,
  })
  return links.data.find(l =>
    l.metadata?.display_name === displayName &&
    l.metadata?.link_type === linkType
  ) || null
}

// ============================================================================
// MAIN OPERATIONS
// ============================================================================

async function listPaymentLinks() {
  console.log('\n📋 Listing active Payment Links...\n')

  const links = await stripe.paymentLinks.list({
    active: true,
    limit: 100,
    expand: ['data.line_items'],
  })

  if (links.data.length === 0) {
    console.log('   No active payment links found.')
    return
  }

  // Group by product for better display
  const products = await stripe.products.list({ active: true, limit: 100 })
  const productMap = new Map(products.data.map(p => [p.id, p.name]))

  // Group links by type
  const membershipLinks: Stripe.PaymentLink[] = []
  const discountLinks: Stripe.PaymentLink[] = []
  const otherLinks: Stripe.PaymentLink[] = []

  for (const link of links.data) {
    const linkType = link.metadata?.link_type
    if (linkType === 'membership') {
      membershipLinks.push(link)
    } else if (linkType === 'discount') {
      discountLinks.push(link)
    } else {
      otherLinks.push(link)
    }
  }

  const printLink = (link: Stripe.PaymentLink) => {
    const lineItems = link.line_items?.data || []
    const totalAmount = lineItems.reduce((sum, item) => sum + (item.price?.unit_amount || 0), 0)
    const itemCount = lineItems.length

    console.log(`   ✅ ${link.metadata?.display_name || link.id}`)
    console.log(`      Type: ${link.metadata?.link_type || 'unknown'}`)
    console.log(`      Items: ${itemCount} | Total: €${(totalAmount / 100).toFixed(2)}`)
    console.log(`      URL: ${link.url}`)
    if (link.metadata?.weekly_limit) {
      console.log(`      weekly_limit: ${link.metadata.weekly_limit}`)
    }
    console.log('')
  }

  if (membershipLinks.length > 0) {
    console.log('📦 MEMBERSHIP Links (plano + matrícula - novos membros):')
    console.log('─'.repeat(60))
    membershipLinks.forEach(printLink)
  }

  if (discountLinks.length > 0) {
    console.log('💰 DISCOUNT Links (só plano - renovações):')
    console.log('─'.repeat(60))
    discountLinks.forEach(printLink)
  }

  if (otherLinks.length > 0) {
    console.log('❓ OTHER Links:')
    console.log('─'.repeat(60))
    otherLinks.forEach(printLink)
  }

  // Summary
  console.log('='.repeat(60))
  console.log(`Total: ${links.data.length} active payment links`)
  console.log(`  - Membership: ${membershipLinks.length}`)
  console.log(`  - Discount: ${discountLinks.length}`)
  console.log(`  - Other: ${otherLinks.length}`)
  console.log(`Products: ${products.data.filter(p => p.active).length} active`)
}

async function cleanSandbox() {
  console.log('\n🧹 Cleaning sandbox...\n')

  // Deactivate all payment links
  const links = await stripe.paymentLinks.list({ active: true, limit: 100 })
  console.log(`   Deactivating ${links.data.length} payment links...`)
  for (const link of links.data) {
    await stripe.paymentLinks.update(link.id, { active: false })
    console.log(`   ✓ Deactivated: ${link.metadata?.display_name || link.id}`)
  }

  // Archive all products (can't delete, but can archive)
  const products = await stripe.products.list({ active: true, limit: 100 })
  console.log(`\n   Archiving ${products.data.length} products...`)
  for (const product of products.data) {
    await stripe.products.update(product.id, { active: false })
    console.log(`   ✓ Archived: ${product.name}`)
  }

  console.log('\n✅ Sandbox cleaned. Ready for fresh data.')
}

async function seedStripe(dryRun: boolean = false) {
  console.log('\n🚀 Seeding Stripe with test data...\n')
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`)
  console.log(`   Structure: 2 Payment Links per plan (discount + membership)\n`)

  const stats = {
    productsCreated: 0,
    productsSkipped: 0,
    pricesCreated: 0,
    pricesSkipped: 0,
    linksCreated: 0,
    linksSkipped: 0,
  }

  // Track enrollment price ID for bundles
  let enrollmentPriceId: string | null = null

  // First pass: Create all products and prices
  const priceIdMap = new Map<string, string>()  // nickname -> priceId

  for (const productDef of PRODUCTS) {
    console.log(`📦 Product: ${productDef.name}`)

    // Check if product exists
    let product = await findProductByName(productDef.name)

    if (product && product.active) {
      console.log(`   ↳ Already exists (${product.id})`)
      stats.productsSkipped++
    } else {
      if (dryRun) {
        console.log(`   ↳ Would create product`)
        product = { id: 'dry-run-product' } as Stripe.Product
        stats.productsCreated++
      } else {
        product = await stripe.products.create({
          name: productDef.name,
          description: productDef.description,
          metadata: {
            created_by: 'seed-stripe.ts',
            created_at: new Date().toISOString(),
          },
        })
        console.log(`   ↳ Created (${product.id})`)
        stats.productsCreated++
      }
    }

    // Create prices for this product
    for (const priceDef of productDef.prices) {
      const existingPrice = product.id !== 'dry-run-product'
        ? await findPriceByNickname(product.id, priceDef.nickname)
        : null

      let priceId: string

      if (existingPrice) {
        console.log(`   💰 Price "${priceDef.nickname}": Already exists (${existingPrice.id})`)
        priceId = existingPrice.id
        stats.pricesSkipped++
      } else {
        if (dryRun) {
          console.log(`   💰 Price "${priceDef.nickname}": Would create (€${(priceDef.amountCents / 100).toFixed(2)})`)
          priceId = 'dry-run-price-' + priceDef.nickname
          stats.pricesCreated++
        } else {
          const priceData: Stripe.PriceCreateParams = {
            product: product.id,
            currency: 'eur',
            unit_amount: priceDef.amountCents,
            nickname: priceDef.nickname,
            metadata: priceDef.metadata,
          }

          if (priceDef.isRecurring && priceDef.interval) {
            priceData.recurring = {
              interval: priceDef.interval,
              interval_count: priceDef.intervalCount || 1,
            }
          }

          const price = await stripe.prices.create(priceData)
          console.log(`   💰 Price "${priceDef.nickname}": Created (${price.id})`)
          priceId = price.id
          stats.pricesCreated++
        }
      }

      // Store price ID for later use
      priceIdMap.set(priceDef.nickname, priceId)

      // Track enrollment price for bundles
      if (priceDef.metadata.access_type === 'ENROLLMENT_FEE') {
        enrollmentPriceId = priceId
        console.log(`   📌 Enrollment Price ID saved: ${priceId}`)
      }
    }

    console.log('')
  }

  console.log('─'.repeat(60))
  console.log('🔗 Creating Payment Links...\n')

  // Second pass: Create Payment Links (now that we have all prices including enrollment)
  for (const productDef of PRODUCTS) {
    for (const priceDef of productDef.prices) {
      const priceId = priceIdMap.get(priceDef.nickname)

      if (!priceId || priceId.startsWith('dry-run-price')) {
        continue
      }

      for (const linkConfig of priceDef.paymentLinks) {
        const displayName = linkConfig.type === 'membership'
          ? `${priceDef.metadata.display_name} + Matrícula`
          : priceDef.metadata.display_name

        // Check if link already exists
        const existingLink = await findPaymentLinkByMetadata(displayName, linkConfig.type)

        if (existingLink) {
          console.log(`   🔗 ${linkConfig.type.toUpperCase()}: "${displayName}" already exists`)
          stats.linksSkipped++
          continue
        }

        if (dryRun) {
          const totalAmount = linkConfig.includeEnrollmentFee
            ? priceDef.amountCents + 1500
            : priceDef.amountCents
          console.log(`   🔗 ${linkConfig.type.toUpperCase()}: Would create "${displayName}" (€${(totalAmount / 100).toFixed(2)})`)
          stats.linksCreated++
          continue
        }

        // Build line items
        const lineItems: Stripe.PaymentLinkCreateParams.LineItem[] = [
          { price: priceId, quantity: 1 }
        ]

        // Add enrollment fee for membership links
        if (linkConfig.includeEnrollmentFee && enrollmentPriceId) {
          lineItems.push({ price: enrollmentPriceId, quantity: 1 })
        }

        // Create Payment Link
        const link = await stripe.paymentLinks.create({
          line_items: lineItems,
          metadata: {
            display_name: displayName,
            link_type: linkConfig.type,
            includes_enrollment_fee: String(linkConfig.includeEnrollmentFee),
            weekly_limit: priceDef.metadata.weekly_limit || '',
            modalities_count: priceDef.metadata.modalities_count || '',
            access_type: priceDef.metadata.access_type || '',
            created_by: 'seed-stripe.ts',
          },
          allow_promotion_codes: true,
          after_completion: {
            type: 'redirect',
            redirect: {
              url: `${APP_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            },
          },
        })

        const totalAmount = lineItems.reduce((sum, item) => {
          // We need to fetch the price to get the amount
          return sum // Will be calculated differently
        }, 0)

        console.log(`   🔗 ${linkConfig.type.toUpperCase()}: Created "${displayName}"`)
        console.log(`      Items: ${lineItems.length} | URL: ${link.url}`)
        stats.linksCreated++
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 SUMMARY')
  console.log('='.repeat(60))
  console.log(`   Products: ${stats.productsCreated} created, ${stats.productsSkipped} skipped`)
  console.log(`   Prices:   ${stats.pricesCreated} created, ${stats.pricesSkipped} skipped`)
  console.log(`   Links:    ${stats.linksCreated} created, ${stats.linksSkipped} skipped`)

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes were made')
    console.log('   Run without --dry-run to apply changes')
  } else {
    console.log('\n✅ Stripe seeding complete!')
    console.log('\n📝 STRUCTURE:')
    console.log('   - Each plan has 2 Payment Links:')
    console.log('     • DISCOUNT (só plano) - para renovações')
    console.log('     • MEMBERSHIP (plano + matrícula €15) - para novos membros')
    console.log('\n   The webhook should:')
    console.log('   - Check number of line_items in checkout.session')
    console.log('   - If 2 items: create 2 transactions (plano + matrícula)')
    console.log('   - Read weekly_limit from Price metadata')
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2)

  console.log('='.repeat(60))
  console.log('🎾 Strikers House - Stripe Seed Script v2 (with Bundles)')
  console.log('='.repeat(60))
  console.log(`Environment: ${STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'TEST MODE ✅' : 'LIVE MODE ⚠️'}`)

  if (args.includes('--list')) {
    await listPaymentLinks()
  } else if (args.includes('--clean')) {
    await cleanSandbox()
    await seedStripe(false)
  } else if (args.includes('--dry-run')) {
    await seedStripe(true)
  } else {
    await seedStripe(false)
  }
}

main().catch(error => {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
})
