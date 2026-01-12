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
 * Rental Booking Integration Tests - CRITICAL BUSINESS RULES
 *
 * Tests the rental overlap constraint (DB trigger):
 * - Same area, same date, overlapping times = REJECTED
 * - Different areas = ALLOWED
 * - Same area, different dates = ALLOWED
 * - Sequential rentals (no overlap) = ALLOWED
 * - Cancelled rentals don't block = ALLOWED
 *
 * PREREQUISITE: Migration 20260112_rental_overlap_constraint.sql must be applied
 */
describe('Rental Overlap Constraint (Real Supabase)', () => {
  const client = createServiceClient();
  let coach1Id: string;
  let coach2Id: string;
  let areaId: string;
  let area2Id: string;

  beforeAll(async () => {
    // Create two coaches for multi-coach tests
    const coach1 = await createTestCoach(client, {
      nome: 'Overlap Test Coach 1',
      fee_type: 'FIXED',
      fee_value: 3000,
    });
    coach1Id = coach1.id;
    createdIds.coaches.push(coach1Id);

    const coach2 = await createTestCoach(client, {
      nome: 'Overlap Test Coach 2',
      fee_type: 'FIXED',
      fee_value: 3000,
    });
    coach2Id = coach2.id;
    createdIds.coaches.push(coach2Id);

    // Create two areas
    const area1 = await createTestArea(client, {
      nome: 'Overlap Test Area 1',
      is_exclusive: true,
    });
    areaId = area1.id;
    createdIds.areas.push(areaId);

    const area2 = await createTestArea(client, {
      nome: 'Overlap Test Area 2',
      is_exclusive: false,
    });
    area2Id = area2.id;
    createdIds.areas.push(area2Id);
  });

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  describe('Overlap Rejection (CRITICAL)', () => {
    it('REJECTS overlapping rental in SAME area', async () => {
      const rentalDate = format(addDays(new Date(), 5), 'yyyy-MM-dd');

      // First rental: 19:00-20:00
      const rental1 = await createTestRental(client, {
        coach_id: coach1Id,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '19:00',
        end_time: '20:00',
      });
      createdIds.rentals.push(rental1.id);

      // Try to create overlapping rental: 19:30-20:30 (same area, overlaps)
      const { data, error } = await client
        .from('rentals')
        .insert({
          coach_id: coach2Id,
          area_id: areaId, // SAME AREA
          rental_date: rentalDate,
          start_time: '19:30',
          end_time: '20:30',
        })
        .select()
        .single();

      // Should be rejected by trigger
      expect(error).not.toBeNull();
      expect(error!.message).toContain('overlap');
      expect(data).toBeNull();
    });

    it('REJECTS rental completely inside existing rental', async () => {
      const rentalDate = format(addDays(new Date(), 6), 'yyyy-MM-dd');

      // First rental: 14:00-17:00
      const rental1 = await createTestRental(client, {
        coach_id: coach1Id,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '14:00',
        end_time: '17:00',
      });
      createdIds.rentals.push(rental1.id);

      // Try to create rental inside: 15:00-16:00 (completely contained)
      const { data, error } = await client
        .from('rentals')
        .insert({
          coach_id: coach2Id,
          area_id: areaId,
          rental_date: rentalDate,
          start_time: '15:00',
          end_time: '16:00',
        })
        .select()
        .single();

      expect(error).not.toBeNull();
      expect(error!.message).toContain('overlap');
      expect(data).toBeNull();
    });

    it('REJECTS rental that encompasses existing rental', async () => {
      const rentalDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');

      // First rental: 15:00-16:00
      const rental1 = await createTestRental(client, {
        coach_id: coach1Id,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '15:00',
        end_time: '16:00',
      });
      createdIds.rentals.push(rental1.id);

      // Try to create encompassing rental: 14:00-17:00
      const { data, error } = await client
        .from('rentals')
        .insert({
          coach_id: coach2Id,
          area_id: areaId,
          rental_date: rentalDate,
          start_time: '14:00',
          end_time: '17:00',
        })
        .select()
        .single();

      expect(error).not.toBeNull();
      expect(error!.message).toContain('overlap');
      expect(data).toBeNull();
    });

    it('REJECTS exact same time slot', async () => {
      const rentalDate = format(addDays(new Date(), 8), 'yyyy-MM-dd');

      // First rental: 10:00-11:00
      const rental1 = await createTestRental(client, {
        coach_id: coach1Id,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '10:00',
        end_time: '11:00',
      });
      createdIds.rentals.push(rental1.id);

      // Try EXACT same slot
      const { data, error } = await client
        .from('rentals')
        .insert({
          coach_id: coach2Id,
          area_id: areaId,
          rental_date: rentalDate,
          start_time: '10:00',
          end_time: '11:00',
        })
        .select()
        .single();

      expect(error).not.toBeNull();
      expect(error!.message).toContain('overlap');
      expect(data).toBeNull();
    });
  });

  describe('Allowed Bookings (No Conflict)', () => {
    it('ALLOWS sequential rentals (end time = start time)', async () => {
      const rentalDate = format(addDays(new Date(), 9), 'yyyy-MM-dd');

      // First rental: 10:00-11:00
      const rental1 = await createTestRental(client, {
        coach_id: coach1Id,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '10:00',
        end_time: '11:00',
      });
      createdIds.rentals.push(rental1.id);

      // Sequential rental: 11:00-12:00 (starts exactly when first ends)
      const rental2 = await createTestRental(client, {
        coach_id: coach2Id,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '11:00',
        end_time: '12:00',
      });
      createdIds.rentals.push(rental2.id);

      expect(rental2.id).toBeDefined();
      expect(rental2.start_time).toBe('11:00:00');
    });

    it('ALLOWS same time slot in DIFFERENT areas', async () => {
      const rentalDate = format(addDays(new Date(), 10), 'yyyy-MM-dd');

      // First rental in area 1: 14:00-15:00
      const rental1 = await createTestRental(client, {
        coach_id: coach1Id,
        area_id: areaId, // Area 1
        rental_date: rentalDate,
        start_time: '14:00',
        end_time: '15:00',
      });
      createdIds.rentals.push(rental1.id);

      // Same time slot in area 2 - should be ALLOWED
      const rental2 = await createTestRental(client, {
        coach_id: coach2Id,
        area_id: area2Id, // DIFFERENT area
        rental_date: rentalDate,
        start_time: '14:00',
        end_time: '15:00',
      });
      createdIds.rentals.push(rental2.id);

      expect(rental2.id).toBeDefined();
    });

    it('ALLOWS same time slot on DIFFERENT dates', async () => {
      const rentalDate1 = format(addDays(new Date(), 11), 'yyyy-MM-dd');
      const rentalDate2 = format(addDays(new Date(), 12), 'yyyy-MM-dd');

      // Rental on day 1: 16:00-17:00
      const rental1 = await createTestRental(client, {
        coach_id: coach1Id,
        area_id: areaId,
        rental_date: rentalDate1,
        start_time: '16:00',
        end_time: '17:00',
      });
      createdIds.rentals.push(rental1.id);

      // Same time slot on different day - should be ALLOWED
      const rental2 = await createTestRental(client, {
        coach_id: coach2Id,
        area_id: areaId, // Same area
        rental_date: rentalDate2, // DIFFERENT date
        start_time: '16:00',
        end_time: '17:00',
      });
      createdIds.rentals.push(rental2.id);

      expect(rental2.id).toBeDefined();
    });

    it('ALLOWS booking when existing rental is CANCELLED', async () => {
      const rentalDate = format(addDays(new Date(), 13), 'yyyy-MM-dd');

      // First rental (will be cancelled): 18:00-19:00
      const rental1 = await createTestRental(client, {
        coach_id: coach1Id,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '18:00',
        end_time: '19:00',
      });
      createdIds.rentals.push(rental1.id);

      // Cancel the first rental
      await client.from('rentals').update({
        status: 'CANCELLED',
        cancelled_at: new Date().toISOString(),
      }).eq('id', rental1.id);

      // Now same slot should be available
      const rental2 = await createTestRental(client, {
        coach_id: coach2Id,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '18:00',
        end_time: '19:00',
      });
      createdIds.rentals.push(rental2.id);

      expect(rental2.id).toBeDefined();
    });
  });

  describe('Update Scenarios', () => {
    it('REJECTS update that creates overlap', async () => {
      const rentalDate = format(addDays(new Date(), 14), 'yyyy-MM-dd');

      // Rental 1: 09:00-10:00
      const rental1 = await createTestRental(client, {
        coach_id: coach1Id,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '09:00',
        end_time: '10:00',
      });
      createdIds.rentals.push(rental1.id);

      // Rental 2: 11:00-12:00 (no overlap initially)
      const rental2 = await createTestRental(client, {
        coach_id: coach2Id,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '11:00',
        end_time: '12:00',
      });
      createdIds.rentals.push(rental2.id);

      // Try to update rental2 to 09:30-10:30 (would overlap with rental1)
      const { error } = await client
        .from('rentals')
        .update({
          start_time: '09:30',
          end_time: '10:30',
        })
        .eq('id', rental2.id);

      expect(error).not.toBeNull();
      expect(error!.message).toContain('overlap');
    });

    it('ALLOWS update that does NOT create overlap', async () => {
      const rentalDate = format(addDays(new Date(), 15), 'yyyy-MM-dd');

      // Rental 1: 09:00-10:00
      const rental1 = await createTestRental(client, {
        coach_id: coach1Id,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '09:00',
        end_time: '10:00',
      });
      createdIds.rentals.push(rental1.id);

      // Rental 2: 14:00-15:00
      const rental2 = await createTestRental(client, {
        coach_id: coach2Id,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '14:00',
        end_time: '15:00',
      });
      createdIds.rentals.push(rental2.id);

      // Update rental2 to 15:00-16:00 (still no overlap)
      const { data, error } = await client
        .from('rentals')
        .update({
          start_time: '15:00',
          end_time: '16:00',
        })
        .eq('id', rental2.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.start_time).toBe('15:00:00');
    });

    it('ALLOWS self-update (updating own rental)', async () => {
      const rentalDate = format(addDays(new Date(), 16), 'yyyy-MM-dd');

      // Create rental: 10:00-11:00
      const rental = await createTestRental(client, {
        coach_id: coach1Id,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '10:00',
        end_time: '11:00',
      });
      createdIds.rentals.push(rental.id);

      // Update same rental (extend it): 10:00-12:00
      const { data, error } = await client
        .from('rentals')
        .update({
          end_time: '12:00',
        })
        .eq('id', rental.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.end_time).toBe('12:00:00');
    });
  });

  describe('Time Range Constraint', () => {
    it('REJECTS rental with end_time <= start_time', async () => {
      const rentalDate = format(addDays(new Date(), 17), 'yyyy-MM-dd');

      // Try to create rental with invalid time range
      const { data, error } = await client
        .from('rentals')
        .insert({
          coach_id: coach1Id,
          area_id: areaId,
          rental_date: rentalDate,
          start_time: '14:00',
          end_time: '13:00', // INVALID: before start
        })
        .select()
        .single();

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it('REJECTS rental with same start and end time', async () => {
      const rentalDate = format(addDays(new Date(), 18), 'yyyy-MM-dd');

      // Try to create zero-duration rental
      const { data, error } = await client
        .from('rentals')
        .insert({
          coach_id: coach1Id,
          area_id: areaId,
          rental_date: rentalDate,
          start_time: '15:00',
          end_time: '15:00', // INVALID: same as start
        })
        .select()
        .single();

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });
});

describe('Rental Status Lifecycle', () => {
  const client = createServiceClient();
  let coachId: string;
  let areaId: string;

  beforeAll(async () => {
    const coach = await createTestCoach(client, {
      nome: 'Lifecycle Test Coach',
    });
    coachId = coach.id;
    createdIds.coaches.push(coachId);

    const area = await createTestArea(client, {
      nome: 'Lifecycle Test Area',
    });
    areaId = area.id;
    createdIds.areas.push(areaId);
  });

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  it('new rental starts with SCHEDULED status', async () => {
    const rental = await createTestRental(client, {
      coach_id: coachId,
      area_id: areaId,
      rental_date: format(addDays(new Date(), 20), 'yyyy-MM-dd'),
      start_time: '10:00',
      end_time: '11:00',
    });
    createdIds.rentals.push(rental.id);

    expect(rental.status).toBe('SCHEDULED');
  });

  it('can transition to COMPLETED', async () => {
    const rental = await createTestRental(client, {
      coach_id: coachId,
      area_id: areaId,
      rental_date: format(addDays(new Date(), 21), 'yyyy-MM-dd'),
      start_time: '10:00',
      end_time: '11:00',
    });
    createdIds.rentals.push(rental.id);

    const { data, error } = await client
      .from('rentals')
      .update({ status: 'COMPLETED' })
      .eq('id', rental.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.status).toBe('COMPLETED');
  });

  it('can transition to CANCELLED with timestamp', async () => {
    const rental = await createTestRental(client, {
      coach_id: coachId,
      area_id: areaId,
      rental_date: format(addDays(new Date(), 22), 'yyyy-MM-dd'),
      start_time: '10:00',
      end_time: '11:00',
    });
    createdIds.rentals.push(rental.id);

    const cancelledAt = new Date().toISOString();
    const { data, error } = await client
      .from('rentals')
      .update({
        status: 'CANCELLED',
        cancelled_at: cancelledAt,
      })
      .eq('id', rental.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.status).toBe('CANCELLED');
    expect(data!.cancelled_at).toBeDefined();
  });

  it('CANCELLED rental can be re-booked at same slot', async () => {
    const rentalDate = format(addDays(new Date(), 23), 'yyyy-MM-dd');

    // Create and cancel
    const rental1 = await createTestRental(client, {
      coach_id: coachId,
      area_id: areaId,
      rental_date: rentalDate,
      start_time: '14:00',
      end_time: '15:00',
    });
    createdIds.rentals.push(rental1.id);

    await client.from('rentals').update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
    }).eq('id', rental1.id);

    // Re-book same slot
    const rental2 = await createTestRental(client, {
      coach_id: coachId,
      area_id: areaId,
      rental_date: rentalDate,
      start_time: '14:00',
      end_time: '15:00',
    });
    createdIds.rentals.push(rental2.id);

    expect(rental2.id).toBeDefined();
    expect(rental2.status).toBe('SCHEDULED');
  });
});

describe('Recurring Rentals (series_id)', () => {
  const client = createServiceClient();
  let coachId: string;
  let areaId: string;

  beforeAll(async () => {
    const coach = await createTestCoach(client, {
      nome: 'Recurring Test Coach',
    });
    coachId = coach.id;
    createdIds.coaches.push(coachId);

    const area = await createTestArea(client, {
      nome: 'Recurring Test Area',
    });
    areaId = area.id;
    createdIds.areas.push(areaId);
  });

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  it('can create multiple rentals with same series_id', async () => {
    const seriesId = crypto.randomUUID();

    // Create 3 weekly rentals
    const dates = [
      format(addDays(new Date(), 25), 'yyyy-MM-dd'),
      format(addDays(new Date(), 32), 'yyyy-MM-dd'),
      format(addDays(new Date(), 39), 'yyyy-MM-dd'),
    ];

    for (const date of dates) {
      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: date,
        start_time: '10:00',
        end_time: '11:00',
        is_recurring: true,
        series_id: seriesId,
      });
      createdIds.rentals.push(rental.id);
    }

    // Query all rentals in series
    const { data: seriesRentals } = await client
      .from('rentals')
      .select('*')
      .eq('series_id', seriesId)
      .order('rental_date');

    expect(seriesRentals).toHaveLength(3);
    expect(seriesRentals![0].is_recurring).toBe(true);
  });

  it('cancelling one rental in series does NOT cancel others', async () => {
    const seriesId = crypto.randomUUID();

    const dates = [
      format(addDays(new Date(), 46), 'yyyy-MM-dd'),
      format(addDays(new Date(), 53), 'yyyy-MM-dd'),
    ];

    const rentals: string[] = [];
    for (const date of dates) {
      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: date,
        start_time: '15:00',
        end_time: '16:00',
        is_recurring: true,
        series_id: seriesId,
      });
      rentals.push(rental.id);
      createdIds.rentals.push(rental.id);
    }

    // Cancel first rental
    await client.from('rentals').update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
    }).eq('id', rentals[0]);

    // Verify only first is cancelled
    const { data: seriesRentals } = await client
      .from('rentals')
      .select('*')
      .eq('series_id', seriesId)
      .order('rental_date');

    expect(seriesRentals![0].status).toBe('CANCELLED');
    expect(seriesRentals![1].status).toBe('SCHEDULED');
  });
});
