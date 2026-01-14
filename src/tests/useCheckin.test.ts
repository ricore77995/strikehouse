import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCheckin } from '@/hooks/useCheckin';
import { supabase } from '@/integrations/supabase/client';

describe('useCheckin - validateAccess', () => {
  const mockMember = {
    id: '123',
    nome: 'João Silva',
    telefone: '912345678',
    email: 'joao@test.com',
    status: 'ATIVO' as const,
    access_type: 'SUBSCRIPTION' as const,
    access_expires_at: '2026-12-31',
    credits_remaining: null,
    qr_code: 'MBR-TEST1234',
  };

  it('should ALLOW check-in for active member with valid subscription', () => {
    const { result } = renderHook(() => useCheckin());
    const validation = result.current.validateAccess(mockMember);

    expect(validation.success).toBe(true);
    expect(validation.result).toBe('ALLOWED');
    expect(validation.message).toBe('Acesso liberado!');
  });

  it('should BLOCK check-in for BLOQUEADO member', () => {
    const blockedMember = { ...mockMember, status: 'BLOQUEADO' as const };
    const { result } = renderHook(() => useCheckin());
    const validation = result.current.validateAccess(blockedMember);

    expect(validation.success).toBe(false);
    expect(validation.result).toBe('BLOCKED');
    expect(validation.message).toBe('Membro bloqueado. Entre em contato com a recepção.');
  });

  it('should BLOCK check-in for CANCELADO member', () => {
    const cancelledMember = { ...mockMember, status: 'CANCELADO' as const };
    const { result } = renderHook(() => useCheckin());
    const validation = result.current.validateAccess(cancelledMember);

    expect(validation.success).toBe(false);
    expect(validation.result).toBe('BLOCKED');
    expect(validation.message).toBe('Membro cancelado. Entre em contato com a recepção.');
  });

  it('should EXPIRE check-in for LEAD member without plan', () => {
    const leadMember = { ...mockMember, status: 'LEAD' as const, access_type: null };
    const { result } = renderHook(() => useCheckin());
    const validation = result.current.validateAccess(leadMember);

    expect(validation.success).toBe(false);
    expect(validation.result).toBe('EXPIRED');
    expect(validation.message).toBe('Membro sem plano ativo. Favor regularizar situação.');
  });

  it('should EXPIRE check-in for expired subscription', () => {
    const expiredMember = {
      ...mockMember,
      access_expires_at: '2025-01-01', // Past date
    };
    const { result } = renderHook(() => useCheckin());
    const validation = result.current.validateAccess(expiredMember);

    expect(validation.success).toBe(false);
    expect(validation.result).toBe('EXPIRED');
    expect(validation.message).toContain('Acesso expirado em');
    expect(validation.message).toContain('Favor renovar.');
  });

  it('should BLOCK check-in for CREDITS member with 0 credits', () => {
    const noCreditsMember = {
      ...mockMember,
      access_type: 'CREDITS' as const,
      credits_remaining: 0,
    };
    const { result } = renderHook(() => useCheckin());
    const validation = result.current.validateAccess(noCreditsMember);

    expect(validation.success).toBe(false);
    expect(validation.result).toBe('NO_CREDITS');
    expect(validation.message).toBe('Sem créditos disponíveis. Favor adquirir mais créditos.');
  });

  it('should ALLOW check-in for CREDITS member with credits', () => {
    const creditsMember = {
      ...mockMember,
      access_type: 'CREDITS' as const,
      credits_remaining: 5,
    };
    const { result } = renderHook(() => useCheckin());
    const validation = result.current.validateAccess(creditsMember);

    expect(validation.success).toBe(true);
    expect(validation.result).toBe('ALLOWED');
  });

});

describe('useCheckin - findMemberBySearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search members by name', async () => {
    const mockMembers = [
      { id: '1', nome: 'João Silva', telefone: '912345678', qr_code: 'MBR-001' },
      { id: '2', nome: 'João Costa', telefone: '918765432', qr_code: 'MBR-002' },
    ];

    const mockLimit = vi.fn().mockResolvedValue({ data: mockMembers, error: null });
    const mockOr = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ or: mockOr });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    const { result } = renderHook(() => useCheckin());
    const members = await act(async () => {
      return await result.current.findMemberBySearch('João');
    });

    expect(mockOr).toHaveBeenCalledWith('nome.ilike.%João%,telefone.ilike.%João%');
    expect(mockLimit).toHaveBeenCalledWith(10);
    expect(members).toHaveLength(2);
  });

  it('should search members by phone', async () => {
    const mockMembers = [
      { id: '1', nome: 'Maria Santos', telefone: '912345678', qr_code: 'MBR-003' },
    ];

    const mockLimit = vi.fn().mockResolvedValue({ data: mockMembers, error: null });
    const mockOr = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ or: mockOr });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    const { result } = renderHook(() => useCheckin());
    const members = await act(async () => {
      return await result.current.findMemberBySearch('912345');
    });

    expect(members).toHaveLength(1);
    expect(members[0].telefone).toBe('912345678');
  });

  it('should return empty array on search error', async () => {
    const mockLimit = vi.fn().mockResolvedValue({ data: null, error: { message: 'Network error' } });
    const mockOr = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ or: mockOr });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    const { result } = renderHook(() => useCheckin());
    const members = await act(async () => {
      return await result.current.findMemberBySearch('test');
    });

    expect(members).toEqual([]);
  });
});

describe('useCheckin - processQRCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process valid QR code and perform check-in', async () => {
    const mockMember = {
      id: '123',
      nome: 'João Silva',
      telefone: '912345678',
      email: 'joao@test.com',
      status: 'ATIVO',
      access_type: 'SUBSCRIPTION',
      access_expires_at: '2026-12-31',
      credits_remaining: null,
      qr_code: 'MBR-TEST1234',
    };

    // Mock RPC call for get_member_by_qr (returns array)
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [mockMember], error: null });

    // Mock empty rentals (no exclusive area)
    const mockRentalsGte = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockRentalsLte = vi.fn().mockReturnValue({ gte: mockRentalsGte });
    const mockRentalsEq3 = vi.fn().mockReturnValue({ lte: mockRentalsLte });
    const mockRentalsEq2 = vi.fn().mockReturnValue({ eq: mockRentalsEq3 });
    const mockRentalsEq1 = vi.fn().mockReturnValue({ eq: mockRentalsEq2 });
    const mockRentalsSelect = vi.fn().mockReturnValue({ eq: mockRentalsEq1 });

    // Mock check-in insert
    const mockCheckinInsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'rentals') {
        return { select: mockRentalsSelect } as any;
      }
      if (table === 'check_ins') {
        return { insert: mockCheckinInsert } as any;
      }
      return {} as any;
    });

    const { result } = renderHook(() => useCheckin());
    const checkinResult = await act(async () => {
      return await result.current.processQRCode('MBR-TEST1234', 'staff-id');
    });

    expect(checkinResult.success).toBe(true);
    expect(checkinResult.result).toBe('ALLOWED');
    expect(checkinResult.member).toEqual(mockMember);
  });

  it('should return NOT_FOUND for invalid QR code', async () => {
    // Mock RPC call returning empty array (member not found)
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useCheckin());
    const checkinResult = await act(async () => {
      return await result.current.processQRCode('INVALID-QR', 'staff-id');
    });

    expect(checkinResult.success).toBe(false);
    expect(checkinResult.result).toBe('NOT_FOUND');
    expect(checkinResult.message).toContain('QR code não encontrado');
  });
});

describe('useCheckin - performCheckin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register check-in and decrement credits', async () => {
    const mockCheckinInsert = vi.fn().mockResolvedValue({ error: null });
    const mockMemberEq = vi.fn().mockResolvedValue({ error: null });
    const mockMemberUpdate = vi.fn().mockReturnValue({ eq: mockMemberEq });

    // Mock empty rentals query (no exclusive area blocking)
    const mockRentalsGte = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockRentalsLte = vi.fn().mockReturnValue({ gte: mockRentalsGte });
    const mockRentalsEq3 = vi.fn().mockReturnValue({ lte: mockRentalsLte });
    const mockRentalsEq2 = vi.fn().mockReturnValue({ eq: mockRentalsEq3 });
    const mockRentalsEq1 = vi.fn().mockReturnValue({ eq: mockRentalsEq2 });
    const mockRentalsSelect = vi.fn().mockReturnValue({ eq: mockRentalsEq1 });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'check_ins') {
        return { insert: mockCheckinInsert } as any;
      }
      if (table === 'members') {
        return { update: mockMemberUpdate } as any;
      }
      if (table === 'rentals') {
        return { select: mockRentalsSelect } as any;
      }
      return {} as any;
    });

    const creditsMember = {
      id: '123',
      nome: 'João',
      telefone: '912345678',
      email: 'joao@test.com',
      status: 'ATIVO' as const,
      access_type: 'CREDITS' as const,
      credits_remaining: 5,
      access_expires_at: '2026-12-31',
      qr_code: 'MBR-TEST1234',
    };

    const { result } = renderHook(() => useCheckin());
    await act(async () => {
      await result.current.performCheckin(creditsMember, 'staff-id');
    });

    expect(mockCheckinInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        member_id: '123',
        type: 'MEMBER',
        result: 'ALLOWED',
        checked_in_by: 'staff-id',
      })
    );
    expect(mockMemberUpdate).toHaveBeenCalledWith({ credits_remaining: 4 });
    expect(mockMemberEq).toHaveBeenCalledWith('id', '123');
  });

  it('should record check-in in check_ins table', async () => {
    const mockCheckinInsert = vi.fn().mockResolvedValue({ error: null });

    // Mock empty rentals query (no exclusive area blocking)
    const mockRentalsGte = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockRentalsLte = vi.fn().mockReturnValue({ gte: mockRentalsGte });
    const mockRentalsEq3 = vi.fn().mockReturnValue({ lte: mockRentalsLte });
    const mockRentalsEq2 = vi.fn().mockReturnValue({ eq: mockRentalsEq3 });
    const mockRentalsEq1 = vi.fn().mockReturnValue({ eq: mockRentalsEq2 });
    const mockRentalsSelect = vi.fn().mockReturnValue({ eq: mockRentalsEq1 });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'check_ins') {
        return { insert: mockCheckinInsert } as any;
      }
      if (table === 'rentals') {
        return { select: mockRentalsSelect } as any;
      }
      return {} as any;
    });

    const subscriptionMember = {
      id: '456',
      nome: 'Maria',
      telefone: '918765432',
      email: 'maria@test.com',
      status: 'ATIVO' as const,
      access_type: 'SUBSCRIPTION' as const,
      credits_remaining: null,
      access_expires_at: '2026-12-31',
      qr_code: 'MBR-TEST5678',
    };

    const { result } = renderHook(() => useCheckin());
    await act(async () => {
      await result.current.performCheckin(subscriptionMember, 'staff-id');
    });

    expect(mockCheckinInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        member_id: '456',
        type: 'MEMBER',
        result: 'ALLOWED',
        checked_in_by: 'staff-id',
      })
    );
  });

  it('should BLOCK check-in when exclusive area rental is active', async () => {
    // Mock rentals query to return exclusive rental data
    const mockRentalsGte = vi.fn().mockResolvedValue({
      data: [{
        id: 'rental-1',
        start_time: '18:00:00',
        end_time: '19:00:00',
        external_coaches: { nome: 'Coach João' },
        areas: { nome: 'Área Principal', is_exclusive: true },
      }],
      error: null,
    });
    const mockRentalsLte = vi.fn().mockReturnValue({ gte: mockRentalsGte });
    const mockRentalsEq3 = vi.fn().mockReturnValue({ lte: mockRentalsLte });
    const mockRentalsEq2 = vi.fn().mockReturnValue({ eq: mockRentalsEq3 });
    const mockRentalsEq1 = vi.fn().mockReturnValue({ eq: mockRentalsEq2 });
    const mockRentalsSelect = vi.fn().mockReturnValue({ eq: mockRentalsEq1 });

    const mockCheckinInsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'rentals') {
        return {
          select: mockRentalsSelect,
        } as any;
      }
      if (table === 'check_ins') {
        return { insert: mockCheckinInsert } as any;
      }
      return {} as any;
    });

    const member = {
      id: '789',
      nome: 'Carlos',
      telefone: '919999999',
      email: 'carlos@test.com',
      status: 'ATIVO' as const,
      access_type: 'SUBSCRIPTION' as const,
      credits_remaining: null,
      access_expires_at: '2026-12-31',
      qr_code: 'MBR-TEST9999',
    };

    const { result } = renderHook(() => useCheckin());
    const checkinResult = await act(async () => {
      return await result.current.performCheckin(member, 'staff-id');
    });

    expect(checkinResult.success).toBe(false);
    expect(checkinResult.result).toBe('AREA_EXCLUSIVE');
    expect(checkinResult.message).toContain('Área exclusiva ocupada');
    expect(checkinResult.rentalInfo).toBeDefined();
    expect(checkinResult.rentalInfo?.coachName).toBe('Coach João');

    // Should register blocked check-in for auditing
    expect(mockCheckinInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        member_id: '789',
        type: 'MEMBER',
        result: 'BLOCKED',
        checked_in_by: 'staff-id',
      })
    );
  });
});
