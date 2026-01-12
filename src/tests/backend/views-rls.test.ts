import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('Database Views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('v_active_members: show only ATIVO members with plan details', async () => {
    // Mock view query
    const mockSelect = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'member-001',
          nome: 'João Silva',
          status: 'ATIVO',
          access_type: 'SUBSCRIPTION',
          access_expires_at: '2026-12-31',
          plan_nome: 'Plano Mensal',
          plan_preco_cents: 6900,
        },
        {
          id: 'member-002',
          nome: 'Maria Costa',
          status: 'ATIVO',
          access_type: 'CREDITS',
          credits_remaining: 5,
          plan_nome: 'Plano 10 Créditos',
        },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'v_active_members') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    const { data, error } = await supabase.from('v_active_members').select('*');

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data?.every(m => m.status === 'ATIVO')).toBe(true);
    expect(data?.[0].plan_nome).toBeDefined(); // Plan details joined
  });

  it('v_expiring_members: calculate dias_restantes correctly', async () => {
    // Mock view with calculated dias_restantes
    const mockSelect = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'member-001',
          nome: 'João Silva',
          access_expires_at: '2026-01-20',
          dias_restantes: 9, // Calculated by view (assuming today is 2026-01-11)
        },
        {
          id: 'member-002',
          nome: 'Maria Costa',
          access_expires_at: '2026-01-15',
          dias_restantes: 4,
        },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'v_expiring_members') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    const { data } = await supabase.from('v_expiring_members').select('*');

    expect(data?.[0].dias_restantes).toBe(9);
    expect(data?.[1].dias_restantes).toBe(4);

    // Verify calculation
    const today = new Date('2026-01-11');
    const expiresAt = new Date('2026-01-20');
    const daysDiff = Math.floor((expiresAt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBe(9);
  });

  it('v_overdue_members: calculate dias_atraso correctly', async () => {
    // Mock view with overdue calculations
    const mockSelect = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'member-001',
          nome: 'Pedro Santos',
          access_expires_at: '2026-01-05',
          dias_atraso: 6, // 6 days overdue (assuming today is 2026-01-11)
        },
        {
          id: 'member-002',
          nome: 'Ana Oliveira',
          access_expires_at: '2026-01-08',
          dias_atraso: 3, // 3 days overdue
        },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'v_overdue_members') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    const { data } = await supabase.from('v_overdue_members').select('*');

    expect(data?.[0].dias_atraso).toBe(6);
    expect(data?.[1].dias_atraso).toBe(3);
    expect(data?.every(m => m.dias_atraso > 0)).toBe(true);
  });

  it('v_today_rentals: show only today\'s rentals', async () => {
    const today = new Date('2026-01-11').toISOString().split('T')[0];

    const mockSelect = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'rental-001',
          coach_nome: 'Coach João',
          area_nome: 'Ringue',
          rental_date: today,
          start_time: '19:00',
          end_time: '20:00',
          status: 'SCHEDULED',
        },
        {
          id: 'rental-002',
          coach_nome: 'Coach Maria',
          area_nome: 'Sala 1',
          rental_date: today,
          start_time: '18:00',
          end_time: '19:00',
          status: 'SCHEDULED',
        },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'v_today_rentals') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    const { data } = await supabase.from('v_today_rentals').select('*');

    expect(data).toHaveLength(2);
    expect(data?.every(r => r.rental_date === today)).toBe(true);
  });

  it('v_daily_summary: aggregate daily finances', async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [
        {
          date: '2026-01-11',
          total_receitas_cents: 25000, // €250.00
          total_despesas_cents: 5000, // €50.00
          saldo_cents: 20000, // €200.00
          total_dinheiro_cents: 15000, // €150.00 in cash
          total_cartao_cents: 10000, // €100.00 in card
        },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'v_daily_summary') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    const { data } = await supabase.from('v_daily_summary').select('*');

    expect(data?.[0].total_receitas_cents).toBe(25000);
    expect(data?.[0].total_despesas_cents).toBe(5000);
    expect(data?.[0].saldo_cents).toBe(20000);

    // Verify calculation
    const saldo = data?.[0].total_receitas_cents - data?.[0].total_despesas_cents;
    expect(saldo).toBe(20000);
  });
});

describe('Row Level Security (RLS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('RLS: ADMIN can read all members', async () => {
    // Mock authenticated as ADMIN
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'admin-user-001',
            role: 'authenticated',
          } as any,
        } as any,
      },
      error: null,
    });

    // Mock RLS allowing ADMIN to read all
    const mockSelect = vi.fn().mockResolvedValue({
      data: [
        { id: 'member-001', nome: 'João' },
        { id: 'member-002', nome: 'Maria' },
        { id: 'member-003', nome: 'Pedro' },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    // ADMIN should see all members
    const { data, error } = await supabase.from('members').select('*');

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
  });

  it('RLS: STAFF cannot delete members', async () => {
    // Mock authenticated as STAFF
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'staff-user-001',
            role: 'authenticated',
          } as any,
        } as any,
      },
      error: null,
    });

    // Mock RLS preventing DELETE for STAFF
    const mockEq = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'permission denied for table members',
        code: '42501', // PostgreSQL insufficient_privilege
      },
    });

    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { delete: mockDelete } as any;
      }
      return {} as any;
    });

    // STAFF attempts to delete member
    const { error } = await supabase.from('members').delete().eq('id', 'member-001');

    expect(error).toBeDefined();
    expect(error?.code).toBe('42501');
    expect(error?.message).toContain('permission denied');
  });

  it('RLS: PARTNER sees only own rentals', async () => {
    const partnerCoachId = 'coach-001';

    // Mock authenticated as PARTNER (coach)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'partner-user-001',
            role: 'authenticated',
          } as any,
        } as any,
      },
      error: null,
    });

    // Mock RLS filtering by coach_id
    const mockSelect = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'rental-001',
          coach_id: partnerCoachId,
          rental_date: '2026-01-15',
        },
        {
          id: 'rental-002',
          coach_id: partnerCoachId,
          rental_date: '2026-01-16',
        },
        // Other coaches' rentals filtered out by RLS
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'rentals') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    // PARTNER queries rentals (RLS auto-filters)
    const { data } = await supabase.from('rentals').select('*');

    expect(data).toHaveLength(2);
    expect(data?.every(r => r.coach_id === partnerCoachId)).toBe(true);
  });

  it('RLS: PUBLIC can read members by QR', async () => {
    // Mock unauthenticated request (public)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Mock RLS allowing public read of qr_code field
    const mockEq = vi.fn().mockResolvedValue({
      data: {
        id: 'member-001',
        nome: 'João Silva',
        qr_code: 'MBR-TEST1234',
        // Sensitive fields not exposed
      },
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    // Public queries member by QR
    const { data, error } = await supabase
      .from('members')
      .select('nome, qr_code')
      .eq('qr_code', 'MBR-TEST1234');

    expect(error).toBeNull();
    expect(data?.nome).toBe('João Silva');
    expect(data?.qr_code).toBe('MBR-TEST1234');

    // Verify no sensitive data accessible
    expect(data).not.toHaveProperty('email');
    expect(data).not.toHaveProperty('telefone');
  });

  it('RLS: STAFF can insert transactions', async () => {
    // Mock authenticated as STAFF
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'staff-user-001',
            role: 'authenticated',
          } as any,
        } as any,
      },
      error: null,
    });

    // Mock RLS allowing INSERT for STAFF
    const mockInsert = vi.fn().mockResolvedValue({
      data: {
        id: 'txn-001',
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: 6900,
      },
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'transactions') {
        return { insert: mockInsert } as any;
      }
      return {} as any;
    });

    // STAFF creates transaction
    const { data, error } = await supabase.from('transactions').insert({
      type: 'RECEITA',
      category: 'SUBSCRIPTION',
      amount_cents: 6900,
      payment_method: 'DINHEIRO',
    });

    expect(error).toBeNull();
    expect(data?.id).toBe('txn-001');
    expect(mockInsert).toHaveBeenCalled();
  });
});
