import { describe, it, expect } from 'vitest';
import {
  calculatePrice,
  validatePromoCode,
  findCommitmentDiscount,
  resolvePrices,
  formatCurrency,
  calculateExpiresAt,
} from '../pricing-engine';
import type { PricingConfig, Discount } from '@/types/pricing';

describe('resolvePrices', () => {
  const baseConfig: PricingConfig = {
    id: '1',
    base_price_cents: 6000,
    extra_modality_price_cents: 3000,
    enrollment_fee_cents: 5000,
    created_at: '',
    updated_at: '',
  };

  it('returns config values when no override', () => {
    const result = resolvePrices(baseConfig, null);

    expect(result.base_price_cents).toBe(6000);
    expect(result.extra_modality_price_cents).toBe(3000);
    expect(result.enrollment_fee_cents).toBe(5000);
  });

  it('applies override values when provided', () => {
    const override = {
      plan_id: '1',
      base_price_cents: 7000,
      extra_modality_price_cents: 3500,
      enrollment_fee_cents: 4000,
    };

    const result = resolvePrices(baseConfig, override);

    expect(result.base_price_cents).toBe(7000);
    expect(result.extra_modality_price_cents).toBe(3500);
    expect(result.enrollment_fee_cents).toBe(4000);
  });

  it('partially applies override', () => {
    const override = {
      plan_id: '1',
      base_price_cents: 7000,
      // Other values not provided
    };

    const result = resolvePrices(baseConfig, override as any);

    expect(result.base_price_cents).toBe(7000);
    expect(result.extra_modality_price_cents).toBe(3000); // From config
    expect(result.enrollment_fee_cents).toBe(5000); // From config
  });
});

describe('calculatePrice', () => {
  const baseConfig: PricingConfig = {
    id: '1',
    base_price_cents: 6000, // €60
    extra_modality_price_cents: 3000, // €30
    enrollment_fee_cents: 5000, // €50
    created_at: '',
    updated_at: '',
  };

  it('calculates base price with 1 modality', () => {
    const result = calculatePrice({
      config: baseConfig,
      modalityCount: 1,
      commitmentMonths: 1,
      commitmentDiscountPct: 0,
      promoDiscount: null,
      isFirstTime: false,
      planOverride: null,
    });

    expect(result.monthly_price_cents).toBe(6000);
    expect(result.extra_modalities_count).toBe(0);
    expect(result.extra_modalities_cents).toBe(0);
  });

  it('adds extra price per additional modality', () => {
    const result = calculatePrice({
      config: baseConfig,
      modalityCount: 3, // 1 base + 2 extra
      commitmentMonths: 1,
      commitmentDiscountPct: 0,
      promoDiscount: null,
      isFirstTime: false,
      planOverride: null,
    });

    // 6000 + (2 × 3000) = 12000
    expect(result.monthly_price_cents).toBe(12000);
    expect(result.extra_modalities_count).toBe(2);
    expect(result.extra_modalities_cents).toBe(6000);
  });

  it('applies commitment discount', () => {
    const result = calculatePrice({
      config: baseConfig,
      modalityCount: 1,
      commitmentMonths: 12,
      commitmentDiscountPct: 15, // 15% discount
      promoDiscount: null,
      isFirstTime: false,
      planOverride: null,
    });

    // 6000 × 0.85 = 5100
    expect(result.monthly_price_cents).toBe(5100);
    expect(result.commitment_discount_pct).toBe(15);
    expect(result.commitment_discount_cents).toBe(900);
  });

  it('applies percentage promo discount AFTER commitment', () => {
    const result = calculatePrice({
      config: baseConfig,
      modalityCount: 1,
      commitmentMonths: 12,
      commitmentDiscountPct: 10,
      promoDiscount: { type: 'percentage', value: 20 },
      isFirstTime: false,
      planOverride: null,
    });

    // 6000 × 0.90 = 5400 (after commitment)
    // 5400 × 0.80 = 4320 (after promo)
    expect(result.monthly_price_cents).toBe(4320);
  });

  it('applies fixed promo discount', () => {
    const result = calculatePrice({
      config: baseConfig,
      modalityCount: 1,
      commitmentMonths: 1,
      commitmentDiscountPct: 0,
      promoDiscount: { type: 'fixed', value: 1000 }, // €10 off
      isFirstTime: false,
      planOverride: null,
    });

    // 6000 - 1000 = 5000
    expect(result.monthly_price_cents).toBe(5000);
    expect(result.promo_discount_cents).toBe(1000);
  });

  it('caps fixed discount at subtotal', () => {
    const result = calculatePrice({
      config: baseConfig,
      modalityCount: 1,
      commitmentMonths: 1,
      commitmentDiscountPct: 0,
      promoDiscount: { type: 'fixed', value: 10000 }, // €100 off (more than price)
      isFirstTime: false,
      planOverride: null,
    });

    // Fixed discount capped at 6000
    expect(result.monthly_price_cents).toBe(0);
    expect(result.promo_discount_cents).toBe(6000);
  });

  it('includes enrollment fee for first-time members', () => {
    const result = calculatePrice({
      config: baseConfig,
      modalityCount: 1,
      commitmentMonths: 1,
      commitmentDiscountPct: 0,
      promoDiscount: null,
      isFirstTime: true,
      planOverride: null,
    });

    expect(result.enrollment_fee_cents).toBe(5000);
    expect(result.total_first_payment_cents).toBe(11000); // 6000 + 5000
  });

  it('excludes enrollment fee for renewals', () => {
    const result = calculatePrice({
      config: baseConfig,
      modalityCount: 1,
      commitmentMonths: 1,
      commitmentDiscountPct: 0,
      promoDiscount: null,
      isFirstTime: false,
      planOverride: null,
    });

    expect(result.enrollment_fee_cents).toBe(0);
    expect(result.total_first_payment_cents).toBe(6000);
  });

  it('handles 0 modalities by treating as 1', () => {
    const result = calculatePrice({
      config: baseConfig,
      modalityCount: 0,
      commitmentMonths: 1,
      commitmentDiscountPct: 0,
      promoDiscount: null,
      isFirstTime: false,
      planOverride: null,
    });

    expect(result.monthly_price_cents).toBe(6000);
    expect(result.extra_modalities_count).toBe(0);
  });
});

describe('findCommitmentDiscount', () => {
  const discounts: Discount[] = [
    {
      id: '1',
      code: 'ANUAL',
      category: 'commitment',
      discount_type: 'percentage',
      discount_value: 15,
      min_commitment_months: 12,
      ativo: true,
      valid_from: null,
      valid_until: null,
      max_uses: null,
      current_uses: 0,
      new_members_only: false,
      created_at: '',
    },
    {
      id: '2',
      code: 'SEMESTRAL',
      category: 'commitment',
      discount_type: 'percentage',
      discount_value: 10,
      min_commitment_months: 6,
      ativo: true,
      valid_from: null,
      valid_until: null,
      max_uses: null,
      current_uses: 0,
      new_members_only: false,
      created_at: '',
    },
    {
      id: '3',
      code: 'TRIMESTRAL',
      category: 'commitment',
      discount_type: 'percentage',
      discount_value: 5,
      min_commitment_months: 3,
      ativo: true,
      valid_from: null,
      valid_until: null,
      max_uses: null,
      current_uses: 0,
      new_members_only: false,
      created_at: '',
    },
    {
      id: '4',
      code: 'INACTIVE',
      category: 'commitment',
      discount_type: 'percentage',
      discount_value: 20,
      min_commitment_months: 1,
      ativo: false, // Inactive
      valid_from: null,
      valid_until: null,
      max_uses: null,
      current_uses: 0,
      new_members_only: false,
      created_at: '',
    },
  ];

  it('returns best discount for 12 months', () => {
    const result = findCommitmentDiscount(discounts, 12);

    expect(result.discount?.code).toBe('ANUAL');
    expect(result.percentage).toBe(15);
  });

  it('returns 6-month discount for 6 months', () => {
    const result = findCommitmentDiscount(discounts, 6);

    expect(result.discount?.code).toBe('SEMESTRAL');
    expect(result.percentage).toBe(10);
  });

  it('returns 3-month discount for 3 months', () => {
    const result = findCommitmentDiscount(discounts, 3);

    expect(result.discount?.code).toBe('TRIMESTRAL');
    expect(result.percentage).toBe(5);
  });

  it('returns no discount for 1 month', () => {
    const result = findCommitmentDiscount(discounts, 1);

    expect(result.discount).toBe(null);
    expect(result.percentage).toBe(0);
  });

  it('ignores inactive discounts', () => {
    const result = findCommitmentDiscount(discounts, 1);

    expect(result.discount?.code).not.toBe('INACTIVE');
  });

  it('selects highest discount when multiple qualify', () => {
    const result = findCommitmentDiscount(discounts, 24);

    // 24 months qualifies for all, should pick highest (15%)
    expect(result.percentage).toBe(15);
  });
});

describe('validatePromoCode', () => {
  const today = new Date('2026-01-15');

  const validPromo: Discount = {
    id: '1',
    code: 'PROMO10',
    category: 'promo',
    discount_type: 'percentage',
    discount_value: 10,
    min_commitment_months: null,
    ativo: true,
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
    max_uses: 100,
    current_uses: 50,
    new_members_only: false,
    created_at: '',
  };

  it('accepts valid promo code', () => {
    const result = validatePromoCode('PROMO10', [validPromo], 'ATIVO', today);

    expect(result.valid).toBe(true);
    expect(result.discount?.code).toBe('PROMO10');
  });

  it('accepts code case-insensitively', () => {
    const result = validatePromoCode('promo10', [validPromo], 'ATIVO', today);

    expect(result.valid).toBe(true);
  });

  it('rejects invalid code', () => {
    const result = validatePromoCode('INVALID', [validPromo], 'ATIVO', today);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalido');
  });

  it('rejects expired code', () => {
    const expiredPromo = { ...validPromo, valid_until: '2025-12-31' };
    const result = validatePromoCode('PROMO10', [expiredPromo], 'ATIVO', today);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('expirado');
  });

  it('rejects code not yet valid', () => {
    const futurePromo = { ...validPromo, valid_from: '2026-06-01' };
    const result = validatePromoCode('PROMO10', [futurePromo], 'ATIVO', today);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('ainda nao valido');
  });

  it('rejects exhausted code', () => {
    const exhaustedPromo = { ...validPromo, max_uses: 100, current_uses: 100 };
    const result = validatePromoCode('PROMO10', [exhaustedPromo], 'ATIVO', today);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('esgotado');
  });

  it('rejects new_members_only for ATIVO', () => {
    const newMemberPromo = { ...validPromo, new_members_only: true };
    const result = validatePromoCode('PROMO10', [newMemberPromo], 'ATIVO', today);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('novos membros');
  });

  it('accepts new_members_only for LEAD', () => {
    const newMemberPromo = { ...validPromo, new_members_only: true };
    const result = validatePromoCode('PROMO10', [newMemberPromo], 'LEAD', today);

    expect(result.valid).toBe(true);
  });

  it('accepts code with no max_uses', () => {
    const unlimitedPromo = { ...validPromo, max_uses: null };
    const result = validatePromoCode('PROMO10', [unlimitedPromo], 'ATIVO', today);

    expect(result.valid).toBe(true);
  });

  it('accepts code with no date restrictions', () => {
    const openPromo = { ...validPromo, valid_from: null, valid_until: null };
    const result = validatePromoCode('PROMO10', [openPromo], 'ATIVO', today);

    expect(result.valid).toBe(true);
  });

  it('rejects inactive promo', () => {
    const inactivePromo = { ...validPromo, ativo: false };
    const result = validatePromoCode('PROMO10', [inactivePromo], 'ATIVO', today);

    expect(result.valid).toBe(false);
  });
});

describe('formatCurrency', () => {
  it('formats cents to EUR', () => {
    const result = formatCurrency(6000);

    expect(result).toMatch(/60[,.]00/); // Handles both pt-PT and en formats
    expect(result).toContain('€');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);

    expect(result).toMatch(/0[,.]00/);
  });

  it('formats decimal cents correctly', () => {
    const result = formatCurrency(6050);

    expect(result).toMatch(/60[,.]50/);
  });
});

describe('calculateExpiresAt', () => {
  it('adds months correctly', () => {
    const start = new Date('2026-01-15');
    const result = calculateExpiresAt(start, 1);

    expect(result.getMonth()).toBe(1); // February (0-indexed)
    expect(result.getDate()).toBe(15);
  });

  it('handles year rollover', () => {
    const start = new Date('2026-11-15');
    const result = calculateExpiresAt(start, 3);

    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(1); // February
  });

  it('handles 12 month commitment', () => {
    const start = new Date('2026-01-15');
    const result = calculateExpiresAt(start, 12);

    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0); // January
  });
});
