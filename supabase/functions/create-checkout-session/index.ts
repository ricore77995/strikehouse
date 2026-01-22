import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Parse request body
    const { customerEmail, customerName, isNewMember, customMetadata } = await req.json()

    // Validate inputs
    if (!customerEmail || !customerName) {
      return new Response(
        JSON.stringify({ error: 'customerEmail and customerName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!customMetadata?.memberId) {
      return new Response(
        JSON.stringify({ error: 'customMetadata.memberId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Creating checkout session:', {
      customerEmail,
      customerName,
      isNewMember,
      memberId: customMetadata.memberId,
    })

    // Get price IDs from environment
    const PRICE_MONTHLY = Deno.env.get('STRIPE_PRICE_MONTHLY_MEMBERSHIP')
    const PRICE_ENROLLMENT = Deno.env.get('STRIPE_PRICE_ENROLLMENT')

    if (!PRICE_MONTHLY) {
      console.warn('STRIPE_PRICE_MONTHLY_MEMBERSHIP not configured - using test mode')
    }

    // Build line items
    const lineItems = []

    // Always add monthly membership
    if (PRICE_MONTHLY) {
      lineItems.push({ price: PRICE_MONTHLY, quantity: 1 })
    }

    // Add enrollment fee for new members
    if (isNewMember && PRICE_ENROLLMENT) {
      lineItems.push({ price: PRICE_ENROLLMENT, quantity: 1 })
    }

    if (lineItems.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No Stripe price IDs configured. Set STRIPE_PRICE_MONTHLY_MEMBERSHIP and STRIPE_PRICE_ENROLLMENT environment variables.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get site URL for redirects
    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:8080'

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: lineItems,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancelled`,
      customer_email: customerEmail,
      client_reference_id: customMetadata.memberId,
      metadata: {
        customer_name: customerName,
        is_new_member: isNewMember ? 'true' : 'false',
        member_id: customMetadata.memberId,
        plan_id: customMetadata.planId || '',
        created_by: customMetadata.createdBy || '',
        enrollment_fee_cents: (customMetadata.enrollmentFeeCents || 0).toString(),
        pricing_mode: customMetadata.pricingMode || 'plan',
      },
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      expires_at: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    })

    console.log('Checkout session created:', session.id)

    return new Response(
      JSON.stringify({
        checkoutUrl: session.url,
        sessionId: session.id,
        expiresAt: session.expires_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
