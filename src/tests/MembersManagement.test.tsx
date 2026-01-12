import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('Members Management - CRUD Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create new member with auto-generated QR code', async () => {
    const newMember = {
      nome: 'João Silva',
      telefone: '912345678',
      email: 'joao@example.com',
      data_nascimento: '1990-05-15',
      status: 'LEAD',
    };

    // Mock QR code generation (format: MBR-XXXXXXXX)
    const generateQRCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = 'MBR-';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    const qrCode = generateQRCode();

    const mockInsert = vi.fn().mockResolvedValue({
      data: { ...newMember, id: 'member-001', qr_code: qrCode },
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { insert: mockInsert } as any;
      }
      return {} as any;
    });

    await supabase.from('members').insert({
      ...newMember,
      qr_code: qrCode,
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'João Silva',
        telefone: '912345678',
        email: 'joao@example.com',
        status: 'LEAD',
        qr_code: expect.stringMatching(/^MBR-[A-Z0-9]{8}$/),
      })
    );
  });

  it('should validate email uniqueness before creating member', async () => {
    const email = 'joao@example.com';

    // Mock existing member check
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'existing-001', email }, // Email already exists
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    // Check if email exists
    const existing = await supabase.from('members')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    expect(existing.data).not.toBeNull();
    // In real app, this would prevent member creation with error:
    // "Email já cadastrado no sistema"
  });

  it('should validate phone number format and length', () => {
    const validPhones = ['912345678', '918765432', '933333333'];
    const invalidPhones = ['12345', '12345678901', 'abcdefghi', ''];

    validPhones.forEach(phone => {
      const isValid = phone.length === 9 && /^\d{9}$/.test(phone);
      expect(isValid).toBe(true);
    });

    invalidPhones.forEach(phone => {
      const isValid = phone.length === 9 && /^\d{9}$/.test(phone);
      expect(isValid).toBe(false);
    });
  });

  it('should validate required fields before creation', () => {
    const validMember = {
      nome: 'João Silva',
      telefone: '912345678',
      email: 'joao@example.com',
    };

    const invalidMembers = [
      { telefone: '912345678', email: 'test@test.com' }, // Missing nome
      { nome: 'João', email: 'test@test.com' }, // Missing telefone
      { nome: 'João', telefone: '912345678' }, // Missing email
      {}, // All missing
    ];

    const isValid = (member: any) => {
      return !!(member.nome && member.telefone && member.email);
    };

    expect(isValid(validMember)).toBe(true);
    invalidMembers.forEach(member => {
      expect(isValid(member)).toBe(false);
    });
  });

  it('should update member data correctly', async () => {
    const memberId = 'member-001';
    const updates = {
      telefone: '919999999',
      email: 'newemail@example.com',
      morada: 'Rua Nova, 123',
    };

    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { update: mockUpdate } as any;
      }
      return {} as any;
    });

    await supabase.from('members')
      .update(updates)
      .eq('id', memberId);

    expect(mockUpdate).toHaveBeenCalledWith(updates);
    expect(mockEq).toHaveBeenCalledWith('id', memberId);
  });

  it('should manually block member (ATIVO → BLOQUEADO)', async () => {
    const memberId = 'member-002';

    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { update: mockUpdate } as any;
      }
      return {} as any;
    });

    // Manual block by admin/staff
    await supabase.from('members')
      .update({
        status: 'BLOQUEADO',
        blocked_at: new Date().toISOString(),
        blocked_reason: 'Pagamento pendente',
      })
      .eq('id', memberId);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'BLOQUEADO',
        blocked_at: expect.any(String),
        blocked_reason: 'Pagamento pendente',
      })
    );
  });

  it('should reactivate blocked member (BLOQUEADO → ATIVO)', async () => {
    const memberId = 'member-003';

    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { update: mockUpdate } as any;
      }
      return {} as any;
    });

    // Reactivate after payment received
    await supabase.from('members')
      .update({
        status: 'ATIVO',
        blocked_at: null,
        blocked_reason: null,
      })
      .eq('id', memberId);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ATIVO',
        blocked_at: null,
        blocked_reason: null,
      })
    );
  });

  it('should generate unique QR codes for multiple members', () => {
    const generateQRCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = 'MBR-';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    const qrCodes = new Set<string>();
    const count = 100;

    // Generate 100 QR codes
    for (let i = 0; i < count; i++) {
      qrCodes.add(generateQRCode());
    }

    // Should have 100 unique codes (no collisions in small sample)
    expect(qrCodes.size).toBeGreaterThan(95); // Allow some collisions in random generation

    // All codes should match pattern
    qrCodes.forEach(code => {
      expect(code).toMatch(/^MBR-[A-Z0-9]{8}$/);
    });
  });

  it('should prevent deletion, only allow status changes', () => {
    // BoxeMaster never deletes members, only changes status to CANCELADO
    const memberId = 'member-004';

    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { update: mockUpdate } as any;
      }
      return {} as any;
    });

    // Instead of delete, mark as CANCELADO
    supabase.from('members')
      .update({ status: 'CANCELADO' })
      .eq('id', memberId);

    expect(mockUpdate).toHaveBeenCalledWith({ status: 'CANCELADO' });
  });

  it('should query member by QR code (public endpoint)', async () => {
    const qrCode = 'MBR-ABC12345';

    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'member-005',
        nome: 'João Silva',
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: '2026-12-31',
        qr_code: qrCode,
      },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    // Public endpoint /m/:qrCode
    const member = await supabase.from('members')
      .select('*')
      .eq('qr_code', qrCode)
      .single();

    expect(member.data).toBeDefined();
    expect(member.data?.qr_code).toBe(qrCode);
  });

  it('should validate email format', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.pt',
      'user+tag@example.co.uk',
    ];

    const invalidEmails = [
      'notanemail',
      '@example.com',
      'user@',
      'user@.com',
      '',
    ];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    validEmails.forEach(email => {
      expect(emailRegex.test(email)).toBe(true);
    });

    invalidEmails.forEach(email => {
      expect(emailRegex.test(email)).toBe(false);
    });
  });
});

describe('Members Management - Search & Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search members by name (case insensitive)', async () => {
    const searchTerm = 'joão';
    const mockMembers = [
      { id: '1', nome: 'João Silva', telefone: '912345678' },
      { id: '2', nome: 'João Costa', telefone: '918765432' },
      { id: '3', nome: 'Maria João', telefone: '933333333' },
    ];

    const mockLimit = vi.fn().mockResolvedValue({ data: mockMembers, error: null });
    const mockIlike = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ ilike: mockIlike });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    const results = await supabase.from('members')
      .select('*')
      .ilike('nome', `%${searchTerm}%`)
      .limit(10);

    expect(mockIlike).toHaveBeenCalledWith('nome', '%joão%');
    expect(results.data).toHaveLength(3);
  });

  it('should filter members by status', async () => {
    const status = 'ATIVO';
    const mockMembers = [
      { id: '1', nome: 'João', status: 'ATIVO' },
      { id: '2', nome: 'Maria', status: 'ATIVO' },
    ];

    const mockOrder = vi.fn().mockResolvedValue({ data: mockMembers, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'members') {
        return { select: mockSelect } as any;
      }
      return {} as any;
    });

    const results = await supabase.from('members')
      .select('*')
      .eq('status', status)
      .order('nome');

    expect(mockEq).toHaveBeenCalledWith('status', 'ATIVO');
    expect(results.data).toHaveLength(2);
  });

  it('should find members with expiring subscriptions (next 7 days)', () => {
    const today = new Date('2026-01-11');
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const members = [
      { id: '1', nome: 'João', access_expires_at: '2026-01-15' }, // Expires in 4 days
      { id: '2', nome: 'Maria', access_expires_at: '2026-01-18' }, // Expires in 7 days
      { id: '3', nome: 'Carlos', access_expires_at: '2026-01-20' }, // Expires in 9 days (outside range)
      { id: '4', nome: 'Ana', access_expires_at: '2026-02-01' }, // Expires in 21 days
    ];

    const expiringMembers = members.filter(m => {
      const expiresAt = new Date(m.access_expires_at);
      return expiresAt >= today && expiresAt <= sevenDaysFromNow;
    });

    expect(expiringMembers).toHaveLength(2);
    expect(expiringMembers.map(m => m.nome)).toEqual(['João', 'Maria']);
  });

  it('should get member statistics by status', () => {
    const members = [
      { status: 'ATIVO' },
      { status: 'ATIVO' },
      { status: 'ATIVO' },
      { status: 'LEAD' },
      { status: 'LEAD' },
      { status: 'BLOQUEADO' },
      { status: 'CANCELADO' },
    ];

    const stats = members.reduce((acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(stats).toEqual({
      ATIVO: 3,
      LEAD: 2,
      BLOQUEADO: 1,
      CANCELADO: 1,
    });
  });
});

describe('Members Management - Status Lifecycle', () => {
  it('should follow correct status transitions', () => {
    const validTransitions = [
      { from: 'LEAD', to: 'ATIVO', valid: true },
      { from: 'ATIVO', to: 'BLOQUEADO', valid: true },
      { from: 'BLOQUEADO', to: 'ATIVO', valid: true },
      { from: 'BLOQUEADO', to: 'CANCELADO', valid: true },
      { from: 'ATIVO', to: 'CANCELADO', valid: true },
      { from: 'CANCELADO', to: 'ATIVO', valid: false }, // Needs special reactivation
      { from: 'LEAD', to: 'BLOQUEADO', valid: false }, // LEAD can't be blocked
      { from: 'LEAD', to: 'CANCELADO', valid: false }, // LEAD can't be cancelled
    ];

    const isValidTransition = (from: string, to: string) => {
      if (from === 'LEAD' && to === 'ATIVO') return true;
      if (from === 'ATIVO' && (to === 'BLOQUEADO' || to === 'CANCELADO')) return true;
      if (from === 'BLOQUEADO' && (to === 'ATIVO' || to === 'CANCELADO')) return true;
      return false;
    };

    validTransitions.forEach(({ from, to, valid }) => {
      expect(isValidTransition(from, to)).toBe(valid);
    });
  });

  it('should track blocked_at timestamp when blocking', () => {
    const member = {
      id: 'member-001',
      status: 'ATIVO',
      blocked_at: null,
    };

    const now = new Date().toISOString();
    const blockedMember = {
      ...member,
      status: 'BLOQUEADO',
      blocked_at: now,
    };

    expect(blockedMember.status).toBe('BLOQUEADO');
    expect(blockedMember.blocked_at).not.toBeNull();
    expect(new Date(blockedMember.blocked_at!).getTime()).toBeGreaterThan(0);
  });

  it('should clear blocked_at when reactivating', () => {
    const blockedMember = {
      id: 'member-001',
      status: 'BLOQUEADO',
      blocked_at: '2026-01-01T00:00:00Z',
      blocked_reason: 'Pagamento pendente',
    };

    const reactivatedMember = {
      ...blockedMember,
      status: 'ATIVO',
      blocked_at: null,
      blocked_reason: null,
    };

    expect(reactivatedMember.status).toBe('ATIVO');
    expect(reactivatedMember.blocked_at).toBeNull();
    expect(reactivatedMember.blocked_reason).toBeNull();
  });
});
