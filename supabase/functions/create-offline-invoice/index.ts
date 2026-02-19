import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

/**
 * Create Offline Invoice
 *
 * Creates a Stripe Invoice for offline payments (DINHEIRO, TRANSFERENCIA, CARTAO TPA, MBWAY).
 * For DINHEIRO, the invoice is immediately marked as paid (paid_out_of_band).
 * For TRANSFERENCIA, the invoice remains open until admin confirms.
 *
 * Request body:
 * {
 *   memberId: string,
 *   items: [{ priceId: string, quantity: number }],
 *   paymentMethod: 'DINHEIRO' | 'TRANSFERENCIA' | 'CARTAO' | 'MBWAY',
 *   staffId: string,
 *   description?: string
 * }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AccessMetadata {
  daysAccess?: number       // How many days of access to grant (default 30)
  weeklyLimit?: number | null  // Weekly check-in limit (null = unlimited)
  modalitiesCount?: number  // Number of modalities included
  accessType?: string       // SUBSCRIPTION, CREDITS, DAILY_PASS
  frequencia?: string       // 1x, 2x, 3x, unlimited
  compromisso?: string      // mensal, trimestral, semestral, anual
  displayName?: string      // Plan name for reference
}

interface RequestBody {
  memberId: string
  // Items can use priceId (one_time prices only) OR amountCents (for recurring prices)
  items: Array<{ priceId?: string; amountCents?: number; quantity: number; description?: string }>
  paymentMethod: 'DINHEIRO' | 'TRANSFERENCIA' | 'CARTAO' | 'MBWAY'
  staffId: string
  description?: string
  accessMetadata?: AccessMetadata  // Plan metadata for member activation
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing')
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    })

    // Parse request body
    const body: RequestBody = await req.json()

    // Validate required fields
    if (!body.memberId || !body.items || !body.paymentMethod || !body.staffId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: memberId, items, paymentMethod, staffId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (body.items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one item is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch member from database
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, nome, email, stripe_customer_id')
      .eq('id', body.memberId)
      .single()

    if (memberError || !member) {
      return new Response(
        JSON.stringify({ error: 'Member not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get or create Stripe Customer
    let stripeCustomerId = member.stripe_customer_id

    if (!stripeCustomerId) {
      // Create new Stripe Customer
      const customer = await stripe.customers.create({
        email: member.email || undefined,
        name: member.nome,
        metadata: {
          member_id: member.id,
          source: 'boxemaster_pro',
        },
      })
      stripeCustomerId = customer.id

      // Update member with Stripe customer ID
      await supabase
        .from('members')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', member.id)

      console.log(`Created Stripe customer ${stripeCustomerId} for member ${member.id}`)
    }

    // Create idempotency key to prevent duplicate invoices
    // Key is stable per member + date + amount (no timestamp) to prevent duplicates on retry
    const today = new Date().toISOString().split('T')[0]
    const totalAmount = body.items.reduce((sum, item) => sum + ((item.amountCents || 0) * (item.quantity || 1)), 0)
    const idempotencyKey = `offline_invoice_${body.memberId}_${today}_${totalAmount}_${body.paymentMethod}`

    // Extract access metadata with defaults
    const accessMeta = body.accessMetadata || {}
    const daysAccess = accessMeta.daysAccess || 30
    const weeklyLimit = accessMeta.weeklyLimit
    const modalitiesCount = accessMeta.modalitiesCount
    const accessType = accessMeta.accessType || 'SUBSCRIPTION'
    const frequencia = accessMeta.frequencia || 'unlimited'
    const compromisso = accessMeta.compromisso || 'mensal'
    const displayName = accessMeta.displayName || 'Plano'

    // Create invoice with all metadata for webhook processing
    const invoice = await stripe.invoices.create(
      {
        customer: stripeCustomerId,
        collection_method: body.paymentMethod === 'TRANSFERENCIA' ? 'send_invoice' : 'charge_automatically',
        days_until_due: body.paymentMethod === 'TRANSFERENCIA' ? 7 : undefined,
        auto_advance: false, // Don't auto-finalize, we'll do it manually
        metadata: {
          // Core identifiers
          member_id: body.memberId,
          staff_id: body.staffId,
          payment_method: body.paymentMethod,
          offline_payment: 'true',
          // Access configuration (for webhook to activate member)
          days_access: String(daysAccess),
          weekly_limit: weeklyLimit !== null && weeklyLimit !== undefined ? String(weeklyLimit) : '',
          modalities_count: modalitiesCount ? String(modalitiesCount) : '',
          access_type: accessType,
          // Plan info for reference
          frequencia,
          compromisso,
          display_name: displayName,
        },
        description: body.description || `${displayName} - ${body.paymentMethod}`,
      },
      { idempotencyKey: `${idempotencyKey}_create` }
    )

    console.log(`Created invoice ${invoice.id} for member ${body.memberId}`)

    // Add line items - v2: fixed amount/quantity conflict
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i]
      const totalAmount = (item.amountCents || 0) * (item.quantity || 1)

      // Use amountCents if provided (for recurring prices), otherwise use priceId (for one_time prices)
      // Note: Stripe doesn't allow both 'amount' and 'quantity' - we calculate total amount ourselves
      if (item.amountCents && totalAmount > 0) {
        console.log(`Adding invoice item with amount: ${totalAmount} cents`)
        await stripe.invoiceItems.create(
          {
            customer: stripeCustomerId,
            invoice: invoice.id,
            amount: totalAmount,
            currency: 'eur',
            description: item.description || displayName,
          },
          { idempotencyKey: `${idempotencyKey}_item_${i}` }
        )
      } else if (item.priceId) {
        await stripe.invoiceItems.create(
          {
            customer: stripeCustomerId,
            invoice: invoice.id,
            price: item.priceId,
            quantity: item.quantity,
            description: item.description,
          },
          { idempotencyKey: `${idempotencyKey}_item_${item.priceId}` }
        )
      }
    }

    // Finalize the invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(
      invoice.id,
      {},
      { idempotencyKey: `${idempotencyKey}_finalize` }
    )

    console.log(`Finalized invoice ${finalizedInvoice.id}, total: ${finalizedInvoice.amount_due}`)

    // For immediate payment methods, mark as paid out-of-band AND activate member
    if (['DINHEIRO', 'CARTAO', 'MBWAY'].includes(body.paymentMethod)) {
      const paidInvoice = await stripe.invoices.pay(
        finalizedInvoice.id,
        { paid_out_of_band: true },
        { idempotencyKey: `${idempotencyKey}_pay` }
      )

      console.log(`Marked invoice ${paidInvoice.id} as paid out-of-band`)

      // ============================================
      // ACTIVATE MEMBER DIRECTLY (don't wait for webhook)
      // Webhook will be idempotent backup
      // ============================================

      // Calculate access expiration
      const expiresDate = new Date()
      expiresDate.setDate(expiresDate.getDate() + daysAccess)
      const accessExpiresAt = expiresDate.toISOString().split('T')[0]

      // Update member to ATIVO with access configuration
      const { error: memberError } = await supabase
        .from('members')
        .update({
          status: 'ATIVO',
          access_type: accessType,
          access_expires_at: accessExpiresAt,
          weekly_limit: weeklyLimit,
          stripe_customer_id: stripeCustomerId,
        })
        .eq('id', body.memberId)

      if (memberError) {
        console.error('Error activating member:', memberError)
        // Don't fail - invoice is paid, webhook will retry
      } else {
        console.log(`Activated member ${body.memberId} until ${accessExpiresAt}`)
      }

      // ============================================
      // CREATE TRANSACTION
      // ============================================
      const amountCents = paidInvoice.amount_paid || 0

      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          type: 'RECEITA',
          category: 'SUBSCRIPTION',
          amount_cents: amountCents,
          payment_method: body.paymentMethod,
          member_id: body.memberId,
          description: `${displayName} - ${body.paymentMethod}`,
          created_by: body.staffId,
          stripe_payment_intent_id: paidInvoice.payment_intent as string || null,
        })

      if (txError) {
        console.error('Error creating transaction:', txError)
        // Don't fail - member is activated
      } else {
        console.log(`Created transaction for ${amountCents} cents`)
      }

      // ============================================
      // UPDATE CASH SESSION (for DINHEIRO only)
      // ============================================
      if (body.paymentMethod === 'DINHEIRO') {
        const today = new Date().toISOString().split('T')[0]

        const { data: session } = await supabase
          .from('cash_sessions')
          .select('id, total_cash_in_cents')
          .eq('session_date', today)
          .eq('status', 'OPEN')
          .single()

        if (session) {
          await supabase
            .from('cash_sessions')
            .update({ total_cash_in_cents: (session.total_cash_in_cents || 0) + amountCents })
            .eq('id', session.id)

          console.log(`Updated cash session ${session.id}`)
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          invoiceId: paidInvoice.id,
          status: paidInvoice.status,
          amountPaid: paidInvoice.amount_paid,
          memberActivated: true,
          accessExpiresAt,
          message: `Payment processed via ${body.paymentMethod}`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For TRANSFERENCIA, return the invoice URL for member to pay
    return new Response(
      JSON.stringify({
        success: true,
        invoiceId: finalizedInvoice.id,
        status: finalizedInvoice.status,
        amountDue: finalizedInvoice.amount_due,
        invoiceUrl: finalizedInvoice.hosted_invoice_url,
        invoicePdf: finalizedInvoice.invoice_pdf,
        dueDate: finalizedInvoice.due_date ? new Date(finalizedInvoice.due_date * 1000).toISOString() : null,
        message: 'Invoice created, awaiting payment',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error creating offline invoice:', error)

    // Check for Stripe-specific errors
    if (error instanceof Stripe.errors.StripeError) {
      return new Response(
        JSON.stringify({
          error: error.message,
          code: error.code,
          type: error.type,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
