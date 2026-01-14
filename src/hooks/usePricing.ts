import { useState, useCallback, useMemo } from 'react';
import { usePricingConfig } from './usePricingConfig';
import { useDiscounts, useIncrementDiscountUses } from './useDiscounts';
import { useModalities } from './useModalities';
import {
  processPricing,
  findCommitmentDiscount,
  formatCurrency,
  calculateExpiresAt,
  toISODateString,
} from '@/lib/pricing-engine';
import type {
  PricingBreakdown,
  PricingResult,
  PlanPricingOverride,
  CommitmentPeriod,
  Modality,
} from '@/types/pricing';
import { CommitmentPeriods } from '@/types/pricing';

interface UsePricingOptions {
  memberStatus: 'LEAD' | 'ATIVO' | 'BLOQUEADO' | 'CANCELADO';
  planOverride?: PlanPricingOverride | null;
}

interface UsePricingReturn {
  // Data
  modalities: Modality[];
  commitmentPeriods: readonly CommitmentPeriod[];
  config: ReturnType<typeof usePricingConfig>['config'];

  // Selected state
  selectedModalities: string[];
  selectedCommitmentMonths: number;
  promoCode: string;

  // Setters
  setSelectedModalities: (ids: string[]) => void;
  toggleModality: (id: string) => void;
  setSelectedCommitmentMonths: (months: number) => void;
  setPromoCode: (code: string) => void;

  // Calculation
  result: PricingResult;
  breakdown: PricingBreakdown | null;
  commitmentDiscount: { percentage: number; code: string | null };

  // Formatting
  formatPrice: (cents: number) => string;

  // Subscription creation helpers
  getSubscriptionData: () => {
    modalities: string[];
    commitment_months: number;
    calculated_price_cents: number;
    commitment_discount_pct: number;
    promo_discount_pct: number;
    final_price_cents: number;
    enrollment_fee_cents: number;
    starts_at: string;
    expires_at: string;
    commitment_discount_id: string | null;
    promo_discount_id: string | null;
  } | null;

  // Actions
  confirmPromoCode: () => Promise<void>;

  // Loading states
  isLoading: boolean;
}

export const usePricing = (options: UsePricingOptions): UsePricingReturn => {
  const { memberStatus, planOverride } = options;

  // Fetch data
  const { config, isLoading: configLoading } = usePricingConfig();
  const { discounts, isLoading: discountsLoading } = useDiscounts();
  const { modalities, isLoading: modalitiesLoading } = useModalities();
  const incrementUses = useIncrementDiscountUses();

  // Local state
  const [selectedModalities, setSelectedModalities] = useState<string[]>([]);
  const [selectedCommitmentMonths, setSelectedCommitmentMonths] = useState(1);
  const [promoCode, setPromoCode] = useState('');

  // Toggle modality selection
  const toggleModality = useCallback((id: string) => {
    setSelectedModalities((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }, []);

  // Calculate pricing
  const result = useMemo<PricingResult>(() => {
    if (configLoading || discountsLoading) {
      return { success: false, error: 'A carregar...' };
    }

    if (selectedModalities.length === 0) {
      return { success: false, error: 'Selecione pelo menos uma modalidade' };
    }

    return processPricing({
      config,
      discounts,
      modalityIds: selectedModalities,
      commitmentMonths: selectedCommitmentMonths,
      promoCode: promoCode.trim() || undefined,
      memberStatus,
      planOverride,
    });
  }, [
    config,
    discounts,
    selectedModalities,
    selectedCommitmentMonths,
    promoCode,
    memberStatus,
    planOverride,
    configLoading,
    discountsLoading,
  ]);

  // Get commitment discount info
  const commitmentDiscount = useMemo(() => {
    const found = findCommitmentDiscount(discounts, selectedCommitmentMonths);
    return {
      percentage: found.percentage,
      code: found.discount?.code || null,
    };
  }, [discounts, selectedCommitmentMonths]);

  // Format price
  const formatPrice = useCallback(
    (cents: number) => formatCurrency(cents, config.currency),
    [config.currency]
  );

  // Get subscription data for creation
  const getSubscriptionData = useCallback(() => {
    if (!result.success || !result.breakdown) return null;

    const startDate = new Date();
    const expiresAt = calculateExpiresAt(startDate, selectedCommitmentMonths);

    return {
      modalities: selectedModalities,
      commitment_months: selectedCommitmentMonths,
      calculated_price_cents: result.breakdown.subtotal_cents,
      commitment_discount_pct: result.breakdown.commitment_discount_pct,
      promo_discount_pct: result.breakdown.promo_discount_pct,
      final_price_cents: result.breakdown.monthly_price_cents,
      enrollment_fee_cents: result.breakdown.enrollment_fee_cents,
      starts_at: toISODateString(startDate),
      expires_at: toISODateString(expiresAt),
      commitment_discount_id: result.discount_ids?.commitment || null,
      promo_discount_id: result.discount_ids?.promo || null,
    };
  }, [result, selectedModalities, selectedCommitmentMonths]);

  // Confirm promo code usage (increment counter)
  const confirmPromoCode = useCallback(async () => {
    if (result.discount_ids?.promo) {
      await incrementUses.mutateAsync(result.discount_ids.promo);
    }
  }, [result.discount_ids?.promo, incrementUses]);

  return {
    // Data
    modalities,
    commitmentPeriods: CommitmentPeriods,
    config,

    // Selected state
    selectedModalities,
    selectedCommitmentMonths,
    promoCode,

    // Setters
    setSelectedModalities,
    toggleModality,
    setSelectedCommitmentMonths,
    setPromoCode,

    // Calculation
    result,
    breakdown: result.breakdown || null,
    commitmentDiscount,

    // Formatting
    formatPrice,

    // Helpers
    getSubscriptionData,

    // Actions
    confirmPromoCode,

    // Loading
    isLoading: configLoading || discountsLoading || modalitiesLoading,
  };
};

// Hook for subscription creation
export const useCreateSubscription = () => {
  const { mutateAsync: confirmPromo } = useIncrementDiscountUses();

  const createSubscription = useCallback(
    async (
      supabase: ReturnType<typeof import('@/integrations/supabase/client').supabase['from']>,
      data: {
        member_id: string;
        plan_id?: string | null;
        modalities: string[];
        commitment_months: number;
        calculated_price_cents: number;
        commitment_discount_pct: number;
        promo_discount_pct: number;
        final_price_cents: number;
        enrollment_fee_cents: number;
        starts_at: string;
        expires_at: string;
        commitment_discount_id: string | null;
        promo_discount_id: string | null;
        created_by?: string;
      }
    ) => {
      // Create subscription
      // Note: Using supabase client directly since we can't import it here
      // This is a placeholder - actual implementation would use the supabase client

      // Increment promo code uses if applicable
      if (data.promo_discount_id) {
        await confirmPromo(data.promo_discount_id);
      }

      return data;
    },
    [confirmPromo]
  );

  return { createSubscription };
};
