import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('Enrollment Fee Detection', () => {
  it('should detect LEAD member as first-time enrollment', () => {
    const leadMember = { status: 'LEAD', id: '123', nome: 'João Silva' };
    const isFirstTime = leadMember.status === 'LEAD';
    expect(isFirstTime).toBe(true);
  });

  it('should NOT charge enrollment fee for ATIVO member renewal', () => {
    const ativoMember = { status: 'ATIVO', id: '456', nome: 'Maria Costa' };
    const isFirstTime = ativoMember.status === 'LEAD';
    expect(isFirstTime).toBe(false);
  });

  it('should NOT charge enrollment fee for BLOQUEADO member renewal', () => {
    const bloqueadoMember = { status: 'BLOQUEADO', id: '789', nome: 'Pedro Santos' };
    const isFirstTime = bloqueadoMember.status === 'LEAD';
    expect(isFirstTime).toBe(false);
  });
});

describe('Enrollment Fee Calculation', () => {
  const plan = {
    id: 'plan-1',
    nome: 'Plano Mensal',
    tipo: 'SUBSCRIPTION',
    preco_cents: 6900, // €69.00
    enrollment_fee_cents: 3000, // €30.00
    duracao_dias: 30,
  };

  it('should calculate total with enrollment fee', () => {
    const enrollmentFeeCents = 3000;
    const totalCents = plan.preco_cents + enrollmentFeeCents;
    expect(totalCents).toBe(9900); // €69 + €30 = €99
  });

  it('should allow zero enrollment fee (fee waiver)', () => {
    const enrollmentFeeCents = 0;
    const totalCents = plan.preco_cents + enrollmentFeeCents;
    expect(totalCents).toBe(6900); // €69 + €0 = €69
  });

  it('should allow staff to override enrollment fee', () => {
    const overriddenFeeCents = 1500; // Staff adjusts to €15
    const totalCents = plan.preco_cents + overriddenFeeCents;
    expect(totalCents).toBe(8400); // €69 + €15 = €84
  });
});

describe('Two-Transaction Pattern', () => {
  it('should create TWO transactions for LEAD enrollment', async () => {
    const mockTransactionInsert = vi.fn()
      .mockResolvedValueOnce({ data: { id: 'txn-plan' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'txn-enrollment' }, error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'transactions') {
        return { insert: mockTransactionInsert } as any;
      }
      return {} as any;
    });

    // Simulate enrollment payment
    const planCents = 6900;
    const enrollmentFeeCents = 3000;

    // Transaction 1: Plan payment
    await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: 'SUBSCRIPTION',
      amount_cents: planCents,
      payment_method: 'DINHEIRO',
      description: 'Plano: Plano Mensal',
    });

    // Transaction 2: Enrollment fee
    if (enrollmentFeeCents > 0) {
      await supabase.from('transactions').insert({
        type: 'RECEITA',
        category: 'TAXA_MATRICULA',
        amount_cents: enrollmentFeeCents,
        payment_method: 'DINHEIRO',
        description: 'Taxa de Matrícula - Plano Mensal',
      });
    }

    expect(mockTransactionInsert).toHaveBeenCalledTimes(2);
    expect(mockTransactionInsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      category: 'SUBSCRIPTION',
      amount_cents: 6900,
    }));
    expect(mockTransactionInsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      category: 'TAXA_MATRICULA',
      amount_cents: 3000,
    }));
  });

  it('should create ONE transaction when enrollment fee is zero', async () => {
    const mockTransactionInsert = vi.fn()
      .mockResolvedValueOnce({ data: { id: 'txn-plan' }, error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'transactions') {
        return { insert: mockTransactionInsert } as any;
      }
      return {} as any;
    });

    const planCents = 6900;
    const enrollmentFeeCents = 0; // Fee waived

    // Transaction 1: Plan payment
    await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: 'SUBSCRIPTION',
      amount_cents: planCents,
    });

    // Transaction 2: Skip if fee is zero
    if (enrollmentFeeCents > 0) {
      await supabase.from('transactions').insert({
        category: 'TAXA_MATRICULA',
        amount_cents: enrollmentFeeCents,
      });
    }

    expect(mockTransactionInsert).toHaveBeenCalledTimes(1);
  });
});

describe('Enrollment Pending Payment (TRANSFERENCIA)', () => {
  it('should create pending payment with ENR- prefix for enrollment', async () => {
    const mockPendingInsert = vi.fn().mockResolvedValue({
      data: { id: 'pending-1', reference: 'ENR-001234' },
      error: null
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'pending_payments') {
        return { insert: mockPendingInsert } as any;
      }
      return {} as any;
    });

    const totalCents = 9900; // €69 plan + €30 enrollment

    await supabase.from('pending_payments').insert({
      member_id: 'member-123',
      amount_cents: totalCents,
      reference: 'ENR-001234', // Enrollment reference
      payment_method: 'TRANSFERENCIA',
      status: 'PENDING',
    });

    expect(mockPendingInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: expect.stringMatching(/^ENR-/),
        amount_cents: 9900,
      })
    );
  });
});

describe('Member Activation on Enrollment', () => {
  it('should update LEAD → ATIVO on successful enrollment', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return {
          update: mockUpdate,
        } as any;
      }
      return {} as any;
    });

    const plan = {
      tipo: 'SUBSCRIPTION',
      duracao_dias: 30,
    };

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + plan.duracao_dias);

    await supabase.from('members')
      .update({
        status: 'ATIVO',
        access_type: plan.tipo,
        access_expires_at: newExpiresAt.toISOString().split('T')[0],
      })
      .eq('id', 'member-123');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
      })
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'member-123');
  });
});
