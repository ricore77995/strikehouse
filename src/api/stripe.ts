/**
 * Stripe API Client
 *
 * Integração com Stripe Edge Functions (create-checkout-session)
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// Types
// ============================================================================

export type MemberStatus = 'LEAD' | 'BLOQUEADO' | 'CANCELADO';
export type CommitmentPeriod = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';

export interface CreateCheckoutSessionInput {
  // Member data
  memberId: string;
  memberEmail: string;
  memberName: string;
  memberStatus: MemberStatus;

  // Plan selection
  planId: string;
  modalityIds: string[];
  commitmentPeriod: CommitmentPeriod;

  // Promo code (optional)
  promoCodeId?: string;

  // Enrollment fee decision (for CANCELADO)
  chargeEnrollmentFee?: boolean;

  // Staff who is processing
  staffId: string;
}

export interface CreateCheckoutSessionResponse {
  success: true;
  checkoutUrl: string;
  sessionId: string;
  expiresAt: number;
  pricing: {
    totalCents: number;
    enrollmentFeeCents: number;
    breakdown: {
      planBase: { description: string; amountCents: number };
      commitmentDiscount: { description: string; amountCents: number };
      subtotalBase: { description: string; amountCents: number };
      modalitiesExtras: Array<{ description: string; amountCents: number }>;
      subtotal: { description: string; amountCents: number };
      promoCode: { description: string; amountCents: number };
      enrollmentFee: { description: string; amountCents: number };
      total: { description: string; amountCents: number };
    };
  };
}

export interface CreateCheckoutSessionError {
  success: false;
  error: string;
  message?: string;
  code?: string;
  details?: string[];
}

export type CreateCheckoutSessionResult =
  | CreateCheckoutSessionResponse
  | CreateCheckoutSessionError;

// ============================================================================
// API Functions
// ============================================================================

/**
 * Create Stripe Checkout Session via Edge Function.
 *
 * Calls the create-checkout-session Edge Function which:
 * - Validates inputs with Zod
 * - Validates promo code (if provided)
 * - Calculates pricing with pricing engine
 * - Creates Stripe Checkout Session with dynamic line items
 * - Returns checkout URL for redirect
 *
 * @param input - Checkout session parameters
 * @returns Checkout URL + session details, or error
 *
 * @example
 * const result = await createCheckoutSession({
 *   memberId: 'member-uuid',
 *   memberEmail: 'john@example.com',
 *   memberName: 'John Doe',
 *   memberStatus: 'LEAD',
 *   planId: 'plan-3x-uuid',
 *   modalityIds: ['muay-thai-uuid'],
 *   commitmentPeriod: 'TRIMESTRAL',
 *   promoCodeId: 'promo-uuid',
 *   staffId: 'staff-uuid',
 * });
 *
 * if (result.success) {
 *   window.location.href = result.checkoutUrl; // Redirect to Stripe
 * } else {
 *   console.error(result.error, result.message);
 * }
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<CreateCheckoutSessionResult> {
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: input,
    });

    if (error) {
      console.error('Edge Function error:', error);
      return {
        success: false,
        error: 'Edge Function error',
        message: error.message || 'Failed to create checkout session',
      };
    }

    // Check if response indicates an error
    if (data && 'error' in data) {
      return {
        success: false,
        error: data.error,
        message: data.message,
        code: data.code,
        details: data.details,
      };
    }

    // Success response
    if (data && data.checkoutUrl) {
      return {
        success: true,
        checkoutUrl: data.checkoutUrl,
        sessionId: data.sessionId,
        expiresAt: data.expiresAt,
        pricing: data.pricing,
      };
    }

    // Unexpected response format
    return {
      success: false,
      error: 'Invalid response',
      message: 'Unexpected response format from create-checkout-session',
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return {
      success: false,
      error: 'Unexpected error',
      message: err instanceof Error ? err.message : 'Unknown error occurred',
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format cents to EUR display string.
 *
 * @param cents - Amount in cents
 * @returns Formatted string (e.g., "€50.00")
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

/**
 * Map commitment months (1, 3, 6, 12) to CommitmentPeriod enum.
 *
 * @param months - Number of months
 * @returns CommitmentPeriod enum value
 */
export function mapCommitmentMonthsToPeriod(months: number): CommitmentPeriod {
  switch (months) {
    case 1:
      return 'MENSAL';
    case 3:
      return 'TRIMESTRAL';
    case 6:
      return 'SEMESTRAL';
    case 12:
      return 'ANUAL';
    default:
      return 'MENSAL';
  }
}

/**
 * Check if payment method should use Stripe Checkout.
 *
 * @param paymentMethod - Payment method
 * @returns true if should use Stripe Checkout (STRIPE)
 */
export function shouldUseStripeCheckout(paymentMethod: string): boolean {
  // Only STRIPE (card via Stripe Checkout) uses Stripe
  // Other method (DINHEIRO) remains in-app with instant activation
  return paymentMethod === 'STRIPE';
}
