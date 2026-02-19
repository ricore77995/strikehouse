import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Cancel Subscription
 *
 * Cancels a member's subscription. Three modes:
 * - Immediate: Cancel now, lose access immediately
 * - At period end: Keep access until current period ends
 * - Revert: Undo a pending cancellation (cancel_at_period_end)
 *
 * Request body:
 * - memberId: string - Member UUID
 * - action?: 'cancel' | 'revert' - Default: 'cancel'
 * - cancelImmediately?: boolean - If true, cancel now (default: false = at period end)
 * - reason?: string - Cancellation reason (optional)
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
    const { memberId, action = 'cancel', cancelImmediately = false, reason } = await req.json()

    if (!memberId) {
      return new Response(
        JSON.stringify({ error: 'memberId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`${action === 'revert' ? 'Reverting cancellation' : 'Cancelling subscription'} for member ${memberId}`)

    // Get member's subscription
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, nome, stripe_subscription_id')
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

    // Handle revert action
    if (action === 'revert') {
      // Undo a pending cancellation
      const subscription = await stripe.subscriptions.retrieve(member.stripe_subscription_id)

      if (!subscription.cancel_at_period_end) {
        return new Response(
          JSON.stringify({ error: 'Subscription is not pending cancellation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const updatedSubscription = await stripe.subscriptions.update(member.stripe_subscription_id, {
        cancel_at_period_end: false,
      })

      console.log(`Cancellation reverted: ${updatedSubscription.id}`)

      // Update local subscription record
      await supabase
        .from('subscriptions')
        .update({
          cancelled_at: null,
          cancellation_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('member_id', memberId)
        .eq('status', 'active')

      return new Response(
        JSON.stringify({
          success: true,
          memberId,
          action: 'reverted',
          nextBillingDate: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
          message: 'Cancellation reverted. Subscription will continue normally.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle cancel action
    let result: { endsAt: string; cancelledNow: boolean }

    if (cancelImmediately) {
      // Cancel immediately - subscription deleted
      const cancelledSubscription = await stripe.subscriptions.cancel(member.stripe_subscription_id)

      console.log(`Subscription cancelled immediately: ${cancelledSubscription.id}`)

      // Update local records
      await supabase
        .from('members')
        .update({
          status: 'CANCELADO',
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memberId)

      await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || 'Cancelamento imediato',
          updated_at: new Date().toISOString(),
        })
        .eq('member_id', memberId)
        .eq('status', 'active')

      result = {
        endsAt: new Date().toISOString(),
        cancelledNow: true,
      }
    } else {
      // Cancel at period end - member keeps access until then
      const updatedSubscription = await stripe.subscriptions.update(member.stripe_subscription_id, {
        cancel_at_period_end: true,
      })

      console.log(`Subscription set to cancel at period end: ${updatedSubscription.id}`)

      const endsAt = new Date(updatedSubscription.current_period_end * 1000).toISOString()

      // Update local subscription record
      // Note: Member stays ATIVO until webhook `customer.subscription.deleted` fires
      await supabase
        .from('subscriptions')
        .update({
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || 'Cancelamento no final do periodo',
          updated_at: new Date().toISOString(),
        })
        .eq('member_id', memberId)
        .eq('status', 'active')

      result = {
        endsAt,
        cancelledNow: false,
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        memberId,
        cancelledImmediately: result.cancelledNow,
        accessEndsAt: result.endsAt,
        message: result.cancelledNow
          ? 'Subscription cancelled. Access revoked immediately.'
          : `Subscription will be cancelled. Access continues until ${result.endsAt}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error cancelling subscription:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
