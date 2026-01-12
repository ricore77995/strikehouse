import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { addDays, differenceInDays } from 'date-fns';

describe('Coach Credits - Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create coach with initial credits', async () => {
    const newCoach = {
      nome: 'Coach João',
      telefone: '912345678',
      email: 'coach@example.com',
      credits_remaining: 10,
      credits_expire_at: addDays(new Date(), 90).toISOString(),
    };

    const mockInsert = vi.fn().mockResolvedValue({
      data: { ...newCoach, id: 'coach-001' },
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'external_coaches') {
        return { insert: mockInsert } as any;
      }
      return {} as any;
    });

    await supabase.from('external_coaches').insert(newCoach);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Coach João',
        credits_remaining: 10,
        credits_expire_at: expect.any(String),
      })
    );
  });

  it('should add credits to existing coach', async () => {
    const coachId = 'coach-001';
    const currentCredits = 5;
    const creditsToAdd = 10;
    const newTotal = currentCredits + creditsToAdd;

    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'external_coaches') {
        return { update: mockUpdate } as any;
      }
      return {} as any;
    });

    await supabase
      .from('external_coaches')
      .update({
        credits_remaining: newTotal,
        credits_expire_at: addDays(new Date(), 90).toISOString(),
      })
      .eq('id', coachId);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        credits_remaining: 15,
        credits_expire_at: expect.any(String),
      })
    );
  });

  it('should set credits expiration to 90 days from now', () => {
    const today = new Date('2026-01-11');
    const expiresAt = addDays(today, 90);
    const daysDiff = differenceInDays(expiresAt, today);

    expect(daysDiff).toBe(90);
    // 90 days from Jan 11 = Apr 10 (date-fns calculation)
    expect(expiresAt.toISOString().split('T')[0]).toBe('2026-04-10');
  });

  it('should validate coach has credits before rental', () => {
    const coachWithCredits = {
      id: 'coach-001',
      nome: 'Coach João',
      credits_remaining: 5,
      credits_expire_at: '2026-12-31',
    };

    const coachNoCredits = {
      id: 'coach-002',
      nome: 'Coach Maria',
      credits_remaining: 0,
      credits_expire_at: '2026-12-31',
    };

    const hasCredits = (coach: typeof coachWithCredits) => {
      return coach.credits_remaining > 0;
    };

    expect(hasCredits(coachWithCredits)).toBe(true);
    expect(hasCredits(coachNoCredits)).toBe(false);
  });

  it('should validate credits are not expired', () => {
    const today = new Date('2026-01-11');

    const validCoach = {
      credits_remaining: 5,
      credits_expire_at: '2026-12-31', // Future date
    };

    const expiredCoach = {
      credits_remaining: 5,
      credits_expire_at: '2025-12-31', // Past date
    };

    const isExpired = (coach: typeof validCoach) => {
      const expiresAt = new Date(coach.credits_expire_at);
      return expiresAt < today;
    };

    expect(isExpired(validCoach)).toBe(false);
    expect(isExpired(expiredCoach)).toBe(true);
  });

  it('should block rental if coach has no credits', () => {
    const coach = {
      id: 'coach-001',
      credits_remaining: 0,
      credits_expire_at: '2026-12-31',
    };

    const canRent = coach.credits_remaining > 0;

    expect(canRent).toBe(false);
    // In real app, show error: "Sem créditos disponíveis. Favor adquirir mais créditos."
  });

  it('should block rental if credits are expired', () => {
    const today = new Date('2026-01-11');
    const coach = {
      id: 'coach-001',
      credits_remaining: 5,
      credits_expire_at: '2025-12-31', // Expired
    };

    const expiresAt = new Date(coach.credits_expire_at);
    const isExpired = expiresAt < today;
    const canRent = coach.credits_remaining > 0 && !isExpired;

    expect(canRent).toBe(false);
    // In real app, show error: "Créditos expirados. Favor renovar."
  });
});

describe('Coach Credits - Rental Deduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should deduct 1 credit on rental creation', async () => {
    const coach = {
      id: 'coach-001',
      credits_remaining: 10,
    };

    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'external_coaches') {
        return { update: mockUpdate } as any;
      }
      return {} as any;
    });

    // Deduct 1 credit
    await supabase
      .from('external_coaches')
      .update({ credits_remaining: coach.credits_remaining - 1 })
      .eq('id', coach.id);

    expect(mockUpdate).toHaveBeenCalledWith({ credits_remaining: 9 });
  });

  it('should refund 1 credit on rental cancellation >24h', async () => {
    const coach = {
      id: 'coach-001',
      credits_remaining: 9,
    };

    const rental = {
      id: 'rental-001',
      rental_date: '2026-01-15',
      start_time: '18:00',
      coach_id: coach.id,
    };

    const now = new Date('2026-01-13T10:00:00'); // 57 hours before
    const rentalDateTime = new Date(`${rental.rental_date}T${rental.start_time}:00`);
    const hoursUntil = Math.floor((rentalDateTime.getTime() - now.getTime()) / (1000 * 60 * 60));

    const shouldRefund = hoursUntil >= 24;

    expect(shouldRefund).toBe(true);
    expect(hoursUntil).toBeGreaterThan(24);

    // If refund, add 1 credit back
    if (shouldRefund) {
      const newCredits = coach.credits_remaining + 1;
      expect(newCredits).toBe(10);
    }
  });

  it('should NOT refund credit on rental cancellation <24h', async () => {
    const coach = {
      id: 'coach-001',
      credits_remaining: 9,
    };

    const rental = {
      rental_date: '2026-01-15',
      start_time: '18:00',
    };

    const now = new Date('2026-01-15T10:00:00'); // 8 hours before
    const rentalDateTime = new Date(`${rental.rental_date}T${rental.start_time}:00`);
    const hoursUntil = Math.floor((rentalDateTime.getTime() - now.getTime()) / (1000 * 60 * 60));

    const shouldRefund = hoursUntil >= 24;

    expect(shouldRefund).toBe(false);
    expect(hoursUntil).toBeLessThan(24);
    expect(coach.credits_remaining).toBe(9); // No refund
  });

  it('should track credits usage in rentals table', async () => {
    const mockInsert = vi.fn().mockResolvedValue({
      data: {
        id: 'rental-001',
        coach_id: 'coach-001',
        credit_used: true,
      },
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'rentals') {
        return { insert: mockInsert } as any;
      }
      return {} as any;
    });

    await supabase.from('rentals').insert({
      coach_id: 'coach-001',
      rental_date: '2026-01-15',
      start_time: '18:00',
      end_time: '19:00',
      area_id: 'area-001',
      credit_used: true, // Track credit usage
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        credit_used: true,
      })
    );
  });
});

describe('Coach Credits - Reporting', () => {
  it('should calculate total credits purchased by coach', () => {
    const purchases = [
      { coach_id: 'coach-001', credits: 10, amount_cents: 10000 },
      { coach_id: 'coach-001', credits: 10, amount_cents: 10000 },
      { coach_id: 'coach-001', credits: 5, amount_cents: 5000 },
    ];

    const totalCredits = purchases.reduce((sum, p) => sum + p.credits, 0);
    const totalSpent = purchases.reduce((sum, p) => sum + p.amount_cents, 0);

    expect(totalCredits).toBe(25); // Total credits purchased
    expect(totalSpent).toBe(25000); // €250.00 total spent
  });

  it('should calculate credits usage rate', () => {
    const coach = {
      total_credits_purchased: 30,
      credits_remaining: 5,
    };

    const creditsUsed = coach.total_credits_purchased - coach.credits_remaining;
    const usageRate = (creditsUsed / coach.total_credits_purchased) * 100;

    expect(creditsUsed).toBe(25);
    expect(usageRate).toBeCloseTo(83.33, 1); // 83.33% usage rate
  });

  it('should warn when credits are expiring soon (within 7 days)', () => {
    const today = new Date('2026-01-11');

    const coaches = [
      { id: '1', nome: 'Coach A', credits_expire_at: '2026-01-15' }, // Expires in 4 days
      { id: '2', nome: 'Coach B', credits_expire_at: '2026-01-18' }, // Expires in 7 days
      { id: '3', nome: 'Coach C', credits_expire_at: '2026-01-20' }, // Expires in 9 days
    ];

    const sevenDaysFromNow = addDays(today, 7);

    const expiringSoon = coaches.filter((coach) => {
      const expiresAt = new Date(coach.credits_expire_at);
      return expiresAt >= today && expiresAt <= sevenDaysFromNow;
    });

    expect(expiringSoon).toHaveLength(2);
    expect(expiringSoon.map((c) => c.nome)).toEqual(['Coach A', 'Coach B']);
  });

  it('should calculate average credits per rental', () => {
    const rentals = [
      { coach_id: 'coach-001', credit_used: true },
      { coach_id: 'coach-001', credit_used: true },
      { coach_id: 'coach-001', credit_used: false }, // Paid rental
      { coach_id: 'coach-001', credit_used: true },
    ];

    const totalRentals = rentals.length;
    const creditRentals = rentals.filter((r) => r.credit_used).length;
    const paidRentals = totalRentals - creditRentals;

    expect(creditRentals).toBe(3);
    expect(paidRentals).toBe(1);
    expect(creditRentals / totalRentals).toBeCloseTo(0.75, 2); // 75% of rentals use credits
  });
});

describe('Coach Credits - Edge Cases', () => {
  it('should handle coach with exactly 1 credit remaining', () => {
    const coach = {
      credits_remaining: 1,
      credits_expire_at: '2026-12-31',
    };

    const canRent = coach.credits_remaining > 0;
    expect(canRent).toBe(true);

    // After rental, should have 0 credits
    const afterRental = coach.credits_remaining - 1;
    expect(afterRental).toBe(0);
  });

  it('should handle credits expiring today', () => {
    const today = new Date('2026-01-11');
    const coach = {
      credits_remaining: 5,
      credits_expire_at: '2026-01-11', // Expires today
    };

    const expiresAt = new Date(coach.credits_expire_at);
    const isExpired = expiresAt < today;
    const expiresEndOfDay = expiresAt.toISOString().split('T')[0] === today.toISOString().split('T')[0];

    // If expires today, consider it still valid until end of day
    const canUse = !isExpired || expiresEndOfDay;

    expect(expiresEndOfDay).toBe(true);
    expect(canUse).toBe(true);
  });

  it('should prevent negative credits', () => {
    const coach = {
      credits_remaining: 0,
    };

    const attemptRental = () => {
      if (coach.credits_remaining <= 0) {
        throw new Error('Sem créditos disponíveis');
      }
      coach.credits_remaining -= 1;
    };

    expect(attemptRental).toThrow('Sem créditos disponíveis');
    expect(coach.credits_remaining).toBe(0); // Should not go negative
  });

  it('should handle null credits_expire_at (no expiration)', () => {
    const coach = {
      credits_remaining: 5,
      credits_expire_at: null,
    };

    const hasExpiration = coach.credits_expire_at !== null;
    const isExpired = hasExpiration && new Date(coach.credits_expire_at!) < new Date();

    expect(hasExpiration).toBe(false);
    expect(isExpired).toBe(false); // No expiration = never expired
  });
});
