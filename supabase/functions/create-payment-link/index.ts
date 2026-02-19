/**
 * Create Payment Link in Stripe
 *
 * Creates a new Payment Link with the specified prices and metadata,
 * then syncs to local stripe_payment_links table.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePaymentLinkRequest {
  // Line items - at least one price required
  priceIds: string[]; // Array of price IDs (plan + optional enrollment fee)

  // Metadata for categorization
  metadata: {
    display_name?: string;
    frequencia: "1x" | "2x" | "3x" | "unlimited";
    compromisso: "mensal" | "trimestral" | "semestral" | "anual";
    tags?: string[]; // Flexible tags: matricula, family_friends, promocao, etc.
    weekly_limit?: number; // Derived from frequencia if not provided
  };

  // Options
  collectCustomerName?: boolean;
  collectPhone?: boolean;
  allowPromotionCodes?: boolean;
}

// Derive weekly limit from frequencia
function getWeeklyLimit(frequencia: string, explicitLimit?: number): number | null {
  if (explicitLimit !== undefined) return explicitLimit;
  if (frequencia === "1x") return 1;
  if (frequencia === "2x") return 2;
  if (frequencia === "3x") return 3;
  return null; // unlimited
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: CreatePaymentLinkRequest = await req.json();

    // Validate required fields
    if (!body.priceIds || body.priceIds.length === 0) {
      throw new Error("At least one priceId is required");
    }

    if (!body.metadata?.frequencia || !body.metadata?.compromisso) {
      throw new Error("frequencia and compromisso are required in metadata");
    }

    console.log("Creating payment link with:", body);

    // Process tags
    const tags = body.metadata.tags || [];
    const includesEnrollmentFee = tags.includes("matricula");
    const isFamilyFriends = tags.includes("family_friends");
    const weeklyLimit = getWeeklyLimit(body.metadata.frequencia, body.metadata.weekly_limit);

    // Fetch prices to calculate total and validate
    let totalAmountCents = 0;
    let mainPriceId = "";
    let enrollmentPriceId: string | null = null;

    const lineItems: Stripe.PaymentLinkCreateParams.LineItem[] = [];

    for (let i = 0; i < body.priceIds.length; i++) {
      const priceId = body.priceIds[i];
      const price = await stripe.prices.retrieve(priceId);

      if (!price.active) {
        throw new Error(`Price ${priceId} is not active`);
      }

      totalAmountCents += price.unit_amount || 0;
      lineItems.push({ price: priceId, quantity: 1 });

      // First price is the main plan, second is enrollment fee (if present)
      if (i === 0) {
        mainPriceId = priceId;
      } else if (i === 1 && includesEnrollmentFee) {
        enrollmentPriceId = priceId;
      }
    }

    // Generate display name if not provided
    const displayName = body.metadata.display_name || generateDisplayName(
      body.metadata.frequencia,
      body.metadata.compromisso,
      totalAmountCents,
      tags
    );

    // Create payment link in Stripe
    const paymentLink = await stripe.paymentLinks.create({
      line_items: lineItems,
      metadata: {
        display_name: displayName,
        frequencia: body.metadata.frequencia,
        compromisso: body.metadata.compromisso,
        tags: tags.join(","), // Store as comma-separated string in Stripe
        weekly_limit: weeklyLimit ? String(weeklyLimit) : "",
        // Keep booleans for backwards compatibility with webhook
        includes_enrollment_fee: String(includesEnrollmentFee),
        is_family_friends: String(isFamilyFriends),
        created_by: "admin-ui",
      },
      allow_promotion_codes: body.allowPromotionCodes ?? true,
      // Collect customer info
      ...(body.collectCustomerName && {
        custom_fields: [],
      }),
      phone_number_collection: {
        enabled: body.collectPhone ?? false,
      },
      // After completion redirect
      after_completion: {
        type: "redirect",
        redirect: {
          url: `${Deno.env.get("PUBLIC_SITE_URL") || "https://strikehouse.pt"}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        },
      },
    });

    console.log("Payment link created:", paymentLink.id);

    // Insert into local table
    const { error: insertError } = await supabase
      .from("stripe_payment_links")
      .insert({
        frequencia: body.metadata.frequencia,
        compromisso: body.metadata.compromisso,
        tags, // PostgreSQL TEXT[] array
        includes_enrollment_fee: includesEnrollmentFee, // Keep for backwards compat
        is_family_friends: isFamilyFriends, // Keep for backwards compat
        payment_link_id: paymentLink.id,
        payment_link_url: paymentLink.url,
        price_id: mainPriceId,
        enrollment_price_id: enrollmentPriceId,
        amount_cents: totalAmountCents,
        display_name: displayName,
        ativo: true,
      });

    if (insertError) {
      console.error("Error inserting to local table:", insertError);
      // Don't fail - the link was created in Stripe
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentLink: {
          id: paymentLink.id,
          url: paymentLink.url,
          display_name: displayName,
          amount_cents: totalAmountCents,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating payment link:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

function generateDisplayName(
  frequencia: string,
  compromisso: string,
  amountCents: number,
  tags: string[]
): string {
  const freqLabels: Record<string, string> = {
    "1x": "1x/semana",
    "2x": "2x/semana",
    "3x": "3x/semana",
    "unlimited": "Ilimitado",
  };

  const compLabels: Record<string, string> = {
    "mensal": "",
    "trimestral": "Trimestral",
    "semestral": "Semestral",
    "anual": "Anual",
  };

  const price = `€${(amountCents / 100).toFixed(0)}`;
  const freq = freqLabels[frequencia] || frequencia;
  const comp = compLabels[compromisso] || compromisso;

  let name = freq;
  if (comp) name += ` ${comp}`;

  // Add tag labels
  if (tags.includes("matricula")) name += " + Matrícula";
  if (tags.includes("family_friends")) name = `F&F ${name}`;
  if (tags.includes("promocao")) name += " [Promo]";
  if (tags.includes("staff")) name += " [Staff]";
  if (tags.includes("trial")) name += " [Trial]";

  name += ` ${price}`;

  return name;
}
