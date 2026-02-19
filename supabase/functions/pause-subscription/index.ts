import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Pause/Resume Subscription
 *
 * Pauses billing on a subscription (member keeps access until current period ends).
 * Can optionally set a resume date.
 *
 * Request body:
 * - memberId: string - Member UUID
 * - action: 'pause' | 'resume'
 * - resumeDate?: string - ISO date when to auto-resume (optional, only for pause)
 * - reason?: string - Reason for pause (optional)
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
    const { memberId, action, resumeDate, reason } = await req.json()

    if (!memberId || !action) {
      return new Response(
        JSON.stringify({ error: 'memberId and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['pause', 'resume'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'action must be "pause" or "resume"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`${action === 'pause' ? 'Pausing' : 'Resuming'} subscription for member ${memberId}`)

    // Get member's subscription
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, nome, stripe_subscription_id, status')
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

    if (action === 'pause') {
      // Pause the subscription
      const pauseConfig: Stripe.SubscriptionUpdateParams['pause_collection'] = {
        behavior: 'void', // Don't generate invoice during pause
      }

      // Set resume date if provided
      if (resumeDate) {
        pauseConfig.resumes_at = Math.floor(new Date(resumeDate).getTime() / 1000)
      }

      const updatedSubscription = await stripe.subscriptions.update(member.stripe_subscription_id, {
        pause_collection: pauseConfig,
      })

      console.log(`Subscription paused: ${updatedSubscription.id}`)

      // Update local subscription record
      await supabase
        .from('subscriptions')
        .update({
          frozen_at: new Date().toISOString(),
          frozen_until: resumeDate || null,
          freeze_reason: reason || 'Solicitado pelo membro',
          updated_at: new Date().toISOString(),
        })
        .eq('member_id', memberId)
        .eq('status', 'active')

      // Note: We don't change member status to BLOQUEADO during pause
      // They keep access until the current period ends, then pause kicks in

      return new Response(
        JSON.stringify({
          success: true,
          action: 'paused',
          subscriptionId: updatedSubscription.id,
          resumesAt: resumeDate || null,
          message: resumeDate
            ? `Subscription paused until ${resumeDate}`
            : 'Subscription paused indefinitely',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Resume the subscription
      const updatedSubscription = await stripe.subscriptions.update(member.stripe_subscription_id, {
        pause_collection: '', // Empty string removes pause
      })

      console.log(`Subscription resumed: ${updatedSubscription.id}`)

      // Update local subscription record
      await supabase
        .from('subscriptions')
        .update({
          frozen_at: null,
          frozen_until: null,
          freeze_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('member_id', memberId)
        .eq('status', 'active')

      // Reactivate member if they were blocked
      if (member.status === 'BLOQUEADO') {
        await supabase
          .from('members')
          .update({
            status: 'ATIVO',
            updated_at: new Date().toISOString(),
          })
          .eq('id', memberId)
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'resumed',
          subscriptionId: updatedSubscription.id,
          nextBillingDate: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Error pausing/resuming subscription:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
