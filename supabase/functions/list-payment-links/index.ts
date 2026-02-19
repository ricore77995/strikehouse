import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

/**
 * List Payment Links Edge Function
 *
 * Returns all active Stripe Payment Links with their metadata.
 * Used by staff to select which Payment Link to send to a member.
 *
 * The metadata on each Payment Link determines:
 * - weekly_limit: Max check-ins per rolling 7 days (null = unlimited)
 * - modalities_count: Number of modalities included (99 = ALL)
 * - access_type: SUBSCRIPTION, DAILY_PASS, CREDITS
 *
 * No authentication required (verify_jwt = false in config.toml)
 * Staff needs to see the list to send links to members.
 */

interface PaymentLinkInfo {
  id: string
  url: string
  displayName: string
  priceAmountCents: number | null
  currency: string
  metadata: {
    weekly_limit?: string | null
    modalities_count?: string | null
    access_type?: string | null
    commitment_months?: string | null
    special?: string | null
  }
  active: boolean
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')

    if (!stripeSecretKey) {
      console.error('Missing STRIPE_SECRET_KEY')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    console.log('Fetching active Payment Links from Stripe...')

    // Fetch all active payment links
    const paymentLinks = await stripe.paymentLinks.list({
      active: true,
      limit: 100, // Get up to 100 links
      expand: ['data.line_items'], // Expand line_items to get price info
    })

    console.log(`Found ${paymentLinks.data.length} active Payment Links`)

    // Transform to our format - fetch price details separately for metadata
    const links: PaymentLinkInfo[] = await Promise.all(
      paymentLinks.data.map(async (link) => {
        let priceAmountCents: number | null = null
        let currency = 'eur'
        // Price metadata is the source of truth (not Payment Link metadata)
        let priceMetadata: Record<string, string> = {}

        // Try to get price from expanded line_items
        if (link.line_items && link.line_items.data && link.line_items.data.length > 0) {
          const firstItem = link.line_items.data[0]
          if (firstItem.price) {
            const priceId = typeof firstItem.price === 'string' ? firstItem.price : firstItem.price.id

            // Fetch full price object to get metadata
            // (Stripe expansion doesn't always include nested metadata)
            try {
              const fullPrice = await stripe.prices.retrieve(priceId)
              priceAmountCents = fullPrice.unit_amount
              currency = fullPrice.currency || 'eur'
              priceMetadata = fullPrice.metadata || {}
            } catch (err) {
              console.error(`Failed to fetch price ${priceId}:`, err)
              // Fallback to expanded data
              if (typeof firstItem.price !== 'string') {
                priceAmountCents = firstItem.price.unit_amount
                currency = firstItem.price.currency || 'eur'
                priceMetadata = firstItem.price.metadata || {}
              }
            }
          }
        }

        // Generate display name from Price metadata (primary) or Payment Link metadata (fallback)
        const displayName = priceMetadata.display_name ||
          link.metadata?.display_name ||
          link.metadata?.plan_name ||
          `Payment Link ${link.id.slice(-8)}`

        return {
          id: link.id,
          url: link.url,
          displayName,
          priceAmountCents,
          currency,
          // Use Price metadata (PRIMARY) with Payment Link metadata as fallback
          metadata: {
            weekly_limit: priceMetadata.weekly_limit || link.metadata?.weekly_limit || null,
            modalities_count: priceMetadata.modalities_count || link.metadata?.modalities_count || null,
            access_type: priceMetadata.access_type || link.metadata?.access_type || null,
            commitment_months: priceMetadata.commitment_months || link.metadata?.commitment_months || null,
            special: priceMetadata.special || link.metadata?.special || null,
          },
          active: link.active,
        }
      })
    )

    // Sort by price (highest first) for better UX
    links.sort((a, b) => {
      const priceA = a.priceAmountCents || 0
      const priceB = b.priceAmountCents || 0
      return priceB - priceA
    })

    return new Response(
      JSON.stringify({
        success: true,
        count: links.length,
        links,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error fetching Payment Links:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
