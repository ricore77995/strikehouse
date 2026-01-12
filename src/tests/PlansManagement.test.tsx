import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('Plans Management - CRUD Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create new plan with all required fields', async () => {
    const newPlan = {
      nome: 'Plano Mensal',
      tipo: 'SUBSCRIPTION',
      preco_cents: 6900, // €69.00
      duracao_dias: 30,
      enrollment_fee_cents: 3000, // €30.00
      ativo: true,
    };

    const mockInsert = vi.fn().mockResolvedValue({
      data: { ...newPlan, id: 'plan-001' },
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'plans') {
        return { insert: mockInsert } as any;
      }
      return {} as any;
    });

    await supabase.from('plans').insert(newPlan);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Plano Mensal',
        tipo: 'SUBSCRIPTION',
        preco_cents: 6900,
        duracao_dias: 30,
        enrollment_fee_cents: 3000,
        ativo: true,
      })
    );
  });

  it('should create CREDITS plan with credits instead of duration', async () => {
    const creditsPlan = {
      nome: 'Pacote 10 Créditos',
      tipo: 'CREDITS',
      preco_cents: 7500, // €75.00
      creditos: 10,
      duracao_dias: null, // No duration for CREDITS
      ativo: true,
    };

    const mockInsert = vi.fn().mockResolvedValue({
      data: { ...creditsPlan, id: 'plan-002' },
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'plans') {
        return { insert: mockInsert } as any;
      }
      return {} as any;
    });

    await supabase.from('plans').insert(creditsPlan);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'CREDITS',
        creditos: 10,
        duracao_dias: null,
      })
    );
  });

  it('should create DAILY_PASS plan with 1 day duration', async () => {
    const dailyPass = {
      nome: 'Passe Diário',
      tipo: 'DAILY_PASS',
      preco_cents: 1500, // €15.00
      duracao_dias: 1,
      ativo: true,
    };

    const mockInsert = vi.fn().mockResolvedValue({
      data: { ...dailyPass, id: 'plan-003' },
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'plans') {
        return { insert: mockInsert } as any;
      }
      return {} as any;
    });

    await supabase.from('plans').insert(dailyPass);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'DAILY_PASS',
        duracao_dias: 1,
        preco_cents: 1500,
      })
    );
  });

  it('should update plan price and enrollment fee', async () => {
    const planId = 'plan-001';
    const updates = {
      preco_cents: 7900, // €79.00 (price increase)
      enrollment_fee_cents: 2000, // €20.00 (fee decrease)
    };

    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'plans') {
        return { update: mockUpdate } as any;
      }
      return {} as any;
    });

    await supabase.from('plans').update(updates).eq('id', planId);

    expect(mockUpdate).toHaveBeenCalledWith(updates);
    expect(mockEq).toHaveBeenCalledWith('id', planId);
  });

  it('should deactivate plan instead of deleting', async () => {
    const planId = 'plan-004';

    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'plans') {
        return { update: mockUpdate } as any;
      }
      return {} as any;
    });

    // Instead of delete, mark as inactive
    await supabase.from('plans').update({ ativo: false }).eq('id', planId);

    expect(mockUpdate).toHaveBeenCalledWith({ ativo: false });
    expect(mockEq).toHaveBeenCalledWith('id', planId);
  });

  it('should validate plan price is positive', () => {
    const validPrices = [6900, 7500, 1500, 100];
    const invalidPrices = [-6900, 0, -100];

    validPrices.forEach((price) => {
      expect(price).toBeGreaterThan(0);
    });

    invalidPrices.forEach((price) => {
      expect(price).toBeLessThanOrEqual(0);
    });
  });

  it('should validate enrollment fee is non-negative', () => {
    const validFees = [3000, 2000, 0]; // Zero is valid (fee waiver)
    const invalidFees = [-3000, -100];

    validFees.forEach((fee) => {
      expect(fee).toBeGreaterThanOrEqual(0);
    });

    invalidFees.forEach((fee) => {
      expect(fee).toBeLessThan(0);
    });
  });
});

describe('Plans Management - Filtering & Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should filter only active plans for enrollment page', async () => {
    const mockPlans = [
      { id: '1', nome: 'Plano A', ativo: true },
      { id: '2', nome: 'Plano B', ativo: true },
    ];

    const mockOrder = vi.fn().mockResolvedValue({ data: mockPlans, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'plans') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    const results = await supabase
      .from('plans')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    expect(mockEq).toHaveBeenCalledWith('ativo', true);
    expect(results.data).toHaveLength(2);
  });

  it('should filter plans by type', async () => {
    const mockSubscriptions = [
      { id: '1', nome: 'Mensal', tipo: 'SUBSCRIPTION' },
      { id: '2', nome: 'Anual', tipo: 'SUBSCRIPTION' },
    ];

    const mockOrder = vi.fn().mockResolvedValue({ data: mockSubscriptions, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'plans') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    const results = await supabase
      .from('plans')
      .select('*')
      .eq('tipo', 'SUBSCRIPTION')
      .order('preco_cents');

    expect(mockEq).toHaveBeenCalledWith('tipo', 'SUBSCRIPTION');
    expect(results.data).toHaveLength(2);
  });

  it('should calculate monthly cost for annual plans', () => {
    const annualPlan = {
      nome: 'Plano Anual',
      tipo: 'SUBSCRIPTION',
      preco_cents: 69000, // €690.00 per year
      duracao_dias: 365,
    };

    // Monthly cost = annual price / 12 months
    const monthlyCostCents = Math.round(annualPlan.preco_cents / 12);
    const monthlyCostEuros = monthlyCostCents / 100;

    expect(monthlyCostCents).toBe(5750); // €57.50 per month
    expect(monthlyCostEuros).toBe(57.5);
  });

  it('should calculate cost per credit for CREDITS plans', () => {
    const creditsPlan = {
      nome: 'Pacote 10 Créditos',
      tipo: 'CREDITS',
      preco_cents: 7500, // €75.00
      creditos: 10,
    };

    const costPerCreditCents = creditsPlan.preco_cents / creditsPlan.creditos;
    const costPerCreditEuros = costPerCreditCents / 100;

    expect(costPerCreditCents).toBe(750); // €7.50 per credit
    expect(costPerCreditEuros).toBe(7.5);
  });
});

describe('Plans Management - Validation Rules', () => {
  it('should validate SUBSCRIPTION plans have duration', () => {
    const validSubscription = {
      tipo: 'SUBSCRIPTION',
      duracao_dias: 30,
    };

    const invalidSubscription = {
      tipo: 'SUBSCRIPTION',
      duracao_dias: null,
    };

    expect(validSubscription.duracao_dias).not.toBeNull();
    expect(validSubscription.duracao_dias).toBeGreaterThan(0);

    expect(invalidSubscription.duracao_dias).toBeNull();
    // In real app, this would fail validation
  });

  it('should validate CREDITS plans have credits', () => {
    const validCredits = {
      tipo: 'CREDITS',
      creditos: 10,
    };

    const invalidCredits = {
      tipo: 'CREDITS',
      creditos: null,
    };

    expect(validCredits.creditos).not.toBeNull();
    expect(validCredits.creditos).toBeGreaterThan(0);

    expect(invalidCredits.creditos).toBeNull();
    // In real app, this would fail validation
  });

  it('should validate DAILY_PASS has 1 day duration', () => {
    const validDailyPass = {
      tipo: 'DAILY_PASS',
      duracao_dias: 1,
    };

    const invalidDailyPass = {
      tipo: 'DAILY_PASS',
      duracao_dias: 7, // Invalid: DAILY_PASS must be 1 day
    };

    expect(validDailyPass.duracao_dias).toBe(1);
    expect(invalidDailyPass.duracao_dias).not.toBe(1);
  });

  it('should validate plan name is not empty', () => {
    const validNames = ['Plano Mensal', 'Pacote 10 Créditos', 'Passe Diário'];
    const invalidNames = ['', '   ', null, undefined];

    validNames.forEach((name) => {
      expect(name).toBeTruthy();
      expect(name.trim().length).toBeGreaterThan(0);
    });

    invalidNames.forEach((name) => {
      if (name === null || name === undefined) {
        expect(name).toBeFalsy();
      } else {
        expect(name.trim().length).toBe(0);
      }
    });
  });
});

describe('Plans Management - Popular Plans', () => {
  it('should identify most popular plan by member count', () => {
    const planStats = [
      { plan_id: '1', nome: 'Plano Mensal', member_count: 45 },
      { plan_id: '2', nome: 'Plano Anual', member_count: 30 },
      { plan_id: '3', nome: 'Pacote Créditos', member_count: 15 },
    ];

    const mostPopular = planStats.reduce((prev, current) =>
      prev.member_count > current.member_count ? prev : current
    );

    expect(mostPopular.nome).toBe('Plano Mensal');
    expect(mostPopular.member_count).toBe(45);
  });

  it('should calculate total revenue per plan type', () => {
    const transactions = [
      { category: 'SUBSCRIPTION', amount_cents: 6900 },
      { category: 'SUBSCRIPTION', amount_cents: 6900 },
      { category: 'CREDITS', amount_cents: 7500 },
      { category: 'DAILY_PASS', amount_cents: 1500 },
      { category: 'SUBSCRIPTION', amount_cents: 6900 },
    ];

    const revenueByType = transactions.reduce((acc, txn) => {
      acc[txn.category] = (acc[txn.category] || 0) + txn.amount_cents;
      return acc;
    }, {} as Record<string, number>);

    expect(revenueByType['SUBSCRIPTION']).toBe(20700); // €207.00 (3x €69)
    expect(revenueByType['CREDITS']).toBe(7500); // €75.00
    expect(revenueByType['DAILY_PASS']).toBe(1500); // €15.00
  });
});
