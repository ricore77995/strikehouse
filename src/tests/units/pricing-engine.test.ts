import { describe, it, expect } from 'vitest';
import {
  calculatePrice,
  processPricing,
  findCommitmentDiscount,
  validatePromoCode,
  formatCurrency,
  calculateExpiresAt,
} from '@/lib/pricing-engine';
import type { PricingConfig, Discount } from '@/types/pricing';

// Test fixtures
const mockConfig: PricingConfig = {
  id: 'config-1',
  base_price_cents: 6000, // €60.00
  extra_modality_price_cents: 3000, // €30.00
  single_class_price_cents: 1500,
  day_pass_price_cents: 2500,
  enrollment_fee_cents: 1500, // €15.00
  currency: 'EUR',
  updated_at: new Date().toISOString(),
};

const mockDiscounts: Discount[] = [
  {
    id: 'commit-1',
    code: 'MENSAL',
    nome: 'Sem Compromisso',
    category: 'commitment',
    discount_type: 'percentage',
    discount_value: 0,
    min_commitment_months: 1,
    ativo: true,
    current_uses: 0,
    new_members_only: false,
    created_at: new Date().toISOString(),
    valid_from: null,
    valid_until: null,
    max_uses: null,
    referrer_credit_cents: null,
  },
  {
    id: 'commit-2',
    code: 'TRIMESTRAL',
    nome: 'Desconto Trimestral',
    category: 'commitment',
    discount_type: 'percentage',
    discount_value: 10,
    min_commitment_months: 3,
    ativo: true,
    current_uses: 0,
    new_members_only: false,
    created_at: new Date().toISOString(),
    valid_from: null,
    valid_until: null,
    max_uses: null,
    referrer_credit_cents: null,
  },
  {
    id: 'commit-3',
    code: 'SEMESTRAL',
    nome: 'Desconto Semestral',
    category: 'commitment',
    discount_type: 'percentage',
    discount_value: 15,
    min_commitment_months: 6,
    ativo: true,
    current_uses: 0,
    new_members_only: false,
    created_at: new Date().toISOString(),
    valid_from: null,
    valid_until: null,
    max_uses: null,
    referrer_credit_cents: null,
  },
  {
    id: 'promo-pct',
    code: 'UNI15',
    nome: 'Desconto Universitario',
    category: 'promo',
    discount_type: 'percentage',
    discount_value: 15,
    min_commitment_months: null,
    ativo: true,
    current_uses: 0,
    new_members_only: false,
    created_at: new Date().toISOString(),
    valid_from: null,
    valid_until: null,
    max_uses: 100,
    referrer_credit_cents: null,
  },
  {
    id: 'promo-fix',
    code: 'FIX10',
    nome: 'Desconto Fixo €10',
    category: 'promo',
    discount_type: 'fixed',
    discount_value: 1000, // €10.00 in cents
    min_commitment_months: null,
    ativo: true,
    current_uses: 0,
    new_members_only: false,
    created_at: new Date().toISOString(),
    valid_from: null,
    valid_until: null,
    max_uses: 50,
    referrer_credit_cents: null,
  },
  {
    id: 'promo-expired',
    code: 'EXPIRED',
    nome: 'Codigo Expirado',
    category: 'promo',
    discount_type: 'percentage',
    discount_value: 20,
    min_commitment_months: null,
    ativo: true,
    current_uses: 0,
    new_members_only: false,
    created_at: new Date().toISOString(),
    valid_from: null,
    valid_until: '2020-01-01',
    max_uses: null,
    referrer_credit_cents: null,
  },
  {
    id: 'promo-maxed',
    code: 'MAXED',
    nome: 'Codigo Esgotado',
    category: 'promo',
    discount_type: 'percentage',
    discount_value: 10,
    min_commitment_months: null,
    ativo: true,
    current_uses: 100,
    new_members_only: false,
    created_at: new Date().toISOString(),
    valid_from: null,
    valid_until: null,
    max_uses: 100,
    referrer_credit_cents: null,
  },
  {
    id: 'promo-new-only',
    code: 'NEWBIE',
    nome: 'Apenas Novos',
    category: 'promo',
    discount_type: 'percentage',
    discount_value: 25,
    min_commitment_months: null,
    ativo: true,
    current_uses: 0,
    new_members_only: true,
    created_at: new Date().toISOString(),
    valid_from: null,
    valid_until: null,
    max_uses: null,
    referrer_credit_cents: null,
  },
];

describe('calculatePrice', () => {
  describe('basic calculations', () => {
    it('calculates price for 1 modality without discounts', () => {
      const result = calculatePrice({
        config: mockConfig,
        modalityCount: 1,
        commitmentMonths: 1,
        commitmentDiscountPct: 0,
        promoDiscount: null,
        isFirstTime: false,
        planOverride: null,
      });

      expect(result.base_price_cents).toBe(6000);
      expect(result.extra_modalities_count).toBe(0);
      expect(result.extra_modalities_cents).toBe(0);
      expect(result.subtotal_cents).toBe(6000);
      expect(result.monthly_price_cents).toBe(6000);
      expect(result.enrollment_fee_cents).toBe(0);
    });

    it('calculates price for 2 modalities', () => {
      const result = calculatePrice({
        config: mockConfig,
        modalityCount: 2,
        commitmentMonths: 1,
        commitmentDiscountPct: 0,
        promoDiscount: null,
        isFirstTime: false,
        planOverride: null,
      });

      // Base + 1 extra = 6000 + 3000 = 9000
      expect(result.base_price_cents).toBe(6000);
      expect(result.extra_modalities_count).toBe(1);
      expect(result.extra_modalities_cents).toBe(3000);
      expect(result.subtotal_cents).toBe(9000);
      expect(result.monthly_price_cents).toBe(9000);
    });

    it('calculates price for 3 modalities', () => {
      const result = calculatePrice({
        config: mockConfig,
        modalityCount: 3,
        commitmentMonths: 1,
        commitmentDiscountPct: 0,
        promoDiscount: null,
        isFirstTime: false,
        planOverride: null,
      });

      // Base + 2 extras = 6000 + 6000 = 12000
      expect(result.subtotal_cents).toBe(12000);
      expect(result.monthly_price_cents).toBe(12000);
    });

    it('includes enrollment fee for first-time members', () => {
      const result = calculatePrice({
        config: mockConfig,
        modalityCount: 1,
        commitmentMonths: 1,
        commitmentDiscountPct: 0,
        promoDiscount: null,
        isFirstTime: true,
        planOverride: null,
      });

      expect(result.enrollment_fee_cents).toBe(1500);
      expect(result.total_first_payment_cents).toBe(6000 + 1500);
    });

    it('handles 0 modalities gracefully (defaults to 1)', () => {
      const result = calculatePrice({
        config: mockConfig,
        modalityCount: 0,
        commitmentMonths: 1,
        commitmentDiscountPct: 0,
        promoDiscount: null,
        isFirstTime: false,
        planOverride: null,
      });

      expect(result.extra_modalities_count).toBe(0);
      expect(result.monthly_price_cents).toBe(6000);
    });
  });

  describe('commitment discounts', () => {
    it('applies 10% commitment discount', () => {
      const result = calculatePrice({
        config: mockConfig,
        modalityCount: 1,
        commitmentMonths: 3,
        commitmentDiscountPct: 10,
        promoDiscount: null,
        isFirstTime: false,
        planOverride: null,
      });

      // 6000 * 0.90 = 5400
      expect(result.commitment_discount_pct).toBe(10);
      expect(result.commitment_discount_cents).toBe(600);
      expect(result.monthly_price_cents).toBe(5400);
    });

    it('applies 15% commitment discount', () => {
      const result = calculatePrice({
        config: mockConfig,
        modalityCount: 2,
        commitmentMonths: 6,
        commitmentDiscountPct: 15,
        promoDiscount: null,
        isFirstTime: false,
        planOverride: null,
      });

      // Subtotal: 9000, after 15% = 7650
      expect(result.subtotal_cents).toBe(9000);
      expect(result.commitment_discount_cents).toBe(1350);
      expect(result.monthly_price_cents).toBe(7650);
    });
  });

  describe('percentage promo discounts', () => {
    it('applies percentage promo discount', () => {
      const result = calculatePrice({
        config: mockConfig,
        modalityCount: 1,
        commitmentMonths: 1,
        commitmentDiscountPct: 0,
        promoDiscount: { type: 'percentage', value: 15 },
        isFirstTime: false,
        planOverride: null,
      });

      // 6000 * 0.85 = 5100
      expect(result.promo_discount_pct).toBe(15);
      expect(result.promo_discount_cents).toBe(900);
      expect(result.monthly_price_cents).toBe(5100);
    });

    it('stacks commitment and promo percentage discounts (multiplicative)', () => {
      const result = calculatePrice({
        config: mockConfig,
        modalityCount: 1,
        commitmentMonths: 3,
        commitmentDiscountPct: 10,
        promoDiscount: { type: 'percentage', value: 15 },
        isFirstTime: false,
        planOverride: null,
      });

      // Subtotal: 6000
      // After 10% commitment: 5400
      // After 15% promo: 5400 * 0.85 = 4590
      expect(result.subtotal_cents).toBe(6000);
      expect(result.commitment_discount_cents).toBe(600);
      expect(result.promo_discount_cents).toBe(810); // 5400 * 0.15
      expect(result.monthly_price_cents).toBe(4590);
    });
  });

  describe('fixed promo discounts', () => {
    it('applies fixed promo discount', () => {
      const result = calculatePrice({
        config: mockConfig,
        modalityCount: 1,
        commitmentMonths: 1,
        commitmentDiscountPct: 0,
        promoDiscount: { type: 'fixed', value: 1000 }, // €10.00
        isFirstTime: false,
        planOverride: null,
      });

      // 6000 - 1000 = 5000
      expect(result.promo_discount_cents).toBe(1000);
      expect(result.monthly_price_cents).toBe(5000);
    });

    it('applies fixed discount after commitment discount', () => {
      const result = calculatePrice({
        config: mockConfig,
        modalityCount: 2,
        commitmentMonths: 3,
        commitmentDiscountPct: 10,
        promoDiscount: { type: 'fixed', value: 1000 },
        isFirstTime: false,
        planOverride: null,
      });

      // Subtotal: 9000
      // After 10% commitment: 8100
      // After €10 fixed: 8100 - 1000 = 7100
      expect(result.subtotal_cents).toBe(9000);
      expect(result.commitment_discount_cents).toBe(900);
      expect(result.promo_discount_cents).toBe(1000);
      expect(result.monthly_price_cents).toBe(7100);
    });

    it('caps fixed discount at remaining price (prevents negative)', () => {
      const result = calculatePrice({
        config: mockConfig,
        modalityCount: 1,
        commitmentMonths: 1,
        commitmentDiscountPct: 0,
        promoDiscount: { type: 'fixed', value: 10000 }, // €100 > €60
        isFirstTime: false,
        planOverride: null,
      });

      // Fixed discount should be capped at subtotal
      expect(result.promo_discount_cents).toBe(6000);
      expect(result.monthly_price_cents).toBe(0);
    });

    it('handles fixed discount larger than price after commitment', () => {
      const result = calculatePrice({
        config: mockConfig,
        modalityCount: 1,
        commitmentMonths: 6,
        commitmentDiscountPct: 15,
        promoDiscount: { type: 'fixed', value: 10000 }, // €100
        isFirstTime: false,
        planOverride: null,
      });

      // Subtotal: 6000
      // After 15%: 5100
      // Fixed caps at 5100
      expect(result.promo_discount_cents).toBe(5100);
      expect(result.monthly_price_cents).toBe(0);
    });
  });

  describe('plan overrides', () => {
    it('uses plan override prices when provided', () => {
      const result = calculatePrice({
        config: mockConfig,
        modalityCount: 1,
        commitmentMonths: 1,
        commitmentDiscountPct: 0,
        promoDiscount: null,
        isFirstTime: false,
        planOverride: {
          base_price_cents: 5000,
          extra_modality_price_cents: 2500,
          enrollment_fee_cents: 1000,
        },
      });

      expect(result.base_price_cents).toBe(5000);
      expect(result.monthly_price_cents).toBe(5000);
    });
  });
});

describe('findCommitmentDiscount', () => {
  it('returns 0% for 1 month commitment', () => {
    const result = findCommitmentDiscount(mockDiscounts, 1);
    expect(result.percentage).toBe(0);
    expect(result.discount?.code).toBe('MENSAL');
  });

  it('returns 10% for 3 month commitment', () => {
    const result = findCommitmentDiscount(mockDiscounts, 3);
    expect(result.percentage).toBe(10);
    expect(result.discount?.code).toBe('TRIMESTRAL');
  });

  it('returns 15% for 6 month commitment', () => {
    const result = findCommitmentDiscount(mockDiscounts, 6);
    expect(result.percentage).toBe(15);
    expect(result.discount?.code).toBe('SEMESTRAL');
  });

  it('returns best available for 4 months (trimestral)', () => {
    const result = findCommitmentDiscount(mockDiscounts, 4);
    expect(result.percentage).toBe(10);
  });

  it('returns null for empty discounts array', () => {
    const result = findCommitmentDiscount([], 6);
    expect(result.percentage).toBe(0);
    expect(result.discount).toBeNull();
  });
});

describe('validatePromoCode', () => {
  it('validates a valid percentage promo code', () => {
    const result = validatePromoCode('UNI15', mockDiscounts, 'LEAD');
    expect(result.valid).toBe(true);
    expect(result.discount?.discount_type).toBe('percentage');
    expect(result.discount?.discount_value).toBe(15);
  });

  it('validates a valid fixed promo code', () => {
    const result = validatePromoCode('FIX10', mockDiscounts, 'LEAD');
    expect(result.valid).toBe(true);
    expect(result.discount?.discount_type).toBe('fixed');
    expect(result.discount?.discount_value).toBe(1000);
  });

  it('rejects invalid code', () => {
    const result = validatePromoCode('INVALID', mockDiscounts, 'LEAD');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Codigo invalido');
  });

  it('rejects expired code', () => {
    const result = validatePromoCode('EXPIRED', mockDiscounts, 'LEAD');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Codigo expirado');
  });

  it('rejects maxed out code', () => {
    const result = validatePromoCode('MAXED', mockDiscounts, 'LEAD');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Codigo esgotado');
  });

  it('rejects new-members-only code for existing member', () => {
    const result = validatePromoCode('NEWBIE', mockDiscounts, 'ATIVO');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Codigo apenas para novos membros');
  });

  it('accepts new-members-only code for LEAD', () => {
    const result = validatePromoCode('NEWBIE', mockDiscounts, 'LEAD');
    expect(result.valid).toBe(true);
  });

  it('is case insensitive', () => {
    const result = validatePromoCode('uni15', mockDiscounts, 'LEAD');
    expect(result.valid).toBe(true);
  });
});

describe('processPricing', () => {
  it('processes pricing with percentage promo', () => {
    const result = processPricing({
      config: mockConfig,
      discounts: mockDiscounts,
      modalityIds: ['mod-1'],
      commitmentMonths: 1,
      promoCode: 'UNI15',
      memberStatus: 'LEAD',
      planOverride: null,
    });

    expect(result.success).toBe(true);
    expect(result.breakdown?.promo_discount_pct).toBe(15);
    expect(result.breakdown?.monthly_price_cents).toBe(5100);
  });

  it('processes pricing with fixed promo', () => {
    const result = processPricing({
      config: mockConfig,
      discounts: mockDiscounts,
      modalityIds: ['mod-1'],
      commitmentMonths: 1,
      promoCode: 'FIX10',
      memberStatus: 'LEAD',
      planOverride: null,
    });

    expect(result.success).toBe(true);
    expect(result.breakdown?.promo_discount_cents).toBe(1000);
    expect(result.breakdown?.monthly_price_cents).toBe(5000);
  });

  it('fails for invalid promo code', () => {
    const result = processPricing({
      config: mockConfig,
      discounts: mockDiscounts,
      modalityIds: ['mod-1'],
      commitmentMonths: 1,
      promoCode: 'INVALID',
      memberStatus: 'LEAD',
      planOverride: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Codigo invalido');
  });

  it('fails for empty modalities', () => {
    const result = processPricing({
      config: mockConfig,
      discounts: mockDiscounts,
      modalityIds: [],
      commitmentMonths: 1,
      memberStatus: 'LEAD',
      planOverride: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Selecione pelo menos uma modalidade');
  });
});

describe('formatCurrency', () => {
  it('formats cents to EUR', () => {
    expect(formatCurrency(6000, 'EUR')).toMatch(/60[,.]00/);
  });

  it('formats zero', () => {
    expect(formatCurrency(0, 'EUR')).toMatch(/0[,.]00/);
  });
});

describe('calculateExpiresAt', () => {
  it('adds months to start date', () => {
    const start = new Date('2026-01-15');
    const expires = calculateExpiresAt(start, 3);
    expect(expires.getMonth()).toBe(3); // April (0-indexed)
  });

  it('handles year rollover', () => {
    const start = new Date('2026-11-15');
    const expires = calculateExpiresAt(start, 3);
    expect(expires.getFullYear()).toBe(2027);
    expect(expires.getMonth()).toBe(1); // February
  });
});
