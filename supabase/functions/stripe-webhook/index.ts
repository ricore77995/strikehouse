import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

/**
 * Stripe Webhook Handler - Single Source of Truth Architecture
 *
 * This webhook handles all Stripe events and automatically updates
 * member access based on payment status. No manual confirmation needed.
 *
 * Events handled:
 * - checkout.session.completed: New enrollment or one-time payment
 * - invoice.paid: Subscription renewal or offline payment confirmed
 * - invoice.payment_failed: Payment failure (retry scheduled by Stripe)
 * - customer.subscription.updated: Subscription status change
 * - customer.subscription.deleted: Subscription cancelled
 */

// Helper to log event to stripe_events table (idempotency + audit)
async function logStripeEvent(
  supabase: SupabaseClient,
  eventId: string,
  eventType: string,
  payload: unknown,
  success: boolean,
  errorMessage?: string
) {
  const { error } = await supabase.from('stripe_events').insert({
    event_id: eventId,
    event_type: eventType,
    payload,
    success,
    error_message: errorMessage,
    processed_at: new Date().toISOString(),
  })

  if (error) {
    console.error('Failed to log stripe event:', error)
  }
}

// Check if event was already processed (idempotency)
async function isEventProcessed(supabase: SupabaseClient, eventId: string): Promise<boolean> {
  const { data } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('event_id', eventId)
    .single()

  return !!data
}

// Find member by Stripe customer ID
async function findMemberByStripeCustomerId(
  supabase: SupabaseClient,
  customerId: string
): Promise<{ id: string; status: string; access_expires_at: string | null } | null> {
  const { data } = await supabase
    .from('members')
    .select('id, status, access_expires_at')
    .eq('stripe_customer_id', customerId)
    .single()

  return data
}

// Find member by email (fallback)
async function findMemberByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ id: string; status: string; access_expires_at: string | null } | null> {
  const { data } = await supabase
    .from('members')
    .select('id, status, access_expires_at')
    .ilike('email', email)
    .limit(1)
    .single()

  return data
}

// Update member access after successful payment
async function activateMemberAccess(
  supabase: SupabaseClient,
  memberId: string,
  options: {
    stripeCustomerId?: string
    stripeSubscriptionId?: string
    accessExpiresAt: string
    accessType?: string
    weeklyLimit?: number | null
    modalitiesCount?: number
  }
) {
  const updateData: Record<string, unknown> = {
    status: 'ATIVO',
    access_expires_at: options.accessExpiresAt,
    updated_at: new Date().toISOString(),
  }

  if (options.stripeCustomerId) {
    updateData.stripe_customer_id = options.stripeCustomerId
  }

  if (options.stripeSubscriptionId) {
    updateData.stripe_subscription_id = options.stripeSubscriptionId
  }

  if (options.accessType) {
    updateData.access_type = options.accessType
  }

  // Apply weekly limit from Payment Link metadata
  // null means unlimited, otherwise integer > 0
  if (options.weeklyLimit !== undefined) {
    updateData.weekly_limit = options.weeklyLimit
  }

  // Apply modalities count from Payment Link metadata
  // 99 = ALL modalities, otherwise integer > 0
  if (options.modalitiesCount !== undefined) {
    updateData.modalities_count = options.modalitiesCount
  }

  const { error } = await supabase
    .from('members')
    .update(updateData)
    .eq('id', memberId)

  if (error) {
    console.error('Failed to activate member:', error)
    throw error
  }

  const limitInfo = options.weeklyLimit !== undefined
    ? `weekly_limit=${options.weeklyLimit ?? 'unlimited'}`
    : ''
  const modalitiesInfo = options.modalitiesCount !== undefined
    ? `modalities=${options.modalitiesCount === 99 ? 'ALL' : options.modalitiesCount}`
    : ''
  console.log(`✓ Member ${memberId} activated until ${options.accessExpiresAt} ${limitInfo} ${modalitiesInfo}`.trim())
}

// System staff ID for webhook-created transactions
// This should match the ID created in the migration
const SYSTEM_STAFF_ID = '00000000-0000-0000-0000-000000000001'

// Create transaction record for financial tracking
async function createTransaction(
  supabase: SupabaseClient,
  options: {
    type: 'RECEITA' | 'DESPESA'
    amountCents: number
    category: string
    memberId: string | null
    description: string
    stripeSessionId?: string
  }
) {
  const { error } = await supabase.from('transactions').insert({
    type: options.type,
    amount_cents: options.amountCents,
    payment_method: 'STRIPE',
    category: options.category,
    member_id: options.memberId,
    description: options.description,
    stripe_session_id: options.stripeSessionId,
    created_by: SYSTEM_STAFF_ID,
    transaction_date: new Date().toISOString().split('T')[0],
  })

  if (error) {
    console.error('Failed to create transaction:', error)
    // Don't throw - transaction logging shouldn't fail the webhook
  } else {
    console.log(`✓ Transaction created: ${options.category} ${options.amountCents} cents`)
  }
}

// Block member access (subscription cancelled or payment failed permanently)
async function blockMemberAccess(
  supabase: SupabaseClient,
  memberId: string,
  reason: string
) {
  const { error } = await supabase
    .from('members')
    .update({
      status: 'BLOQUEADO',
      stripe_subscription_id: null, // Clear subscription reference
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId)

  if (error) {
    console.error('Failed to block member:', error)
    throw error
  }

  console.log(`✓ Member ${memberId} blocked: ${reason}`)
}

// Create subscription record for tracking
async function createSubscriptionRecord(
  supabase: SupabaseClient,
  options: {
    memberId: string
    stripeSubscriptionId?: string
    stripePriceId?: string
    modalities: string[]  // modality codes like 'boxe', 'muay_thai'
    weeklyLimit: number | null
    modalitiesCount: number
    accessType: string
    accessExpiresAt: string
    commitmentMonths?: number
    amountCents: number
    enrollmentFeeCents?: number
  }
) {
  // Look up modality UUIDs from codes
  let modalityIds: string[] = []
  if (options.modalities.length > 0) {
    const { data: modalityRows } = await supabase
      .from('modalities')
      .select('id')
      .in('code', options.modalities)

    modalityIds = modalityRows?.map(m => m.id) || []
  }

  const { data, error } = await supabase.from('subscriptions').insert({
    member_id: options.memberId,
    stripe_subscription_id: options.stripeSubscriptionId,
    stripe_price_id: options.stripePriceId,
    modalities: modalityIds,
    commitment_months: options.commitmentMonths || 1,
    calculated_price_cents: options.amountCents,
    commitment_discount_pct: 0,
    promo_discount_pct: 0,
    final_price_cents: options.amountCents,
    enrollment_fee_cents: options.enrollmentFeeCents || 0,
    starts_at: new Date().toISOString().split('T')[0],
    expires_at: options.accessExpiresAt,
    status: 'active',
    created_by: SYSTEM_STAFF_ID,
  }).select('id').single()

  if (error) {
    console.error('Failed to create subscription record:', error)
    return null
  }

  console.log(`✓ Subscription record created: ${data.id}`)

  // Update member with subscription reference
  await supabase.from('members').update({
    current_subscription_id: data.id,
  }).eq('id', options.memberId)

  return data.id
}

// Also log to legacy stripe_payment_ledger for backwards compatibility
async function logToLegacyLedger(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
  memberId: string | null,
  autoMatched: boolean,
  eventType: string
) {
  const customerEmail = session.customer_details?.email || session.customer_email
  const customerName = session.customer_details?.name || session.metadata?.customer_name
  const isNewMember = session.metadata?.is_new_member === 'true'

  const { error } = await supabase.from('stripe_payment_ledger').insert({
    stripe_session_id: session.id,
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
    stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
    customer_email: customerEmail,
    customer_name: customerName,
    amount_total: session.amount_total || 0,
    currency: session.currency || 'eur',
    payment_status: session.payment_status,
    payment_method: session.payment_method_types?.[0] || 'card',
    product_type: session.mode,
    is_new_member: isNewMember,
    matched_member_id: memberId,
    auto_matched: autoMatched,
    confirmed: true, // Auto-confirmed in new architecture
    metadata: session.metadata || {},
    event_type: eventType,
    event_id: `checkout_${session.id}`,
  })

  if (error && !error.message.includes('duplicate')) {
    console.error('Failed to log to legacy ledger:', error)
  }
}

// Generate display name for payment link based on metadata
function generatePaymentLinkDisplayName(
  frequencia: string,
  compromisso: string,
  amountCents: number,
  includesEnrollment: boolean,
  isFamilyFriends: boolean
): string {
  const freqLabels: Record<string, string> = {
    '1x': '1x/semana',
    '2x': '2x/semana',
    '3x': '3x/semana',
    'unlimited': 'Ilimitado',
  }

  const compLabels: Record<string, string> = {
    'mensal': '',
    'trimestral': 'Trimestral',
    'semestral': 'Semestral',
    'anual': 'Anual',
  }

  const price = `€${(amountCents / 100).toFixed(0)}`
  const freq = freqLabels[frequencia] || frequencia
  const comp = compLabels[compromisso] || compromisso

  let name = freq
  if (comp) name += ` ${comp}`
  if (includesEnrollment) name += ' + Matrícula'
  if (isFamilyFriends) name = `F&F ${name}`
  name += ` ${price}`

  return name
}

serve(async (req) => {
  try {
    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!stripeSecretKey || !webhookSecret) {
      console.error('Missing required environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Get webhook signature
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      console.error('No stripe-signature header found')
      return new Response('No signature', { status: 400 })
    }

    // Read raw body
    const body = await req.text()

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
        undefined,
        Stripe.createSubtleCryptoProvider()
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err instanceof Error ? err.message : err)
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Webhook event received: ${event.type} (${event.id})`)

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    })

    // Check idempotency - was this event already processed?
    if (await isEventProcessed(supabase, event.id)) {
      console.log('Event already processed (idempotent):', event.id)
      return new Response(
        JSON.stringify({ received: true, message: 'Already processed' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // EVENT: checkout.session.completed
    // New enrollment or one-time payment
    // ============================================
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      console.log('Processing checkout session:', session.id)

      const customerEmail = session.customer_details?.email || session.customer_email
      const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null
      const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null

      // Get memberId from metadata
      const rawMemberId = session.client_reference_id || session.metadata?.member_id
      let memberId = rawMemberId && rawMemberId.trim() !== '' ? rawMemberId : null
      let autoMatched = false

      // Try to auto-match member if not provided
      if (!memberId) {
        // First try by Stripe customer ID
        if (stripeCustomerId) {
          const member = await findMemberByStripeCustomerId(supabase, stripeCustomerId)
          if (member) {
            memberId = member.id
            autoMatched = true
            console.log(`Auto-matched by customer ID: ${memberId}`)
          }
        }

        // Then try by email
        if (!memberId && customerEmail) {
          const member = await findMemberByEmail(supabase, customerEmail)
          if (member) {
            memberId = member.id
            autoMatched = true
            console.log(`Auto-matched by email: ${memberId}`)
          }
        }
      }

      // Calculate access expiration
      let accessExpiresAt: string
      if (stripeSubscriptionId) {
        // For subscriptions, fetch subscription details to get current_period_end
        try {
          const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
          accessExpiresAt = new Date(subscription.current_period_end * 1000).toISOString().split('T')[0]
          console.log(`Subscription period ends: ${accessExpiresAt}`)
        } catch {
          // Fallback to 30 days
          const expiresDate = new Date()
          expiresDate.setDate(expiresDate.getDate() + 30)
          accessExpiresAt = expiresDate.toISOString().split('T')[0]
        }
      } else {
        // One-time payment: assume 30 days access (configurable via metadata)
        const daysAccess = parseInt(session.metadata?.days_access || '30', 10)
        const expiresDate = new Date()
        expiresDate.setDate(expiresDate.getDate() + daysAccess)
        accessExpiresAt = expiresDate.toISOString().split('T')[0]
      }

      // ============================================
      // READ PRICE METADATA (PRIMARY SOURCE)
      // Metadata is stored on the Price object, not Payment Link
      // This is the correct Stripe pattern: 1 product with multiple prices
      // ============================================
      let weeklyLimit: number | null = null
      let modalitiesCount: number = 1
      let accessType: string = stripeSubscriptionId ? 'SUBSCRIPTION' : 'DAILY_PASS'
      let modalityCodes: string[] = []  // e.g., ['boxe', 'muay_thai']
      let stripePriceId: string | undefined = undefined
      let commitmentMonths: number = 1

      // ============================================
      // BUNDLE DETECTION: Check line_items for bundle (plano + matrícula)
      // Production Payment Links have:
      // - "Membership" links: 2 line_items (plan + enrollment fee)
      // - "Discount" links: 1 line_item (plan only)
      // ============================================
      let isBundle = false
      let planLineItem: { price: Stripe.Price | null; amount_total: number } | null = null
      let enrollmentLineItem: { price: Stripe.Price | null; amount_total: number } | null = null
      let detectedEnrollmentFeeCents = 0

      // Fetch checkout session with line_items to get Price metadata
      try {
        console.log(`Fetching session line_items for metadata...`)
        const sessionWithLineItems = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items.data.price'],
        })

        const lineItems = sessionWithLineItems.line_items?.data || []
        console.log(`Found ${lineItems.length} line item(s)`)

        // Detect bundle: if we have 2 items, one is plan and one is enrollment fee
        if (lineItems.length === 2) {
          isBundle = true
          console.log(`Bundle detected: 2 line items`)

          // Find which is the plan and which is enrollment fee
          // Enrollment fee is typically the one-time price (not recurring)
          // or has 'enrollment' or 'matricula' in the product name/metadata
          for (const item of lineItems) {
            const price = item.price as Stripe.Price
            const productMetadata = price?.metadata || {}
            const isEnrollmentItem =
              price?.type === 'one_time' ||
              productMetadata.is_enrollment_fee === 'true' ||
              price?.nickname?.toLowerCase().includes('matrícula') ||
              price?.nickname?.toLowerCase().includes('matricula') ||
              price?.nickname?.toLowerCase().includes('enrollment')

            if (isEnrollmentItem) {
              enrollmentLineItem = { price, amount_total: item.amount_total || 0 }
              detectedEnrollmentFeeCents = item.amount_total || 0
              console.log(`  - Enrollment fee: ${price?.nickname || price?.id} = ${detectedEnrollmentFeeCents} cents`)
            } else {
              planLineItem = { price, amount_total: item.amount_total || 0 }
              console.log(`  - Plan: ${price?.nickname || price?.id} = ${item.amount_total} cents`)
            }
          }

          // If we couldn't distinguish, assume first is plan, second is enrollment
          if (!planLineItem && !enrollmentLineItem) {
            planLineItem = { price: lineItems[0].price as Stripe.Price, amount_total: lineItems[0].amount_total || 0 }
            enrollmentLineItem = { price: lineItems[1].price as Stripe.Price, amount_total: lineItems[1].amount_total || 0 }
            detectedEnrollmentFeeCents = lineItems[1].amount_total || 0
            console.log(`  - Could not distinguish, assuming: plan=${planLineItem.amount_total}, enrollment=${detectedEnrollmentFeeCents}`)
          }
        } else if (lineItems.length === 1) {
          // Single item - just the plan (renewal or discount link)
          planLineItem = { price: lineItems[0].price as Stripe.Price, amount_total: lineItems[0].amount_total || 0 }
          console.log(`Single item checkout: plan=${planLineItem.amount_total} cents`)
        }

        // Get Price metadata from the PLAN line item (not enrollment fee)
        const price = planLineItem?.price
        if (price) {
          stripePriceId = price.id
          console.log(`Price ID: ${stripePriceId}`)

          if (price.metadata) {
            const metadata = price.metadata
            console.log(`Price metadata found:`, JSON.stringify(metadata))

            // Extract weekly_limit (null = unlimited, number = max check-ins per 7 days)
            if (metadata.weekly_limit) {
              const parsed = parseInt(metadata.weekly_limit, 10)
              weeklyLimit = isNaN(parsed) ? null : parsed
            }

            // Extract modalities_count ('ALL' = 99, otherwise parse as number)
            if (metadata.modalities_count) {
              if (metadata.modalities_count.toUpperCase() === 'ALL') {
                modalitiesCount = 99
              } else {
                const parsed = parseInt(metadata.modalities_count, 10)
                modalitiesCount = isNaN(parsed) ? 1 : parsed
              }
            }

            // Extract modalities codes (e.g., "boxe,muay_thai")
            if (metadata.modalities) {
              modalityCodes = metadata.modalities.split(',').map((s: string) => s.trim()).filter((s: string) => s)
              console.log(`Modality codes parsed: ${modalityCodes.join(', ')}`)
            }

            // Extract access_type (SUBSCRIPTION, DAILY_PASS, CREDITS, ADDON)
            if (metadata.access_type) {
              accessType = metadata.access_type
            }

            // Extract commitment_months (1, 3, 6, 12)
            if (metadata.commitment_months) {
              const parsed = parseInt(metadata.commitment_months, 10)
              commitmentMonths = isNaN(parsed) ? 1 : parsed
            }

            console.log(`Price metadata parsed: weekly_limit=${weeklyLimit}, modalities_count=${modalitiesCount}, access_type=${accessType}, commitment_months=${commitmentMonths}`)
          } else {
            console.log('No price metadata found, using defaults')
          }
        }
      } catch (err) {
        console.error('Failed to fetch Price metadata:', err)
        // Continue with default values
      }

      // Activate member if matched
      if (memberId && session.payment_status === 'paid') {
        await activateMemberAccess(supabase, memberId, {
          stripeCustomerId: stripeCustomerId || undefined,
          stripeSubscriptionId: stripeSubscriptionId || undefined,
          accessExpiresAt,
          accessType,
          weeklyLimit,
          modalitiesCount,
        })

        // ============================================
        // CREATE TRANSACTION RECORDS
        // This makes Stripe payments appear in financial reports
        // Bundle detection: use line_items over metadata
        // ============================================
        const isNewMember = session.metadata?.is_new_member === 'true' || isBundle

        // Use detected amounts from line_items (more accurate than metadata)
        const enrollmentFeeCents = detectedEnrollmentFeeCents > 0
          ? detectedEnrollmentFeeCents
          : parseInt(session.metadata?.enrollment_fee_cents || '0', 10)

        const planAmount = planLineItem?.amount_total || (session.amount_total || 0) - enrollmentFeeCents

        console.log(`Transaction breakdown: plan=${planAmount}, enrollment=${enrollmentFeeCents}, isBundle=${isBundle}`)

        // Transaction 1: Plan payment
        if (planAmount > 0) {
          await createTransaction(supabase, {
            type: 'RECEITA',
            amountCents: planAmount,
            category: accessType === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : accessType === 'CREDITS' ? 'CREDITS' : 'DAILY_PASS',
            memberId,
            description: isNewMember ? `Matrícula (Stripe): ${session.id}` : `Renovação (Stripe): ${session.id}`,
            stripeSessionId: session.id,
          })
        }

        // Transaction 2: Enrollment fee (if applicable - from bundle or metadata)
        if (enrollmentFeeCents > 0) {
          await createTransaction(supabase, {
            type: 'RECEITA',
            amountCents: enrollmentFeeCents,
            category: 'TAXA_MATRICULA',
            memberId,
            description: `Taxa de Matrícula (Stripe): ${session.id}`,
            stripeSessionId: session.id,
          })
        }

        // ============================================
        // CREATE SUBSCRIPTION RECORD
        // This stores the full snapshot of what the member purchased
        // ============================================
        if (stripeSubscriptionId || accessType === 'SUBSCRIPTION') {
          await createSubscriptionRecord(supabase, {
            memberId,
            stripeSubscriptionId: stripeSubscriptionId || undefined,
            stripePriceId,
            modalities: modalityCodes,
            weeklyLimit,
            modalitiesCount,
            accessType,
            accessExpiresAt,
            commitmentMonths,
            amountCents: planAmount,
            enrollmentFeeCents: enrollmentFeeCents, // Uses bundle-detected or metadata value
          })
        }
      }

      // Log to legacy ledger for backwards compatibility
      await logToLegacyLedger(supabase, session, memberId, autoMatched, event.type)

      // Log success
      await logStripeEvent(supabase, event.id, event.type, session, true)
      console.log(`✓ Checkout session processed: ${session.id}`)
    }

    // ============================================
    // EVENT: invoice.paid
    // Subscription renewal or offline payment confirmed
    // ============================================
    else if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice

      console.log('Processing paid invoice:', invoice.id)

      const customerId = typeof invoice.customer === 'string' ? invoice.customer : null
      let subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null

      if (!customerId) {
        console.log('No customer ID in invoice, skipping')
        await logStripeEvent(supabase, event.id, event.type, invoice, true)
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      // Find member by Stripe customer ID
      let member = await findMemberByStripeCustomerId(supabase, customerId)

      // Fallback 1: Try to find by member_id in subscription metadata (if subscription ID is known)
      if (!member && subscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const memberIdFromMetadata = subscription.metadata?.member_id
          if (memberIdFromMetadata) {
            console.log(`[invoice.paid] Fallback 1: looking up member by subscription metadata: ${memberIdFromMetadata}`)
            const { data } = await supabase
              .from('members')
              .select('id, status, access_expires_at')
              .eq('id', memberIdFromMetadata)
              .single()
            member = data

            // Also update the member's stripe_customer_id for future lookups
            if (member) {
              await supabase
                .from('members')
                .update({ stripe_customer_id: customerId })
                .eq('id', member.id)
              console.log(`[invoice.paid] Updated member ${member.id} stripe_customer_id to ${customerId}`)
            }
          }
        } catch (err) {
          console.error('[invoice.paid] Fallback 1 failed:', err)
        }
      }

      // Fallback 2: List customer's subscriptions and find member_id in metadata
      // This handles cases where invoice.subscription is null (common with first invoice)
      if (!member && customerId) {
        try {
          console.log(`[invoice.paid] Fallback 2: listing subscriptions for customer ${customerId}`)
          const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            limit: 5,
          })

          for (const sub of subscriptions.data) {
            const memberIdFromMetadata = sub.metadata?.member_id
            if (memberIdFromMetadata) {
              console.log(`[invoice.paid] Found member_id ${memberIdFromMetadata} in subscription ${sub.id}`)
              const { data } = await supabase
                .from('members')
                .select('id, status, access_expires_at')
                .eq('id', memberIdFromMetadata)
                .single()

              if (data) {
                member = data
                // Update stripe_customer_id for future lookups
                await supabase
                  .from('members')
                  .update({ stripe_customer_id: customerId })
                  .eq('id', member.id)
                console.log(`[invoice.paid] Updated member ${member.id} stripe_customer_id to ${customerId}`)

                // Also capture the subscriptionId for later use
                if (!subscriptionId) {
                  subscriptionId = sub.id
                }
                break
              }
            }
          }
        } catch (err) {
          console.error('[invoice.paid] Fallback 2 failed:', err)
        }
      }

      if (!member) {
        console.log(`No member found for customer ${customerId}, skipping`)
        await logStripeEvent(supabase, event.id, event.type, invoice, true)
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      // Calculate access expiration from subscription or invoice period
      let accessExpiresAt: string
      let weeklyLimit: number | null = null
      let modalitiesCount: number | undefined = undefined
      let accessType: string | undefined = undefined

      if (subscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          accessExpiresAt = new Date(subscription.current_period_end * 1000).toISOString().split('T')[0]

          // ============================================
          // FIX: Re-read Price metadata on renewal!
          // This was missing and caused weekly_limit to become NULL
          // ============================================
          const priceId = subscription.items.data[0]?.price?.id
          if (priceId) {
            const price = await stripe.prices.retrieve(priceId)
            if (price.metadata) {
              console.log(`[invoice.paid] Re-reading Price metadata:`, JSON.stringify(price.metadata))

              // Extract weekly_limit (null = unlimited)
              if (price.metadata.weekly_limit) {
                const parsed = parseInt(price.metadata.weekly_limit, 10)
                weeklyLimit = isNaN(parsed) ? null : parsed
              }

              // Extract modalities_count ('ALL' = 99)
              if (price.metadata.modalities_count) {
                if (price.metadata.modalities_count.toUpperCase() === 'ALL') {
                  modalitiesCount = 99
                } else {
                  const parsed = parseInt(price.metadata.modalities_count, 10)
                  modalitiesCount = isNaN(parsed) ? undefined : parsed
                }
              }

              // Extract access_type
              if (price.metadata.access_type) {
                accessType = price.metadata.access_type
              }

              console.log(`[invoice.paid] Metadata parsed: weekly_limit=${weeklyLimit}, modalities_count=${modalitiesCount}, access_type=${accessType}`)
            }
          }
        } catch (err) {
          console.error('[invoice.paid] Failed to retrieve subscription/price:', err)
          // Fallback: extend by 30 days
          const expiresDate = new Date()
          expiresDate.setDate(expiresDate.getDate() + 30)
          accessExpiresAt = expiresDate.toISOString().split('T')[0]
        }
      } else {
        // One-time invoice (offline payment): read all metadata from invoice
        console.log(`[invoice.paid] One-time invoice, reading metadata from invoice`)

        const daysAccess = parseInt(invoice.metadata?.days_access || '30', 10)
        const expiresDate = new Date()
        expiresDate.setDate(expiresDate.getDate() + daysAccess)
        accessExpiresAt = expiresDate.toISOString().split('T')[0]

        // Read access configuration from invoice metadata (set by create-offline-invoice)
        if (invoice.metadata?.weekly_limit) {
          const parsed = parseInt(invoice.metadata.weekly_limit, 10)
          weeklyLimit = isNaN(parsed) ? null : parsed
        }

        if (invoice.metadata?.modalities_count) {
          const parsed = parseInt(invoice.metadata.modalities_count, 10)
          modalitiesCount = isNaN(parsed) ? undefined : parsed
        }

        if (invoice.metadata?.access_type) {
          accessType = invoice.metadata.access_type
        }

        console.log(`[invoice.paid] One-time invoice metadata: days=${daysAccess}, weekly_limit=${weeklyLimit}, modalities=${modalitiesCount}, type=${accessType}`)
      }

      // Activate/renew member access (NOW WITH METADATA!)
      await activateMemberAccess(supabase, member.id, {
        stripeSubscriptionId: subscriptionId || undefined,
        accessExpiresAt,
        accessType: accessType || (subscriptionId ? 'SUBSCRIPTION' : member.status === 'ATIVO' ? undefined : 'DAILY_PASS'),
        weeklyLimit,
        modalitiesCount,
      })

      // ============================================
      // CREATE TRANSACTION FOR RENEWAL
      // ============================================
      const invoiceTotal = invoice.amount_paid || 0
      if (invoiceTotal > 0) {
        await createTransaction(supabase, {
          type: 'RECEITA',
          amountCents: invoiceTotal,
          category: 'SUBSCRIPTION',
          memberId: member.id,
          description: `Renovação automática (Stripe): ${invoice.id}`,
          stripeSessionId: invoice.id, // Using invoice ID for reference
        })
      }

      await logStripeEvent(supabase, event.id, event.type, invoice, true)
      console.log(`✓ Invoice paid processed: ${invoice.id}`)
    }

    // ============================================
    // EVENT: invoice.payment_failed
    // Payment failure - Stripe will retry automatically
    // ============================================
    else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice

      console.log('Invoice payment failed:', invoice.id)

      // Note: We don't immediately block the member
      // Stripe has retry logic (dunning) that will attempt again
      // We only block when subscription is cancelled (after all retries fail)

      // TODO: Send notification to member about failed payment

      await logStripeEvent(supabase, event.id, event.type, invoice, true)
      console.log(`⚠ Invoice payment failed logged: ${invoice.id}`)
    }

    // ============================================
    // EVENT: customer.subscription.updated
    // Subscription status changed
    // ============================================
    else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription

      console.log('Subscription updated:', subscription.id, 'status:', subscription.status)

      const customerId = typeof subscription.customer === 'string' ? subscription.customer : null

      if (!customerId) {
        console.log('No customer ID in subscription, skipping')
        await logStripeEvent(supabase, event.id, event.type, subscription, true)
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      const member = await findMemberByStripeCustomerId(supabase, customerId)

      if (!member) {
        console.log(`No member found for customer ${customerId}, skipping`)
        await logStripeEvent(supabase, event.id, event.type, subscription, true)
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      // Handle based on subscription status
      if (subscription.status === 'active') {
        // Subscription is active - ensure member has access
        const accessExpiresAt = new Date(subscription.current_period_end * 1000).toISOString().split('T')[0]
        await activateMemberAccess(supabase, member.id, {
          stripeSubscriptionId: subscription.id,
          accessExpiresAt,
          accessType: 'SUBSCRIPTION',
        })
      } else if (subscription.status === 'past_due') {
        // Payment failed but Stripe is retrying - don't block yet
        console.log(`Subscription ${subscription.id} is past_due - awaiting retry`)
        // TODO: Send reminder notification
      } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
        // Subscription ended - block access
        await blockMemberAccess(supabase, member.id, `Subscription ${subscription.status}`)
      }

      await logStripeEvent(supabase, event.id, event.type, subscription, true)
      console.log(`✓ Subscription update processed: ${subscription.id}`)
    }

    // ============================================
    // EVENT: customer.subscription.deleted
    // Subscription cancelled
    // ============================================
    else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription

      console.log('Subscription deleted:', subscription.id)

      const customerId = typeof subscription.customer === 'string' ? subscription.customer : null

      if (customerId) {
        const member = await findMemberByStripeCustomerId(supabase, customerId)

        if (member) {
          await blockMemberAccess(supabase, member.id, 'Subscription cancelled')
        }
      }

      await logStripeEvent(supabase, event.id, event.type, subscription, true)
      console.log(`✓ Subscription deletion processed: ${subscription.id}`)
    }

    // ============================================
    // EVENT: payment_link.created / payment_link.updated
    // Auto-sync payment links to local table
    // ============================================
    else if (event.type === 'payment_link.created' || event.type === 'payment_link.updated') {
      const paymentLink = event.data.object as Stripe.PaymentLink

      console.log(`Payment link ${event.type}:`, paymentLink.id)

      // Parse metadata
      const metadata = paymentLink.metadata || {}
      const frequencia = metadata.frequencia || 'unlimited'
      const compromisso = metadata.compromisso || 'mensal'
      const includesEnrollmentFee = metadata.includes_enrollment_fee === 'true'
      const isFamilyFriends = metadata.is_family_friends === 'true'
      const displayName = metadata.display_name || null

      // Fetch line items to get total amount
      let totalAmountCents = 0
      let priceId = ''
      let enrollmentPriceId: string | null = null

      try {
        const lineItems = await stripe.paymentLinks.listLineItems(paymentLink.id, {
          limit: 10,
        })

        for (const item of lineItems.data) {
          if (item.price) {
            const price = item.price
            const amount = (price.unit_amount || 0) * (item.quantity || 1)
            totalAmountCents += amount

            // Determine if this is enrollment fee or main price
            const priceMetadata = price.metadata || {}
            const isEnrollmentPrice =
              priceMetadata.type === 'enrollment_fee' ||
              price.nickname?.toLowerCase().includes('matrícula') ||
              price.nickname?.toLowerCase().includes('matricula') ||
              price.nickname?.toLowerCase().includes('enrollment')

            if (isEnrollmentPrice) {
              enrollmentPriceId = price.id
            } else {
              priceId = price.id
            }
          }
        }

        // Fallback if no specific price identified
        if (!priceId && lineItems.data.length > 0 && lineItems.data[0].price) {
          priceId = lineItems.data[0].price.id
        }
      } catch (lineItemError) {
        console.error('Error fetching line items:', lineItemError)
      }

      if (!priceId) {
        console.log('No price found for payment link, skipping sync')
        await logStripeEvent(supabase, event.id, event.type, paymentLink, true)
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      // Generate display name if not provided
      const generatedDisplayName = displayName || generatePaymentLinkDisplayName(
        frequencia,
        compromisso,
        totalAmountCents,
        includesEnrollmentFee,
        isFamilyFriends
      )

      // Check if link already exists
      const { data: existing } = await supabase
        .from('stripe_payment_links')
        .select('id')
        .eq('payment_link_id', paymentLink.id)
        .single()

      const linkData = {
        frequencia,
        compromisso,
        includes_enrollment_fee: includesEnrollmentFee,
        is_family_friends: isFamilyFriends,
        payment_link_id: paymentLink.id,
        payment_link_url: paymentLink.url,
        price_id: priceId,
        enrollment_price_id: enrollmentPriceId,
        amount_cents: totalAmountCents,
        display_name: generatedDisplayName,
        ativo: paymentLink.active,
        updated_at: new Date().toISOString(),
      }

      if (existing) {
        const { error } = await supabase
          .from('stripe_payment_links')
          .update(linkData)
          .eq('id', existing.id)

        if (error) {
          console.error('Error updating payment link:', error)
        } else {
          console.log(`✓ Updated payment link: ${generatedDisplayName}`)
        }
      } else {
        const { error } = await supabase
          .from('stripe_payment_links')
          .insert(linkData)

        if (error) {
          console.error('Error inserting payment link:', error)
        } else {
          console.log(`✓ Created payment link: ${generatedDisplayName}`)
        }
      }

      await logStripeEvent(supabase, event.id, event.type, paymentLink, true)
    }

    // ============================================
    // OTHER EVENTS
    // Log for audit but no action needed
    // ============================================
    else {
      console.log('Unhandled event type:', event.type)
      await logStripeEvent(supabase, event.id, event.type, event.data.object, true)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
