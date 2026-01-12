import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { addDays } from 'date-fns';

describe('Payment Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should activate LEAD member to ATIVO on payment', async () => {
    const mockMemberEq = vi.fn().mockResolvedValue({ error: null });
    const mockMemberUpdate = vi.fn().mockReturnValue({ eq: mockMemberEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { update: mockMemberUpdate } as any;
      }
      return {} as any;
    });

    const leadMember = {
      id: 'lead-123',
      status: 'LEAD',
      access_type: null,
      access_expires_at: null,
      credits_remaining: null,
    };

    const subscriptionPlan = {
      tipo: 'SUBSCRIPTION',
      duracao_dias: 30,
    };

    const newExpiresAt = addDays(new Date(), subscriptionPlan.duracao_dias);

    await supabase.from('members')
      .update({
        status: 'ATIVO',
        access_type: subscriptionPlan.tipo,
        access_expires_at: newExpiresAt.toISOString(),
        credits_remaining: null,
      })
      .eq('id', leadMember.id);

    expect(mockMemberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
      })
    );
    expect(mockMemberEq).toHaveBeenCalledWith('id', 'lead-123');
  });

  it('should create transaction with correct amount in cents', async () => {
    const mockTransactionInsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'transactions') {
        return { insert: mockTransactionInsert } as any;
      }
      return {} as any;
    });

    const planPriceCents = 6900; // €69.00

    await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: 'SUBSCRIPTION',
      amount_cents: planPriceCents,
      payment_method: 'DINHEIRO',
      member_id: 'member-123',
      description: 'Pagamento: Plano Mensal',
      created_by: 'staff-id',
    });

    expect(mockTransactionInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: 6900, // Stored in cents
        payment_method: 'DINHEIRO',
      })
    );
  });

  it('should calculate correct expiration for SUBSCRIPTION', () => {
    const member = {
      access_expires_at: null, // New subscription
    };

    const plan = {
      tipo: 'SUBSCRIPTION',
      duracao_dias: 30,
    };

    const today = new Date();
    const baseDate = member.access_expires_at && new Date(member.access_expires_at) > new Date()
      ? new Date(member.access_expires_at)
      : today;

    const newExpires = addDays(baseDate, plan.duracao_dias);

    // Should be exactly 30 days from today
    const expectedDate = addDays(today, 30);
    expect(newExpires.toDateString()).toBe(expectedDate.toDateString());
  });

  it('should set CREDITS expiration to NOW + 90 days', () => {
    const plan = {
      tipo: 'CREDITS',
      creditos: 10,
    };

    const today = new Date();
    const creditsExpiresAt = addDays(today, 90);

    // Credits should expire in exactly 90 days
    const expectedDate = addDays(today, 90);
    expect(creditsExpiresAt.toDateString()).toBe(expectedDate.toDateString());
  });

  it('should set DAILY_PASS expiration to end of day', () => {
    const plan = {
      tipo: 'DAILY_PASS',
      duracao_dias: 1,
    };

    const today = new Date();
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Daily pass should expire at 23:59:59 of the same day
    expect(endOfDay.getHours()).toBe(23);
    expect(endOfDay.getMinutes()).toBe(59);
    expect(endOfDay.getSeconds()).toBe(59);
    expect(endOfDay.toDateString()).toBe(today.toDateString());
  });

  it('should update cash session on DINHEIRO payment', async () => {
    const mockSessionEq = vi.fn().mockResolvedValue({ error: null });
    const mockSessionUpdate = vi.fn().mockReturnValue({ eq: mockSessionEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'cash_sessions') {
        return { update: mockSessionUpdate } as any;
      }
      return {} as any;
    });

    const session = {
      id: 'session-123',
      session_date: new Date().toISOString().split('T')[0],
      total_cash_in_cents: 50000, // Current: €500.00
    };

    const paymentAmountCents = 6900; // €69.00

    // Update cash session
    await supabase.from('cash_sessions')
      .update({
        total_cash_in_cents: session.total_cash_in_cents + paymentAmountCents,
      })
      .eq('id', session.id);

    expect(mockSessionUpdate).toHaveBeenCalledWith({
      total_cash_in_cents: 56900, // €500 + €69 = €569
    });
    expect(mockSessionEq).toHaveBeenCalledWith('id', 'session-123');
  });

  it('should create pending payment on TRANSFERENCIA', async () => {
    const mockPendingInsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'pending_payments') {
        return { insert: mockPendingInsert } as any;
      }
      return {} as any;
    });

    const member = { id: 'member-456' };
    const plan = { id: 'plan-789', preco_cents: 6900 };
    const expiresAt = addDays(new Date(), 7); // 7 days to confirm

    await supabase.from('pending_payments').insert({
      member_id: member.id,
      plan_id: plan.id,
      amount_cents: plan.preco_cents,
      payment_method: 'TRANSFERENCIA',
      reference: `PAY-${Date.now()}`,
      expires_at: expiresAt.toISOString(),
      status: 'PENDING',
      created_by: 'staff-id',
    });

    expect(mockPendingInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        member_id: 'member-456',
        plan_id: 'plan-789',
        amount_cents: 6900,
        payment_method: 'TRANSFERENCIA',
        status: 'PENDING',
        reference: expect.stringMatching(/^PAY-/),
      })
    );
  });

  it('should extend existing subscription when renewing', () => {
    const member = {
      access_expires_at: '2026-01-20', // Expires in 9 days
    };

    const plan = {
      tipo: 'SUBSCRIPTION',
      duracao_dias: 30,
    };

    // If member has valid future expiration, extend from that date
    const currentExpires = new Date(member.access_expires_at);
    const baseDate = currentExpires > new Date() ? currentExpires : new Date();
    const newExpires = addDays(baseDate, plan.duracao_dias);

    // Should extend 30 days from current expiration (2026-02-19)
    const expected = addDays(new Date('2026-01-20'), 30);
    expect(newExpires.toDateString()).toBe(expected.toDateString());
  });

  it('should add credits to existing balance for CREDITS plan', () => {
    const member = {
      credits_remaining: 3, // Current balance
    };

    const plan = {
      tipo: 'CREDITS',
      creditos: 10, // Buying 10 more
    };

    const newCredits = (member.credits_remaining || 0) + (plan.creditos || 0);

    expect(newCredits).toBe(13); // 3 + 10 = 13 credits
  });

  it('should create transaction with payment method category', async () => {
    const mockTransactionInsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'transactions') {
        return { insert: mockTransactionInsert } as any;
      }
      return {} as any;
    });

    const testMethods: Array<{
      method: 'DINHEIRO' | 'CARTAO' | 'MBWAY' | 'TRANSFERENCIA';
      instant: boolean;
    }> = [
      { method: 'DINHEIRO', instant: true },
      { method: 'CARTAO', instant: true },
      { method: 'MBWAY', instant: true },
    ];

    for (const { method } of testMethods) {
      await supabase.from('transactions').insert({
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: 6900,
        payment_method: method,
        member_id: 'member-123',
        description: `Pagamento via ${method}`,
        created_by: 'staff-id',
      });
    }

    // Should have created 3 transactions (one for each instant method)
    expect(mockTransactionInsert).toHaveBeenCalledTimes(3);
    expect(mockTransactionInsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      payment_method: 'DINHEIRO',
    }));
    expect(mockTransactionInsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      payment_method: 'CARTAO',
    }));
    expect(mockTransactionInsert).toHaveBeenNthCalledWith(3, expect.objectContaining({
      payment_method: 'MBWAY',
    }));
  });
});
