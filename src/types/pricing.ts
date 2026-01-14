// Pricing Engine Types
// Based on PRICING_ENGINE.md spec v1.1

// ================================
// Modality
// ================================

export interface Modality {
  id: string;
  code: string;
  nome: string;
  description: string | null;
  sort_order: number;
  ativo: boolean;
  created_at: string;
}

// ================================
// Pricing Config (Singleton)
// ================================

export interface PricingConfig {
  id: string;
  base_price_cents: number;           // Default: 6000 (€60)
  extra_modality_price_cents: number; // Default: 3000 (€30)
  single_class_price_cents: number;   // Default: 1500 (€15)
  day_pass_price_cents: number;       // Default: 2500 (€25)
  enrollment_fee_cents: number;       // Default: 1500 (€15)
  currency: string;                   // Default: 'EUR'
  updated_at: string;
  updated_by: string | null;
}

// ================================
// Discount
// ================================

export const DiscountCategory = {
  COMMITMENT: 'commitment',
  PROMO: 'promo',
} as const;

export type DiscountCategoryType = typeof DiscountCategory[keyof typeof DiscountCategory];

export const DiscountType = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
} as const;

export type DiscountTypeType = typeof DiscountType[keyof typeof DiscountType];

export interface Discount {
  id: string;
  code: string;
  nome: string;
  category: DiscountCategoryType;
  discount_type: DiscountTypeType;
  discount_value: number;
  min_commitment_months: number | null;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  current_uses: number;
  new_members_only: boolean;
  referrer_credit_cents: number | null;
  ativo: boolean;
  created_at: string;
  created_by: string | null;
}

// ================================
// Plan (Enhanced)
// ================================

export interface PlanPricingOverride {
  base_price_cents?: number | null;
  extra_modality_price_cents?: number | null;
  enrollment_fee_cents?: number | null;
}

export interface Plan {
  id: string;
  nome: string;
  tipo: 'SUBSCRIPTION' | 'CREDITS' | 'DAILY_PASS';
  preco_cents: number;
  duracao_dias: number | null;
  creditos: number | null;
  enrollment_fee_cents: number;
  ativo: boolean;
  created_at: string;
  // Pricing engine additions
  modalities: string[];              // UUID array
  commitment_months: number;
  pricing_override: PlanPricingOverride;
  visible: boolean;
}

// ================================
// Subscription
// ================================

export const SubscriptionStatus = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export type SubscriptionStatusType = typeof SubscriptionStatus[keyof typeof SubscriptionStatus];

export interface Subscription {
  id: string;
  member_id: string;
  plan_id: string | null;

  // Selected options
  modalities: string[];              // UUID array
  commitment_months: number;

  // Discount references
  commitment_discount_id: string | null;
  promo_discount_id: string | null;

  // Price snapshot (immutable)
  calculated_price_cents: number;    // Base price before discounts
  commitment_discount_pct: number;
  promo_discount_pct: number;
  final_price_cents: number;         // Final price after all discounts
  enrollment_fee_cents: number;

  // Access period
  starts_at: string;
  expires_at: string | null;
  credits_remaining: number | null;

  // Status
  status: SubscriptionStatusType;

  // Audit
  created_at: string;
  created_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
}

// ================================
// Pricing Calculation Types
// ================================

export interface PricingInput {
  modalities: string[];              // UUID array
  commitment_months: number;
  discount_code?: string;            // Optional promo code
  member_id: string;
  member_status: 'LEAD' | 'ATIVO' | 'BLOQUEADO' | 'CANCELADO';
  plan_id?: string;                  // Optional - for plan-based pricing
}

export interface PricingBreakdown {
  // Base calculation
  base_price_cents: number;          // B - price for first modality
  extra_modalities_count: number;    // M - 1
  extra_modalities_cents: number;    // (M-1) × E
  subtotal_cents: number;            // B + (M-1) × E

  // Discounts
  commitment_discount_pct: number;   // Dp
  commitment_discount_cents: number; // Amount saved from commitment
  promo_discount_pct: number;        // D
  promo_discount_cents: number;      // Amount saved from promo

  // Final
  monthly_price_cents: number;       // Final monthly price
  enrollment_fee_cents: number;      // One-time fee (only for LEAD)
  total_first_payment_cents: number; // monthly + enrollment
}

export interface PricingResult {
  success: boolean;
  error?: string;
  breakdown?: PricingBreakdown;
  discount_ids?: {
    commitment: string | null;
    promo: string | null;
  };
}

// ================================
// Validation Types
// ================================

export interface PromoCodeValidation {
  valid: boolean;
  error?: string;
  discount?: Discount;
}

export interface CommitmentDiscountResult {
  discount: Discount | null;
  percentage: number;
}

// ================================
// Commitment Period Options
// ================================

export const CommitmentPeriods = [
  { months: 1, label: 'Mensal', discount_code: 'MENSAL' },
  { months: 3, label: 'Trimestral', discount_code: 'TRIMESTRAL' },
  { months: 6, label: 'Semestral', discount_code: 'SEMESTRAL' },
  { months: 12, label: 'Anual', discount_code: 'ANUAL' },
] as const;

export type CommitmentPeriod = typeof CommitmentPeriods[number];
