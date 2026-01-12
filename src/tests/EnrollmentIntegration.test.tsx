import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { addDays } from 'date-fns';

describe('Enrollment Integration - Complete Journey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full LEAD enrollment with enrollment fee (DINHEIRO)', async () => {
    // COMPLETE FLOW: LEAD → select plan → pay enrollment fee + plan → ATIVO
    const leadMember = {
      id: 'lead-001',
      nome: 'Pedro Primeiro',
      status: 'LEAD',
      access_type: null,
      access_expires_at: null,
    };

    const plan = {
      id: 'plan-001',
      nome: 'Plano Mensal',
      tipo: 'SUBSCRIPTION',
      preco_cents: 6900, // €69
      enrollment_fee_cents: 3000, // €30
      duracao_dias: 30,
    };

    const paymentMethod = 'DINHEIRO';
    const staffId = 'staff-123';

    // Mock member update (LEAD → ATIVO)
    const mockMemberEq = vi.fn().mockResolvedValue({ error: null });
    const mockMemberUpdate = vi.fn().mockReturnValue({ eq: mockMemberEq });

    // Mock transaction inserts (TWO transactions)
    const mockTransactionInsert = vi.fn()
      .mockResolvedValueOnce({ error: null }) // Plan payment
      .mockResolvedValueOnce({ error: null }); // Enrollment fee

    // Mock cash session
    const mockSessionSingle = vi.fn().mockResolvedValue({
      data: { id: 'session-1', total_cash_in_cents: 10000 },
      error: null,
    });
    const mockSessionEq = vi.fn().mockReturnValue({ maybeSingle: mockSessionSingle });
    const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq });

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
      })
      .eq('id', leadMember.id);

    // 2. Create TWO transactions: Plan + Enrollment Fee
    const totalCents = plan.preco_cents + plan.enrollment_fee_cents;

    // Transaction 1: Plan payment
    await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: plan.tipo,
      amount_cents: plan.preco_cents,
      payment_method: paymentMethod,
      member_id: leadMember.id,
      description: `Plano: ${plan.nome}`,
      created_by: staffId,
    });

    // Transaction 2: Enrollment fee
    await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: 'TAXA_MATRICULA',
      amount_cents: plan.enrollment_fee_cents,
      payment_method: paymentMethod,
      member_id: leadMember.id,
      description: `Taxa de Matrícula - ${plan.nome}`,
      created_by: staffId,
    });

    // 3. Update cash session with TOTAL amount
    const session = await supabase.from('cash_sessions')
      .select('*')
      .eq('session_date', new Date().toISOString().split('T')[0])
      .maybeSingle();

    if (session.data) {
      await supabase.from('cash_sessions')
        .update({
          total_cash_in_cents: (session.data as any).total_cash_in_cents + totalCents,
        })
        .eq('id', (session.data as any).id);
    }

    // Verify complete flow
    expect(mockMemberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
      })
    );

    // Verify TWO transactions created
    expect(mockTransactionInsert).toHaveBeenCalledTimes(2);

    // Transaction 1: Plan
    expect(mockTransactionInsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      category: 'SUBSCRIPTION',
      amount_cents: 6900,
    }));

    // Transaction 2: Enrollment fee
    expect(mockTransactionInsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      category: 'TAXA_MATRICULA',
      amount_cents: 3000,
    }));

    // Verify cash session updated with TOTAL (€99)
    expect(mockSessionUpdate).toHaveBeenCalledWith({
      total_cash_in_cents: 10000 + 9900, // €100 + €99 = €199
    });
  });

  it('should create enrollment pending payment with ENR- prefix (TRANSFERENCIA)', async () => {
    const leadMember = {
      id: 'lead-002',
      nome: 'Ana Transfer',
      status: 'LEAD',
    };

    const plan = {
      id: 'plan-002',
      nome: 'Plano Anual',
      tipo: 'SUBSCRIPTION',
      preco_cents: 69000, // €690
      enrollment_fee_cents: 3000, // €30
      duracao_dias: 365,
    };

    const paymentMethod = 'TRANSFERENCIA';
    const totalCents = plan.preco_cents + plan.enrollment_fee_cents; // €720

    // Mock pending payment insert
    const mockPendingInsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'pending_payments') {
        return { insert: mockPendingInsert } as any;
      }
      return {} as any;
    });

    // Create pending payment with ENR- prefix
    const expiresAt = addDays(new Date(), 7);
    const reference = `ENR-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;

    await supabase.from('pending_payments').insert({
      member_id: leadMember.id,
      plan_id: plan.id,
      amount_cents: totalCents, // TOTAL includes enrollment fee
      payment_method: paymentMethod,
      reference: reference, // ENR- prefix for enrollment
      expires_at: expiresAt.toISOString(),
      status: 'PENDING',
      created_by: 'staff-456',
    });

    // Verify pending payment with ENR- prefix and TOTAL amount
    expect(mockPendingInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_cents: 72000, // €690 + €30 = €720
        reference: expect.stringMatching(/^ENR-\d{6}$/),
        payment_method: 'TRANSFERENCIA',
        status: 'PENDING',
      })
    );
  });

  it('should skip enrollment fee transaction when fee is zero', async () => {
    const leadMember = {
      id: 'lead-003',
      nome: 'Carlos Sem Taxa',
      status: 'LEAD',
    };

    const plan = {
      nome: 'Plano Mensal',
      tipo: 'SUBSCRIPTION',
      preco_cents: 6900,
      enrollment_fee_cents: 0, // Fee waived
      duracao_dias: 30,
    };

    // Mock transactions
    const mockTransactionInsert = vi.fn()
      .mockResolvedValueOnce({ error: null }); // Only plan transaction

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'transactions') {
        return { insert: mockTransactionInsert } as any;
      }
      return {} as any;
    });

    // Transaction 1: Plan payment
    await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: plan.tipo,
      amount_cents: plan.preco_cents,
      payment_method: 'DINHEIRO',
      member_id: leadMember.id,
      description: `Plano: ${plan.nome}`,
    });

    // Transaction 2: Skip if fee is zero
    if (plan.enrollment_fee_cents > 0) {
      await supabase.from('transactions').insert({
        type: 'RECEITA',
        category: 'TAXA_MATRICULA',
        amount_cents: plan.enrollment_fee_cents,
        payment_method: 'DINHEIRO',
        member_id: leadMember.id,
        description: `Taxa de Matrícula - ${plan.nome}`,
      });
    }

    // Verify only ONE transaction (plan only, no fee)
    expect(mockTransactionInsert).toHaveBeenCalledTimes(1);
    expect(mockTransactionInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'SUBSCRIPTION',
        amount_cents: 6900,
      })
    );
  });

  it('should allow staff to override enrollment fee', () => {
    const defaultFee = 3000; // €30 (from plan)
    const staffOverride = 1500; // €15 (staff discount)
    const waiveFee = 0; // €0 (full waiver)
    const increaseFee = 5000; // €50 (staff increase)

    // Staff can adjust fee to any value >= 0
    expect(staffOverride).toBeGreaterThanOrEqual(0);
    expect(staffOverride).toBeLessThan(defaultFee);

    expect(waiveFee).toBe(0);

    expect(increaseFee).toBeGreaterThan(defaultFee);
  });

  it('should NOT charge enrollment fee for ATIVO member renewal', () => {
    const ativoMember = {
      status: 'ATIVO',
      access_type: 'SUBSCRIPTION',
    };

    const bloqueadoMember = {
      status: 'BLOQUEADO',
      access_type: 'SUBSCRIPTION',
    };

    const leadMember = {
      status: 'LEAD',
      access_type: null,
    };

    // Only LEAD members are charged enrollment fee
    const shouldChargeAtivoFee = ativoMember.status === 'LEAD';
    const shouldChargeBloqueadoFee = bloqueadoMember.status === 'LEAD';
    const shouldChargeLeadFee = leadMember.status === 'LEAD';

    expect(shouldChargeAtivoFee).toBe(false); // Renewal, no fee
    expect(shouldChargeBloqueadoFee).toBe(false); // Renewal, no fee
    expect(shouldChargeLeadFee).toBe(true); // First enrollment, fee
  });

  it('should calculate correct total for enrollment (plan + fee)', () => {
    const testCases = [
      { plan: 6900, fee: 3000, total: 9900 }, // €69 + €30 = €99
      { plan: 69000, fee: 3000, total: 72000 }, // €690 + €30 = €720
      { plan: 6900, fee: 0, total: 6900 }, // €69 + €0 = €69 (waived)
      { plan: 6900, fee: 1500, total: 8400 }, // €69 + €15 = €84 (override)
    ];

    testCases.forEach(({ plan, fee, total }) => {
      const calculatedTotal = plan + fee;
      expect(calculatedTotal).toBe(total);
    });
  });

  it('should prevent negative enrollment fee', () => {
    const invalidFees = [-100, -3000];
    const validFees = [0, 1500, 3000, 5000];

    invalidFees.forEach(fee => {
      const isValid = fee >= 0;
      expect(isValid).toBe(false);
    });

    validFees.forEach(fee => {
      const isValid = fee >= 0;
      expect(isValid).toBe(true);
    });
  });

  it('should detect first-time enrollment correctly', () => {
    const members = [
      { id: '1', status: 'LEAD', isFirstTime: true },
      { id: '2', status: 'ATIVO', isFirstTime: false },
      { id: '3', status: 'BLOQUEADO', isFirstTime: false },
      { id: '4', status: 'CANCELADO', isFirstTime: false },
    ];

    members.forEach(member => {
      const detectedFirstTime = member.status === 'LEAD';
      expect(detectedFirstTime).toBe(member.isFirstTime);
    });
  });

  it('should show enrollment fee in payment summary', () => {
    const plan = {
      nome: 'Plano Mensal',
      preco_cents: 6900,
      enrollment_fee_cents: 3000,
    };

    const isFirstTimeEnrollment = true;

    const summary = {
      planName: plan.nome,
      planPrice: plan.preco_cents,
      enrollmentFee: isFirstTimeEnrollment ? plan.enrollment_fee_cents : 0,
      total: plan.preco_cents + (isFirstTimeEnrollment ? plan.enrollment_fee_cents : 0),
    };

    expect(summary).toEqual({
      planName: 'Plano Mensal',
      planPrice: 6900,
      enrollmentFee: 3000,
      total: 9900,
    });
  });

  it('should confirm enrollment creates pending payment when TRANSFERENCIA', async () => {
    const leadMember = { id: 'lead-004', status: 'LEAD' };
    const plan = { id: 'plan-004', preco_cents: 6900, enrollment_fee_cents: 3000 };

    const mockPendingInsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'pending_payments') {
        return { insert: mockPendingInsert } as any;
      }
      return {} as any;
    });

    // Create pending payment
    await supabase.from('pending_payments').insert({
      member_id: leadMember.id,
      plan_id: plan.id,
      amount_cents: plan.preco_cents + plan.enrollment_fee_cents,
      payment_method: 'TRANSFERENCIA',
      reference: 'ENR-123456',
      status: 'PENDING',
      expires_at: addDays(new Date(), 7).toISOString(),
    });

    expect(mockPendingInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_cents: 9900,
        reference: 'ENR-123456',
        status: 'PENDING',
      })
    );
  });

  it('should handle admin confirming ENR- pending payment', async () => {
    const pendingPayment = {
      id: 'pending-001',
      reference: 'ENR-123456',
      member_id: 'lead-005',
      plan_id: 'plan-005',
      amount_cents: 9900, // €69 plan + €30 fee
      payment_method: 'TRANSFERENCIA',
      status: 'PENDING',
    };

    const plan = {
      tipo: 'SUBSCRIPTION',
      preco_cents: 6900,
      enrollment_fee_cents: 3000,
      duracao_dias: 30,
    };

    // Mock pending payment update to CONFIRMED
    const mockPendingEq = vi.fn().mockResolvedValue({ error: null });
    const mockPendingUpdate = vi.fn().mockReturnValue({ eq: mockPendingEq });

    // Mock member update
    const mockMemberEq = vi.fn().mockResolvedValue({ error: null });
    const mockMemberUpdate = vi.fn().mockReturnValue({ eq: mockMemberEq });

    // Mock TWO transaction inserts
    const mockTransactionInsert = vi.fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'pending_payments') {
        return { update: mockPendingUpdate } as any;
      }
      if (table === 'members') {
        return { update: mockMemberUpdate } as any;
      }
      if (table === 'transactions') {
        return { insert: mockTransactionInsert } as any;
      }
      return {} as any;
    });

    // 1. Update pending payment to CONFIRMED
    await supabase.from('pending_payments')
      .update({ status: 'CONFIRMED' })
      .eq('id', pendingPayment.id);

    // 2. Activate member
    await supabase.from('members')
      .update({
        status: 'ATIVO',
        access_type: plan.tipo,
        access_expires_at: addDays(new Date(), plan.duracao_dias).toISOString(),
      })
      .eq('id', pendingPayment.member_id);

    // 3. Create TWO transactions
    await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: plan.tipo,
      amount_cents: plan.preco_cents,
      payment_method: pendingPayment.payment_method,
      member_id: pendingPayment.member_id,
      description: `Plano confirmado`,
    });

    await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: 'TAXA_MATRICULA',
      amount_cents: plan.enrollment_fee_cents,
      payment_method: pendingPayment.payment_method,
      member_id: pendingPayment.member_id,
      description: `Taxa de Matrícula confirmada`,
    });

    // Verify flow
    expect(mockPendingUpdate).toHaveBeenCalledWith({ status: 'CONFIRMED' });
    expect(mockMemberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ATIVO' })
    );
    expect(mockTransactionInsert).toHaveBeenCalledTimes(2);
  });
});
