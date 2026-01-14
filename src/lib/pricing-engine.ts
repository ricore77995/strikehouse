/**
 * Pricing Engine - Core calculation logic
 *
 * Formula: P = (B + (M-1) × E) × (1 - Dp) × (1 - Dpromo)
 *
 * Where:
 *   P = Final monthly price
 *   B = Base price (1st modality)
 *   E = Extra modality price
 *   M = Number of modalities
 *   Dp = Commitment discount (%)
 *   Dpromo = Promo code discount (%)
 */

import type {
  PricingConfig,
  PlanPricingOverride,
  Discount,
  PricingBreakdown,
  PricingResult,
  PromoCodeValidation,
  CommitmentDiscountResult,
} from '@/types/pricing';

// ================================
// Price Resolution
// ================================

interface ResolvedPrices {
  base_price_cents: number;
  extra_modality_price_cents: number;
  enrollment_fee_cents: number;
}

/**
 * Resolve pricing values from config or plan override
 */
export function resolvePrices(
  config: PricingConfig,
  planOverride?: PlanPricingOverride | null
): ResolvedPrices {
  return {
    base_price_cents: planOverride?.base_price_cents ?? config.base_price_cents,
    extra_modality_price_cents:
      planOverride?.extra_modality_price_cents ?? config.extra_modality_price_cents,
    enrollment_fee_cents:
      planOverride?.enrollment_fee_cents ?? config.enrollment_fee_cents,
  };
}

// ================================
// Commitment Discount
// ================================

/**
 * Find the best commitment discount for given months
 * Auto-selects the highest discount where min_commitment_months <= commitment_months
 */
export function findCommitmentDiscount(
  discounts: Discount[],
  commitmentMonths: number
): CommitmentDiscountResult {
  const commitmentDiscounts = discounts
    .filter(
      (d) =>
        d.category === 'commitment' &&
        d.ativo &&
        d.discount_type === 'percentage' &&
        (d.min_commitment_months ?? 0) <= commitmentMonths
    )
    .sort((a, b) => (b.discount_value ?? 0) - (a.discount_value ?? 0));

  const best = commitmentDiscounts[0] || null;

  return {
    discount: best,
    percentage: best?.discount_value ?? 0,
  };
}

// ================================
// Promo Code Validation
// ================================

/**
 * Validate a promo code
 */
export function validatePromoCode(
  code: string,
  discounts: Discount[],
  memberStatus: string,
  today: Date = new Date()
): PromoCodeValidation {
  const discount = discounts.find(
    (d) =>
      d.code.toUpperCase() === code.toUpperCase() &&
      d.category === 'promo' &&
      d.ativo
  );

  if (!discount) {
    return { valid: false, error: 'Codigo invalido' };
  }

  // Check date validity
  if (discount.valid_from) {
    const validFrom = new Date(discount.valid_from);
    if (today < validFrom) {
      return { valid: false, error: 'Codigo ainda nao valido' };
    }
  }

  if (discount.valid_until) {
    const validUntil = new Date(discount.valid_until);
    validUntil.setHours(23, 59, 59, 999); // End of day
    if (today > validUntil) {
      return { valid: false, error: 'Codigo expirado' };
    }
  }

  // Check max uses
  if (discount.max_uses !== null && discount.current_uses >= discount.max_uses) {
    return { valid: false, error: 'Codigo esgotado' };
  }

  // Check new members only
  if (discount.new_members_only && memberStatus !== 'LEAD') {
    return { valid: false, error: 'Codigo apenas para novos membros' };
  }

  return { valid: true, discount };
}

// ================================
// Main Calculation
// ================================

export interface CalculatePriceParams {
  config: PricingConfig;
  modalityCount: number;
  commitmentMonths: number;
  commitmentDiscountPct: number;
  promoDiscountPct: number;
  isFirstTime: boolean;
  planOverride?: PlanPricingOverride | null;
}

/**
 * Calculate price using the pricing formula
 *
 * P = (B + (M-1) × E) × (1 - Dp/100) × (1 - Dpromo/100)
 */
export function calculatePrice(params: CalculatePriceParams): PricingBreakdown {
  const {
    config,
    modalityCount,
    commitmentMonths,
    commitmentDiscountPct,
    promoDiscountPct,
    isFirstTime,
    planOverride,
  } = params;

  // Resolve prices
  const resolved = resolvePrices(config, planOverride);
  const B = resolved.base_price_cents;
  const E = resolved.extra_modality_price_cents;
  const M = Math.max(1, modalityCount);

  // Calculate base price (before discounts)
  const extraCount = M - 1;
  const extraCents = extraCount * E;
  const subtotal = B + extraCents;

  // Apply commitment discount
  const afterCommitment = subtotal * (1 - commitmentDiscountPct / 100);
  const commitmentSaved = subtotal - afterCommitment;

  // Apply promo discount
  const afterPromo = afterCommitment * (1 - promoDiscountPct / 100);
  const promoSaved = afterCommitment - afterPromo;

  // Final monthly price (round to cents)
  const monthly = Math.round(afterPromo);

  // Enrollment fee (only for first time / LEAD members)
  const enrollmentFee = isFirstTime ? resolved.enrollment_fee_cents : 0;

  return {
    base_price_cents: B,
    extra_modalities_count: extraCount,
    extra_modalities_cents: extraCents,
    subtotal_cents: subtotal,
    commitment_discount_pct: commitmentDiscountPct,
    commitment_discount_cents: Math.round(commitmentSaved),
    promo_discount_pct: promoDiscountPct,
    promo_discount_cents: Math.round(promoSaved),
    monthly_price_cents: monthly,
    enrollment_fee_cents: enrollmentFee,
    total_first_payment_cents: monthly + enrollmentFee,
  };
}

// ================================
// Full Pricing Flow
// ================================

export interface PricingFlowParams {
  config: PricingConfig;
  discounts: Discount[];
  modalityIds: string[];
  commitmentMonths: number;
  promoCode?: string;
  memberStatus: 'LEAD' | 'ATIVO' | 'BLOQUEADO' | 'CANCELADO';
  planOverride?: PlanPricingOverride | null;
}

/**
 * Complete pricing flow with validation
 */
export function processPricing(params: PricingFlowParams): PricingResult {
  const {
    config,
    discounts,
    modalityIds,
    commitmentMonths,
    promoCode,
    memberStatus,
    planOverride,
  } = params;

  // Validate modality count
  if (modalityIds.length === 0) {
    return { success: false, error: 'Selecione pelo menos uma modalidade' };
  }

  // Find commitment discount
  const commitmentResult = findCommitmentDiscount(discounts, commitmentMonths);

  // Validate promo code if provided
  let promoDiscount: Discount | null = null;
  let promoDiscountPct = 0;

  if (promoCode && promoCode.trim() !== '') {
    const validation = validatePromoCode(promoCode, discounts, memberStatus);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    promoDiscount = validation.discount || null;
    promoDiscountPct =
      promoDiscount?.discount_type === 'percentage'
        ? promoDiscount.discount_value
        : 0;
  }

  // Calculate price
  const breakdown = calculatePrice({
    config,
    modalityCount: modalityIds.length,
    commitmentMonths,
    commitmentDiscountPct: commitmentResult.percentage,
    promoDiscountPct,
    isFirstTime: memberStatus === 'LEAD',
    planOverride,
  });

  return {
    success: true,
    breakdown,
    discount_ids: {
      commitment: commitmentResult.discount?.id || null,
      promo: promoDiscount?.id || null,
    },
  };
}

// ================================
// Formatters
// ================================

/**
 * Format cents to EUR currency string
 */
export function formatCurrency(cents: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

/**
 * Format discount percentage
 */
export function formatDiscount(pct: number): string {
  return `-${pct}%`;
}

// ================================
// Duration Calculation
// ================================

/**
 * Calculate expiration date based on commitment months
 */
export function calculateExpiresAt(
  startDate: Date,
  commitmentMonths: number
): Date {
  const expires = new Date(startDate);
  expires.setMonth(expires.getMonth() + commitmentMonths);
  return expires;
}

/**
 * Format date to ISO date string (YYYY-MM-DD)
 */
export function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}
