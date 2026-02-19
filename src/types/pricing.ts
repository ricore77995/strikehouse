// Pricing Types (Simplified - Stripe is source of truth)
// Legacy pricing engine types removed

// ================================
// Modality (still used)
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

// All other types (Plan, PricingConfig, Discount, PricingBreakdown, etc.)
// have been removed as Stripe Payment Links are now the source of truth
