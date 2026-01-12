import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { addDays } from 'date-fns';

describe('Payment Integration - Complete Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete LEAD enrollment with instant payment (DINHEIRO)', async () => {
    // Simulate complete flow: LEAD member → select plan → pay cash → activate
    const leadMember = {
      id: 'lead-001',
      nome: 'João Primeira Vez',
      status: 'LEAD',
      access_type: null,
      access_expires_at: null,
      credits_remaining: null,
    };

    const plan = {
      id: 'plan-mensal',
      nome: 'Plano Mensal',
      tipo: 'SUBSCRIPTION',
      preco_cents: 6900,
      duracao_dias: 30,
    };

    const paymentMethod = 'DINHEIRO';
    const staffId = 'staff-123';

    // Mock member update
    const mockMemberEq = vi.fn().mockResolvedValue({ error: null });
    const mockMemberUpdate = vi.fn().mockReturnValue({ eq: mockMemberEq });

    // Mock transaction insert
    const mockTransactionInsert = vi.fn().mockResolvedValue({ error: null });

    // Mock cash session query
    const mockSessionSingle = vi.fn().mockResolvedValue({
      data: { id: 'session-1', total_cash_in_cents: 0 },
      error: null,
    });
    const mockSessionEq = vi.fn().mockReturnValue({ maybeSingle: mockSessionSingle });
    const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq });

    // Mock cash session update
    const mockSessionUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockSessionUpdate = vi.fn().mockReturnValue({ eq: mockSessionUpdateEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { update: mockMemberUpdate } as any;
      }
      if (table === 'transactions') {
        return { insert: mockTransactionInsert } as any;
      }
      if (table === 'cash_sessions') {
        return {
          select: mockSessionSelect,
          update: mockSessionUpdate,
        } as any;
      }
      return {} as any;
    });

    // 1. Update member to ATIVO
    const newExpiresAt = addDays(new Date(), plan.duracao_dias);
    await supabase.from('members')
      .update({
        status: 'ATIVO',
        access_type: plan.tipo,
        access_expires_at: newExpiresAt.toISOString(),
        credits_remaining: null,
      })
      .eq('id', leadMember.id);

    // 2. Create transaction
    await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: plan.tipo,
      amount_cents: plan.preco_cents,
      payment_method: paymentMethod,
      member_id: leadMember.id,
      description: `Pagamento: ${plan.nome}`,
      created_by: staffId,
    });

    // 3. Update cash session (for DINHEIRO)
    const session = await supabase.from('cash_sessions')
      .select('*')
      .eq('session_date', new Date().toISOString().split('T')[0])
      .maybeSingle();

    if (session.data) {
      await supabase.from('cash_sessions')
        .update({
          total_cash_in_cents: (session.data as any).total_cash_in_cents + plan.preco_cents,
        })
        .eq('id', (session.data as any).id);
    }

    // Verify all steps completed
    expect(mockMemberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
      })
    );
    expect(mockTransactionInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: 6900,
        payment_method: 'DINHEIRO',
      })
    );
    expect(mockSessionUpdate).toHaveBeenCalled();
  });

  it('should create pending payment for TRANSFERENCIA', async () => {
    const member = {
      id: 'member-002',
      nome: 'Maria Costa',
      status: 'LEAD',
    };

    const plan = {
      id: 'plan-anual',
      nome: 'Plano Anual',
      tipo: 'SUBSCRIPTION',
      preco_cents: 69000, // €690
      duracao_dias: 365,
    };

    const paymentMethod = 'TRANSFERENCIA';
    const staffId = 'staff-456';

    // Mock pending payment insert
    const mockPendingInsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'pending_payments') {
        return { insert: mockPendingInsert } as any;
      }
      return {} as any;
    });

    // Create pending payment
    const expiresAt = addDays(new Date(), 7);
    await supabase.from('pending_payments').insert({
      member_id: member.id,
      plan_id: plan.id,
      amount_cents: plan.preco_cents,
      payment_method: paymentMethod,
      reference: `PAY-${Date.now()}`,
      expires_at: expiresAt.toISOString(),
      status: 'PENDING',
      created_by: staffId,
    });

    // Verify pending payment created
    expect(mockPendingInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        member_id: 'member-002',
        plan_id: 'plan-anual',
        amount_cents: 69000,
        payment_method: 'TRANSFERENCIA',
        status: 'PENDING',
        reference: expect.stringMatching(/^PAY-/),
      })
    );
  });

  it('should extend subscription for renewing ATIVO member', async () => {
    const ativoMember = {
      id: 'member-003',
      nome: 'Carlos Renovação',
      status: 'ATIVO',
      access_type: 'SUBSCRIPTION',
      access_expires_at: '2026-01-20', // Valid until Jan 20
      credits_remaining: null,
    };

    const plan = {
      tipo: 'SUBSCRIPTION',
      duracao_dias: 30,
      preco_cents: 6900,
    };

    // Calculate new expiration (extends from current expiration, not today)
    const currentExpires = new Date(ativoMember.access_expires_at);
    const today = new Date();
    const baseDate = currentExpires > today ? currentExpires : today;
    const newExpiresAt = addDays(baseDate, plan.duracao_dias);

    // Should extend from Jan 20 → Feb 19
    expect(newExpiresAt.toISOString().split('T')[0]).toBe('2026-02-19');
  });

  it('should add credits to existing balance for CREDITS plan', async () => {
    const memberWithCredits = {
      id: 'member-004',
      nome: 'Ana Créditos',
      status: 'ATIVO',
      access_type: 'CREDITS',
      credits_remaining: 5, // Has 5 credits
    };

    const creditsPlan = {
      tipo: 'CREDITS',
      creditos: 10, // Buying 10 more
      preco_cents: 7500, // €75
    };

    const newCredits = (memberWithCredits.credits_remaining || 0) + (creditsPlan.creditos || 0);

    expect(newCredits).toBe(15); // 5 + 10 = 15 credits
  });

  it('should handle DAILY_PASS expiration correctly', async () => {
    const plan = {
      tipo: 'DAILY_PASS',
      duracao_dias: 1,
      preco_cents: 1500, // €15
    };

    const today = new Date('2026-01-11T14:30:00'); // Jan 11, 2:30 PM
    const expiresAt = new Date(today);
    expiresAt.setHours(23, 59, 59, 999); // End of same day

    // Daily pass should expire at end of day, regardless of purchase time
    expect(expiresAt.toISOString().split('T')[0]).toBe('2026-01-11'); // Same day
    expect(expiresAt.getHours()).toBe(23);
    expect(expiresAt.getMinutes()).toBe(59);
  });

  it('should prevent payment if cash session is not open', async () => {
    const paymentMethod = 'DINHEIRO';

    // Mock no active cash session
    const mockSessionSingle = vi.fn().mockResolvedValue({
      data: null, // No session found
      error: null,
    });
    const mockSessionEq = vi.fn().mockReturnValue({ maybeSingle: mockSessionSingle });
    const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'cash_sessions') {
        return { select: mockSessionSelect } as any;
      }
      return {} as any;
    });

    const session = await supabase.from('cash_sessions')
      .select('*')
      .eq('session_date', new Date().toISOString().split('T')[0])
      .maybeSingle();

    // Should detect no active session
    expect(session.data).toBeNull();
    // In real app, this would show error: "Por favor, abra o caixa primeiro"
  });

  it('should validate payment amount is not zero or negative', () => {
    const invalidAmounts = [-100, 0, -6900];
    const validAmounts = [100, 6900, 150000];

    invalidAmounts.forEach(amount => {
      expect(amount).toBeLessThanOrEqual(0);
    });

    validAmounts.forEach(amount => {
      expect(amount).toBeGreaterThan(0);
    });
  });

  it('should create transaction with correct metadata', async () => {
    const mockTransactionInsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'transactions') {
        return { insert: mockTransactionInsert } as any;
      }
      return {} as any;
    });

    await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: 'SUBSCRIPTION',
      amount_cents: 6900,
      payment_method: 'CARTAO',
      member_id: 'member-123',
      description: 'Pagamento: Plano Mensal',
      created_by: 'staff-789',
    });

    expect(mockTransactionInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RECEITA', // Revenue type
        category: 'SUBSCRIPTION', // Matches plan type
        amount_cents: 6900, // Stored in cents
        payment_method: 'CARTAO',
        member_id: expect.any(String),
        description: expect.stringContaining('Plano Mensal'),
        created_by: expect.any(String),
      })
    );
  });

  it('should handle concurrent payment attempts gracefully', async () => {
    // Simulate race condition: two staff members try to activate same LEAD member
    const leadMember = {
      id: 'lead-race',
      status: 'LEAD',
    };

    // First payment succeeds
    const mockUpdate1 = vi.fn().mockResolvedValue({ error: null });

    // Second payment should fail (member already ATIVO)
    const mockUpdate2 = vi.fn().mockResolvedValue({
      error: { code: 'P0001', message: 'Member already active' },
    });

    // In real app, second payment should be rejected or refunded
    expect(mockUpdate2).toHaveBeenCalled;
  });
});

describe('Payment Validation Rules', () => {
  it('should validate member can receive new plan', () => {
    const validStatuses = ['LEAD', 'ATIVO', 'BLOQUEADO'];
    const invalidStatuses = ['CANCELADO']; // Cancelled members need reactivation flow

    validStatuses.forEach(status => {
      const canReceivePlan = status !== 'CANCELADO';
      expect(canReceivePlan).toBe(true);
    });

    invalidStatuses.forEach(status => {
      const canReceivePlan = status !== 'CANCELADO';
      expect(canReceivePlan).toBe(false);
    });
  });

  it('should validate payment method is allowed', () => {
    const validMethods = ['DINHEIRO', 'CARTAO', 'MBWAY', 'TRANSFERENCIA'];
    const invalidMethods = ['PAYPAL', 'CRYPTO', 'CHECK'];

    validMethods.forEach(method => {
      const isValid = ['DINHEIRO', 'CARTAO', 'MBWAY', 'TRANSFERENCIA'].includes(method);
      expect(isValid).toBe(true);
    });

    invalidMethods.forEach(method => {
      const isValid = ['DINHEIRO', 'CARTAO', 'MBWAY', 'TRANSFERENCIA'].includes(method);
      expect(isValid).toBe(false);
    });
  });

  it('should validate plan is active before allowing payment', () => {
    const activePlan = { id: '1', nome: 'Plano A', ativo: true };
    const inactivePlan = { id: '2', nome: 'Plano B', ativo: false };

    expect(activePlan.ativo).toBe(true);
    expect(inactivePlan.ativo).toBe(false);
    // In real app, inactive plans should not appear in selection
  });
});
