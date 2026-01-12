import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { format, addDays } from 'date-fns';
import {
  createServiceClient,
  createTestCoach,
  createTestArea,
  createTestRental,
} from '../fixtures/factory';
import { createdIds, cleanupTrackedEntities } from '../fixtures/setup';

/**
 * Coach Rental Flow Integration Tests
 *
 * Tests REAL database operations against Supabase local.
 * NO MOCKS - all operations hit the actual database.
 */
describe('Coach Rental CRUD (Real Supabase)', () => {
  const client = createServiceClient();
  let coachId: string;
  let areaId: string;
  let exclusiveAreaId: string;

  beforeAll(async () => {
    // Create test coach
    const coach = await createTestCoach(client, {
      nome: 'Test Rental Coach',
      fee_type: 'FIXED',
      fee_value: 3000, // €30
    });
    coachId = coach.id;
    createdIds.coaches.push(coachId);

    // Create normal area
    const area = await createTestArea(client, {
      nome: 'Test Ringue',
      is_exclusive: false,
    });
    areaId = area.id;
    createdIds.areas.push(areaId);

    // Create exclusive area
    const exclusiveArea = await createTestArea(client, {
      nome: 'Test VIP Room',
      is_exclusive: true,
    });
    exclusiveAreaId = exclusiveArea.id;
    createdIds.areas.push(exclusiveAreaId);
  });

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  describe('Rental Creation', () => {
    it('creates rental with correct data', async () => {
      const rentalDate = format(addDays(new Date(), 5), 'yyyy-MM-dd');

      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '19:00',
        end_time: '20:00',
        fee_charged_cents: 3000,
      });

      createdIds.rentals.push(rental.id);

      expect(rental.coach_id).toBe(coachId);
      expect(rental.area_id).toBe(areaId);
      expect(rental.rental_date).toBe(rentalDate);
      expect(rental.start_time).toBe('19:00:00');
      expect(rental.end_time).toBe('20:00:00');
      expect(rental.status).toBe('SCHEDULED');
    });

    it('allows sequential rentals (no overlap)', async () => {
      const rentalDate = format(addDays(new Date(), 6), 'yyyy-MM-dd');

      // First rental: 10:00-11:00
      const rental1 = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '10:00',
        end_time: '11:00',
      });
      createdIds.rentals.push(rental1.id);

      // Second rental: 11:00-12:00 (starts when first ends)
      const rental2 = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '11:00',
        end_time: '12:00',
      });
      createdIds.rentals.push(rental2.id);

      expect(rental1.id).toBeDefined();
      expect(rental2.id).toBeDefined();
    });

    it('allows same time slot in different areas', async () => {
      const rentalDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');

      // Rental in normal area
      const rental1 = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '14:00',
        end_time: '15:00',
      });
      createdIds.rentals.push(rental1.id);

      // Same time in exclusive area
      const rental2 = await createTestRental(client, {
        coach_id: coachId,
        area_id: exclusiveAreaId,
        rental_date: rentalDate,
        start_time: '14:00',
        end_time: '15:00',
      });
      createdIds.rentals.push(rental2.id);

      expect(rental1.area_id).toBe(areaId);
      expect(rental2.area_id).toBe(exclusiveAreaId);
    });
  });

  describe('Rental Status Updates', () => {
    it('cancels rental and sets cancelled_at', async () => {
      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: format(addDays(new Date(), 10), 'yyyy-MM-dd'),
        start_time: '18:00',
        end_time: '19:00',
      });
      createdIds.rentals.push(rental.id);

      const cancelledAt = new Date().toISOString();
      const { data: updated, error } = await client
        .from('rentals')
        .update({
          status: 'CANCELLED',
          cancelled_at: cancelledAt,
        })
        .eq('id', rental.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updated.status).toBe('CANCELLED');
      expect(updated.cancelled_at).toBeDefined();
    });

    it('completes rental', async () => {
      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '08:00',
        end_time: '09:00',
      });
      createdIds.rentals.push(rental.id);

      const { data: updated, error } = await client
        .from('rentals')
        .update({ status: 'COMPLETED' })
        .eq('id', rental.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updated.status).toBe('COMPLETED');
    });
  });

  describe('Recurring Rentals (series_id)', () => {
    it('creates series with same series_id', async () => {
      const seriesId = crypto.randomUUID();
      const baseDate = addDays(new Date(), 20);

      const rentalsToCreate = [];
      for (let i = 0; i < 4; i++) {
        rentalsToCreate.push({
          coach_id: coachId,
          area_id: areaId,
          rental_date: format(addDays(baseDate, i * 7), 'yyyy-MM-dd'),
          start_time: '19:00',
          end_time: '20:00',
          series_id: seriesId,
          is_recurring: true,
          status: 'SCHEDULED' as const,
        });
      }

      const { data, error } = await client
        .from('rentals')
        .insert(rentalsToCreate)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(4);
      data!.forEach((r) => {
        createdIds.rentals.push(r.id);
        expect(r.series_id).toBe(seriesId);
        expect(r.is_recurring).toBe(true);
      });
    });

    it('cancels entire series', async () => {
      const seriesId = crypto.randomUUID();
      const baseDate = addDays(new Date(), 50);

      // Create series
      const rentalsToCreate = [];
      for (let i = 0; i < 3; i++) {
        rentalsToCreate.push({
          coach_id: coachId,
          area_id: areaId,
          rental_date: format(addDays(baseDate, i * 7), 'yyyy-MM-dd'),
          start_time: '17:00',
          end_time: '18:00',
          series_id: seriesId,
          is_recurring: true,
          status: 'SCHEDULED' as const,
        });
      }

      const { data: created } = await client
        .from('rentals')
        .insert(rentalsToCreate)
        .select();

      created!.forEach((r) => createdIds.rentals.push(r.id));

      // Cancel entire series
      const { error } = await client
        .from('rentals')
        .update({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
        })
        .eq('series_id', seriesId)
        .eq('status', 'SCHEDULED');

      expect(error).toBeNull();

      // Verify all cancelled
      const { data: remaining } = await client
        .from('rentals')
        .select('*')
        .eq('series_id', seriesId)
        .eq('status', 'SCHEDULED');

      expect(remaining).toHaveLength(0);
    });
  });

  describe('Guest Count', () => {
    it('increments guest_count on check-in', async () => {
      // Use a unique future date to avoid overlap with other tests
      const rentalDate = format(addDays(new Date(), 8), 'yyyy-MM-dd');

      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '07:00',
        end_time: '23:00',
        guest_count: 0,
      });
      createdIds.rentals.push(rental.id);

      // Simulate guest check-in (increment)
      const { data: updated, error } = await client
        .from('rentals')
        .update({ guest_count: 1 })
        .eq('id', rental.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updated.guest_count).toBe(1);

      // Second guest
      const { data: updated2 } = await client
        .from('rentals')
        .update({ guest_count: 2 })
        .eq('id', rental.id)
        .select()
        .single();

      expect(updated2.guest_count).toBe(2);
    });
  });
});

describe('Exclusive Area Blocking (Real Supabase)', () => {
  const client = createServiceClient();
  let coachId: string;
  let exclusiveAreaId: string;
  let normalAreaId: string;

  beforeAll(async () => {
    const coach = await createTestCoach(client, { nome: 'Exclusive Test Coach' });
    coachId = coach.id;
    createdIds.coaches.push(coachId);

    const exclusiveArea = await createTestArea(client, {
      nome: 'Test Exclusive Area',
      is_exclusive: true,
    });
    exclusiveAreaId = exclusiveArea.id;
    createdIds.areas.push(exclusiveAreaId);

    const normalArea = await createTestArea(client, {
      nome: 'Test Normal Area',
      is_exclusive: false,
    });
    normalAreaId = normalArea.id;
    createdIds.areas.push(normalAreaId);
  });

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  // NOTE: Each test uses a different future date to avoid overlap constraint violations

  it('finds active exclusive rental', async () => {
    // Use a specific future date with fixed time slots
    const testDate = format(addDays(new Date(), 60), 'yyyy-MM-dd');

    // Create rental in exclusive area (simulating "active" window)
    const rental = await createTestRental(client, {
      coach_id: coachId,
      area_id: exclusiveAreaId,
      rental_date: testDate,
      start_time: '14:00',
      end_time: '16:00',
    });
    createdIds.rentals.push(rental.id);

    // Query for active exclusive rentals (simulating time 15:00 - within window)
    const simulatedTime = '15:00:00';
    const { data: activeExclusive } = await client
      .from('rentals')
      .select(`
        *,
        area:areas!inner(id, nome, is_exclusive)
      `)
      .eq('rental_date', testDate)
      .eq('status', 'SCHEDULED')
      .eq('area.is_exclusive', true)
      .lte('start_time', simulatedTime)
      .gte('end_time', simulatedTime);

    expect(activeExclusive!.length).toBeGreaterThan(0);
    expect(activeExclusive![0].area_id).toBe(exclusiveAreaId);
  });

  it('does NOT find ended exclusive rental', async () => {
    // Use a different future date
    const testDate = format(addDays(new Date(), 61), 'yyyy-MM-dd');

    // Create rental that has "ended" (10:00-12:00)
    const rental = await createTestRental(client, {
      coach_id: coachId,
      area_id: exclusiveAreaId,
      rental_date: testDate,
      start_time: '10:00',
      end_time: '12:00',
    });
    createdIds.rentals.push(rental.id);

    // Query at simulated time 14:00 - rental has "ended"
    const simulatedTime = '14:00:00';
    const { data: activeExclusive } = await client
      .from('rentals')
      .select('*')
      .eq('rental_date', testDate)
      .eq('status', 'SCHEDULED')
      .eq('area_id', exclusiveAreaId)
      .lte('start_time', simulatedTime)
      .gte('end_time', simulatedTime);

    // The ended rental should not match (12:00 < 14:00)
    const endedRental = activeExclusive?.find((r) => r.id === rental.id);
    expect(endedRental).toBeUndefined();
  });

  it('non-exclusive area rental does NOT block', async () => {
    // Use a different future date
    const testDate = format(addDays(new Date(), 62), 'yyyy-MM-dd');

    // Create rental in NORMAL area
    const rental = await createTestRental(client, {
      coach_id: coachId,
      area_id: normalAreaId,
      rental_date: testDate,
      start_time: '18:00',
      end_time: '20:00',
    });
    createdIds.rentals.push(rental.id);

    // Query for EXCLUSIVE rentals only (simulating time 19:00 - within rental window)
    const simulatedTime = '19:00:00';
    const { data: exclusiveRentals } = await client
      .from('rentals')
      .select(`
        *,
        area:areas!inner(is_exclusive)
      `)
      .eq('rental_date', testDate)
      .eq('status', 'SCHEDULED')
      .eq('area.is_exclusive', true)
      .lte('start_time', simulatedTime)
      .gte('end_time', simulatedTime);

    // Normal area rental should NOT be in exclusive results
    const foundNormal = exclusiveRentals?.find((r) => r.area_id === normalAreaId);
    expect(foundNormal).toBeUndefined();
  });
});

describe('Fee Models (Real Supabase)', () => {
  const client = createServiceClient();

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  it('FIXED fee coach stores fee_value in cents', async () => {
    const coach = await createTestCoach(client, {
      nome: 'Fixed Fee Coach',
      fee_type: 'FIXED',
      fee_value: 3500, // €35.00
    });
    createdIds.coaches.push(coach.id);

    expect(coach.fee_type).toBe('FIXED');
    expect(coach.fee_value).toBe(3500);

    // Fee calculation
    const feeInEuros = coach.fee_value / 100;
    expect(feeInEuros).toBe(35);
  });

  it('PERCENTAGE fee coach stores percentage * 100', async () => {
    const coach = await createTestCoach(client, {
      nome: 'Percentage Coach',
      fee_type: 'PERCENTAGE',
      fee_value: 2000, // 20%
    });
    createdIds.coaches.push(coach.id);

    expect(coach.fee_type).toBe('PERCENTAGE');
    expect(coach.fee_value).toBe(2000);

    // Fee calculation example: 20% of €69 plan * 5 guests
    const basePlanCents = 6900;
    const guestCount = 5;
    const percentage = coach.fee_value / 10000; // 0.20
    const totalFee = Math.round(percentage * basePlanCents * guestCount);

    expect(totalFee).toBe(6900); // €69.00
  });

  it('no floating point errors with money', async () => {
    const testCases = [
      { euros: 29.99, cents: 2999 },
      { euros: 0.01, cents: 1 },
      { euros: 99.99, cents: 9999 },
      { euros: 50.5, cents: 5050 },
    ];

    for (const { euros, cents } of testCases) {
      const calculated = Math.round(euros * 100);
      expect(calculated).toBe(cents);
    }
  });
});
