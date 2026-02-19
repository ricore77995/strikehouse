import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Update Subscription - Upgrade/Downgrade Plan
 *
 * Changes a member's subscription to a different price.
 * Stripe handles proration automatically.
 *
 * Request body:
 * - memberId: string - Member UUID
 * - newPriceId: string - Stripe Price ID to switch to
 * - newPlanId?: string - Local plan UUID (optional)
 * - prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'
 */

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

    // Parse request
    const { memberId, newPriceId, newPlanId, prorationBehavior = 'create_prorations' } = await req.json()

    if (!memberId || !newPriceId) {
      return new Response(
        JSON.stringify({ error: 'memberId and newPriceId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Updating subscription for member ${memberId} to price ${newPriceId}`)

    // Get member's current subscription
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, nome, stripe_subscription_id, stripe_customer_id')
      .eq('id', memberId)
      .single()

    if (memberError || !member) {
      return new Response(
        JSON.stringify({ error: 'Member not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!member.stripe_subscription_id) {
      return new Response(
        JSON.stringify({ error: 'Member has no active Stripe subscription' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(member.stripe_subscription_id)

    if (subscription.status !== 'active') {
      return new Response(
        JSON.stringify({ error: `Subscription is ${subscription.status}, cannot update` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the subscription item ID
    const itemId = subscription.items.data[0]?.id
    if (!itemId) {
      throw new Error('No subscription item found')
    }

    // Update the subscription with new price
    const updatedSubscription = await stripe.subscriptions.update(member.stripe_subscription_id, {
      items: [{
        id: itemId,
        price: newPriceId,
      }],
      proration_behavior: prorationBehavior,
    })

    console.log(`Subscription updated: ${updatedSubscription.id}`)

    // Get the new price metadata for local updates
    const newPrice = await stripe.prices.retrieve(newPriceId)
    const priceMetadata = newPrice.metadata || {}

    // Update local subscription record
    const updateData: Record<string, unknown> = {
      stripe_price_id: newPriceId,
      updated_at: new Date().toISOString(),
    }

    if (newPlanId) {
      updateData.plan_id = newPlanId
    }

    await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('member_id', memberId)
      .eq('status', 'active')

    // Update member access rules from price metadata
    const memberUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (priceMetadata.weekly_limit) {
      const parsed = parseInt(priceMetadata.weekly_limit, 10)
      memberUpdate.weekly_limit = isNaN(parsed) ? null : parsed
    }

    if (priceMetadata.modalities_count) {
      if (priceMetadata.modalities_count.toUpperCase() === 'ALL') {
        memberUpdate.modalities_count = 99
      } else {
        const parsed = parseInt(priceMetadata.modalities_count, 10)
        if (!isNaN(parsed)) {
          memberUpdate.modalities_count = parsed
        }
      }
    }

    await supabase
      .from('members')
      .update(memberUpdate)
      .eq('id', memberId)

    // Calculate proration amount if available
    let prorationAmount = 0
    if (updatedSubscription.latest_invoice) {
      const invoiceId = typeof updatedSubscription.latest_invoice === 'string'
        ? updatedSubscription.latest_invoice
        : updatedSubscription.latest_invoice.id

      try {
        const invoice = await stripe.invoices.retrieve(invoiceId)
        prorationAmount = invoice.amount_due || 0
      } catch {
        // Invoice might not exist yet
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: updatedSubscription.id,
        newPriceId,
        prorationAmount,
        nextBillingDate: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error updating subscription:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
