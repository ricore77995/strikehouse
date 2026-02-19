/**
 * Sync Payment Links from Stripe
 *
 * Fetches all active Payment Links from Stripe and syncs to stripe_payment_links table.
 * Uses Stripe metadata to determine link type (enrollment, renewal, family_friends).
 *
 * Expected Stripe Payment Link metadata:
 * - frequencia: "1x" | "2x" | "3x" | "unlimited"
 * - compromisso: "mensal" | "trimestral" | "semestral" | "anual"
 * - includes_enrollment_fee: "true" | "false"
 * - is_family_friends: "true" | "false"
 * - weekly_limit: number (optional, for check-in limits)
 * - display_name: string (optional, custom display name)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Initialize Supabase with service role for bypassing RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    console.log("🔄 Fetching Payment Links from Stripe...");

    // Fetch all active Payment Links from Stripe
    const paymentLinks = await stripe.paymentLinks.list({
      active: true,
      limit: 100,
      expand: ["data.line_items"],
    });

    console.log(`📋 Found ${paymentLinks.data.length} active Payment Links`);

    for (const link of paymentLinks.data) {
      try {
        // Skip links without required metadata
        const metadata = link.metadata || {};

        // Parse metadata with defaults
        const frequencia = metadata.frequencia || "unlimited";
        const compromisso = metadata.compromisso || "mensal";
        const displayName = metadata.display_name || null;
        const weeklyLimit = metadata.weekly_limit ? parseInt(metadata.weekly_limit) : null;

        // Parse tags - can come from tags field or derive from booleans
        let tags: string[] = [];
        if (metadata.tags) {
          tags = metadata.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
        } else {
          // Backwards compat: derive tags from boolean flags
          if (metadata.includes_enrollment_fee === "true") tags.push("matricula");
          if (metadata.is_family_friends === "true") tags.push("family_friends");
        }

        // Keep booleans for backwards compat
        const includesEnrollmentFee = tags.includes("matricula") || metadata.includes_enrollment_fee === "true";
        const isFamilyFriends = tags.includes("family_friends") || metadata.is_family_friends === "true";

        // Get line items to calculate total amount
        let totalAmountCents = 0;
        let priceId = "";
        let enrollmentPriceId: string | null = null;

        // Fetch line items for this payment link
        const lineItems = await stripe.paymentLinks.listLineItems(link.id, {
          limit: 10,
        });

        for (const item of lineItems.data) {
          if (item.price) {
            const price = item.price;
            const amount = (price.unit_amount || 0) * (item.quantity || 1);
            totalAmountCents += amount;

            // Determine if this is the main price or enrollment fee
            // Convention: enrollment fee prices have "matricula" or "enrollment" in name/description
            const priceMetadata = price.metadata || {};
            const isEnrollmentPrice =
              priceMetadata.type === "enrollment_fee" ||
              price.nickname?.toLowerCase().includes("matrícula") ||
              price.nickname?.toLowerCase().includes("matricula") ||
              price.nickname?.toLowerCase().includes("enrollment");

            if (isEnrollmentPrice) {
              enrollmentPriceId = price.id;
            } else {
              priceId = price.id;
            }
          }
        }

        // If no price found, skip this link
        if (!priceId && lineItems.data.length > 0 && lineItems.data[0].price) {
          priceId = lineItems.data[0].price.id;
        }

        if (!priceId) {
          console.log(`⚠️ Skipping ${link.id}: No price found`);
          result.skipped++;
          continue;
        }

        // Generate display name if not provided
        const generatedDisplayName = displayName || generateDisplayName(
          frequencia,
          compromisso,
          totalAmountCents,
          tags
        );

        // Check if link already exists
        const { data: existing } = await supabase
          .from("stripe_payment_links")
          .select("id")
          .eq("payment_link_id", link.id)
          .single();

        const linkData = {
          frequencia,
          compromisso,
          tags, // PostgreSQL TEXT[] array
          includes_enrollment_fee: includesEnrollmentFee, // Keep for backwards compat
          is_family_friends: isFamilyFriends, // Keep for backwards compat
          payment_link_id: link.id,
          payment_link_url: link.url,
          price_id: priceId,
          enrollment_price_id: enrollmentPriceId,
          amount_cents: totalAmountCents,
          display_name: generatedDisplayName,
          ativo: link.active,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from("stripe_payment_links")
            .update(linkData)
            .eq("id", existing.id);

          if (error) throw error;
          result.updated++;
          console.log(`✅ Updated: ${generatedDisplayName}`);
        } else {
          // Insert new
          const { error } = await supabase
            .from("stripe_payment_links")
            .insert(linkData);

          if (error) throw error;
          result.created++;
          console.log(`✅ Created: ${generatedDisplayName}`);
        }

        result.synced++;
      } catch (linkError) {
        const errorMsg = linkError instanceof Error ? linkError.message : "Unknown error";
        result.errors.push(`${link.id}: ${errorMsg}`);
        console.error(`❌ Error processing ${link.id}:`, errorMsg);
      }
    }

    // Deactivate links that are no longer active in Stripe
    const activeIds = paymentLinks.data.map(l => l.id);
    if (activeIds.length > 0) {
      const { data: localLinks } = await supabase
        .from("stripe_payment_links")
        .select("id, payment_link_id")
        .eq("ativo", true);

      if (localLinks) {
        for (const local of localLinks) {
          if (!activeIds.includes(local.payment_link_id)) {
            await supabase
              .from("stripe_payment_links")
              .update({ ativo: false })
              .eq("id", local.id);
            console.log(`🔴 Deactivated: ${local.payment_link_id}`);
          }
        }
      }
    }

    console.log("✅ Sync complete:", result);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${result.synced} payment links (${result.created} created, ${result.updated} updated, ${result.skipped} skipped)`,
        result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("❌ Sync error:", error);
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
