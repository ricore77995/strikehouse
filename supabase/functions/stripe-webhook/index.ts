import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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

    console.log(`Webhook event received: ${event.type}`)

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

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      console.log('Processing checkout session:', session.id)

      const customerEmail = session.customer_details?.email || session.customer_email
      const customerName = session.customer_details?.name || session.metadata?.customer_name
      const isNewMember = session.metadata?.is_new_member === 'true'
      const memberId = session.client_reference_id || session.metadata?.member_id

      console.log('Session details:', {
        customerEmail,
        customerName,
        isNewMember,
        memberId,
        amountTotal: session.amount_total,
        paymentStatus: session.payment_status,
      })

      // Try to auto-match member by email if memberId not provided
      let matchedMemberId = memberId
      let autoMatched = false

      if (!matchedMemberId && customerEmail) {
        console.log('Attempting auto-match by email:', customerEmail)
        const { data: members, error: matchError } = await supabase
          .from('members')
          .select('id, nome, email')
          .ilike('email', customerEmail)
          .limit(1)

        if (matchError) {
          console.error('Error querying members:', matchError)
        } else if (members && members.length > 0) {
          matchedMemberId = members[0].id
          autoMatched = true
          console.log(`Auto-matched to member: ${members[0].nome} (${matchedMemberId})`)
        } else {
          console.log('No member found with email:', customerEmail)
        }
      }

      // Check if this event was already processed (idempotency)
      const eventId = `checkout_${session.id}`
      const { data: existingEntry } = await supabase
        .from('stripe_payment_ledger')
        .select('id')
        .eq('event_id', eventId)
        .single()

      if (existingEntry) {
        console.log('Event already processed (idempotent):', eventId)
        return new Response(
          JSON.stringify({ received: true, message: 'Already processed' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Insert into stripe_payment_ledger
      const { error: insertError } = await supabase
        .from('stripe_payment_ledger')
        .insert({
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
          matched_member_id: matchedMemberId,
          auto_matched: autoMatched,
          confirmed: false,
          metadata: session.metadata || {},
          event_type: event.type,
          event_id: eventId,
        })

      if (insertError) {
        console.error('Failed to insert into ledger:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to log payment', details: insertError.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }

      console.log(`✓ Payment logged to ledger${matchedMemberId ? ` - matched to ${matchedMemberId}` : ' - awaiting manual match'}`)
    }

    // Handle other event types (future expansion)
    else if (event.type === 'invoice.payment_succeeded') {
      console.log('Invoice payment succeeded:', event.data.object.id)
      // TODO: Handle recurring subscription payments
    }
    else if (event.type === 'customer.subscription.deleted') {
      console.log('Subscription deleted:', event.data.object.id)
      // TODO: Handle subscription cancellation
    }
    else {
      console.log('Unhandled event type:', event.type)
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
