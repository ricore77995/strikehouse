/**
 * List Stripe Prices and Products
 *
 * Returns all active prices with their products for the payment link creation form.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Fetch all active prices with their products
    const prices = await stripe.prices.list({
      active: true,
      limit: 100,
      expand: ["data.product"],
    });

    // Format response
    const formattedPrices = prices.data
      .filter((price) => {
        // Only include prices with active products
        const product = price.product as Stripe.Product;
        return product && typeof product !== "string" && product.active;
      })
      .map((price) => {
        const product = price.product as Stripe.Product;
        return {
          id: price.id,
          nickname: price.nickname,
          unit_amount: price.unit_amount || 0,
          currency: price.currency,
          recurring: price.recurring
            ? {
                interval: price.recurring.interval,
                interval_count: price.recurring.interval_count,
              }
            : null,
          product: {
            id: product.id,
            name: product.name,
            description: product.description,
          },
          metadata: price.metadata,
          // Format display name
          display_name: formatPriceDisplay(price, product),
        };
      })
      .sort((a, b) => a.unit_amount - b.unit_amount);

    return new Response(
      JSON.stringify({
        success: true,
        prices: formattedPrices,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error listing prices:", error);
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

function formatPriceDisplay(price: Stripe.Price, product: Stripe.Product): string {
  const amount = ((price.unit_amount || 0) / 100).toFixed(2);
  const currency = price.currency.toUpperCase();

  let display = `${product.name} — €${amount}`;

  if (price.recurring) {
    const interval = price.recurring.interval;
    const intervalMap: Record<string, string> = {
      day: "/dia",
      week: "/semana",
      month: "/mês",
      year: "/ano",
    };
    display += ` ${intervalMap[interval] || `/${interval}`}`;
  }

  return display;
}
