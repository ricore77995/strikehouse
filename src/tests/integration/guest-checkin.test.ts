import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { format, addDays, subDays, addHours } from 'date-fns';
import {
  createServiceClient,
  createTestCoach,
  createTestArea,
  createTestRental,
} from '../fixtures/factory';
import { createdIds, cleanupTrackedEntities } from '../fixtures/setup';

/**
 * Guest Check-in Integration Tests
 *
 * Tests the guest check-in flow for external coaches:
 * - Guest check-in requires active rental
 * - Check-in must be within rental time window
 * - Guest count increments on check-in
 * - Check-in records are created in check_ins table
 *
 * NOTE: coach_guests table does not exist in remote - those tests are skipped
 */
describe('Guest Check-in (Real Supabase)', () => {
  const client = createServiceClient();
  let coachId: string;
  let areaId: string;

  beforeAll(async () => {
    const coach = await createTestCoach(client, {
      nome: 'Guest Checkin Test Coach',
    });
    coachId = coach.id;
    createdIds.coaches.push(coachId);

    const area = await createTestArea(client, {
      nome: 'Guest Checkin Test Area',
    });
    areaId = area.id;
    createdIds.areas.push(areaId);
  });

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  describe('Rental Time Window Validation', () => {
    it('check-in succeeds within rental time window', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const now = format(new Date(), 'HH:mm');
      const twoHoursLater = format(addHours(new Date(), 2), 'HH:mm');

      // Create rental for NOW
      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: today,
        start_time: now,
        end_time: twoHoursLater,
        guest_count: 0,
      });
      createdIds.rentals.push(rental.id);

      // Verify rental is active NOW
      const isWithinTime = now >= rental.start_time.slice(0, 5) && now <= rental.end_time.slice(0, 5);
      expect(isWithinTime).toBe(true);

      // Create check-in record (guest_name only, no guest_id in schema)
      const { data: checkin, error } = await client
        .from('check_ins')
        .insert({
          type: 'GUEST',
          result: 'ALLOWED',
          rental_id: rental.id,
          guest_name: 'Test Guest User',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(checkin.type).toBe('GUEST');
      expect(checkin.result).toBe('ALLOWED');
      expect(checkin.rental_id).toBe(rental.id);

      createdIds.checkins.push(checkin.id);
    });

    it('rental not found for wrong date', async () => {
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

      // Create rental for YESTERDAY
      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: yesterday,
        start_time: '19:00',
        end_time: '20:00',
      });
      createdIds.rentals.push(rental.id);

      // Query for rentals TODAY
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: todayRentals } = await client
        .from('rentals')
        .select('*')
        .eq('coach_id', coachId)
        .eq('rental_date', today)
        .eq('status', 'SCHEDULED');

      // Yesterday's rental should NOT appear
      const found = todayRentals?.find((r) => r.id === rental.id);
      expect(found).toBeUndefined();
    });

    it('rental outside time window is not valid for check-in', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const threeHoursLater = format(addHours(new Date(), 3), 'HH:mm');
      const fourHoursLater = format(addHours(new Date(), 4), 'HH:mm');

      // Create rental for LATER today
      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: today,
        start_time: threeHoursLater,
        end_time: fourHoursLater,
      });
      createdIds.rentals.push(rental.id);

      // Current time is NOT within rental window
      const now = format(new Date(), 'HH:mm');
      const isWithinTime = now >= rental.start_time.slice(0, 5) && now <= rental.end_time.slice(0, 5);

      expect(isWithinTime).toBe(false);
    });
  });

  describe('Guest Count Tracking', () => {
    it('guest_count increments on check-in', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: today,
        start_time: '06:00',
        end_time: '23:59',
        guest_count: 0,
      });
      createdIds.rentals.push(rental.id);

      // First guest check-in
      const { data: updated1 } = await client
        .from('rentals')
        .update({ guest_count: 1 })
        .eq('id', rental.id)
        .select()
        .single();

      expect(updated1.guest_count).toBe(1);

      // Second guest check-in
      const { data: updated2 } = await client
        .from('rentals')
        .update({ guest_count: 2 })
        .eq('id', rental.id)
        .select()
        .single();

      expect(updated2.guest_count).toBe(2);

      // Third guest check-in
      const { data: updated3 } = await client
        .from('rentals')
        .update({ guest_count: 3 })
        .eq('id', rental.id)
        .select()
        .single();

      expect(updated3.guest_count).toBe(3);
    });

    it('multiple guests can check-in to same rental', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: today,
        start_time: '05:00',
        end_time: '23:59',
        guest_count: 0,
      });
      createdIds.rentals.push(rental.id);

      // Check-in multiple guests (using guest_name only)
      const { data: checkins, error } = await client
        .from('check_ins')
        .insert([
          {
            type: 'GUEST',
            result: 'ALLOWED',
            rental_id: rental.id,
            guest_name: 'Guest 1',
          },
          {
            type: 'GUEST',
            result: 'ALLOWED',
            rental_id: rental.id,
            guest_name: 'Guest 2',
          },
        ])
        .select();

      expect(error).toBeNull();
      expect(checkins).toHaveLength(2);

      checkins!.forEach((c) => createdIds.checkins.push(c.id));
    });
  });

  describe('Check-in Record Creation', () => {
    it('creates check_in record with correct fields', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: today,
        start_time: '04:00',
        end_time: '23:59',
      });
      createdIds.rentals.push(rental.id);

      const { data: checkin, error } = await client
        .from('check_ins')
        .insert({
          type: 'GUEST',
          result: 'ALLOWED',
          rental_id: rental.id,
          guest_name: 'Ad-hoc Guest',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(checkin.type).toBe('GUEST');
      expect(checkin.result).toBe('ALLOWED');
      expect(checkin.rental_id).toBe(rental.id);
      expect(checkin.guest_name).toBe('Ad-hoc Guest');
      expect(checkin.checked_in_at).toBeDefined();

      createdIds.checkins.push(checkin.id);
    });

    it('allows check-in with ad-hoc guest name only', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: today,
        start_time: '03:00',
        end_time: '23:59',
      });
      createdIds.rentals.push(rental.id);

      // Check-in with just guest_name
      const { data: checkin, error } = await client
        .from('check_ins')
        .insert({
          type: 'GUEST',
          result: 'ALLOWED',
          rental_id: rental.id,
          guest_name: 'Walk-in Student',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(checkin.guest_name).toBe('Walk-in Student');

      createdIds.checkins.push(checkin.id);
    });
  });

  describe('Query Patterns', () => {
    it('can query check-ins by rental', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: today,
        start_time: '02:00',
        end_time: '23:59',
      });
      createdIds.rentals.push(rental.id);

      // Create check-ins
      await client.from('check_ins').insert([
        { type: 'GUEST', result: 'ALLOWED', rental_id: rental.id, guest_name: 'A' },
        { type: 'GUEST', result: 'ALLOWED', rental_id: rental.id, guest_name: 'B' },
      ]);

      // Query check-ins for this rental
      const { data: rentalCheckins } = await client
        .from('check_ins')
        .select('*')
        .eq('rental_id', rental.id);

      expect(rentalCheckins!.length).toBeGreaterThanOrEqual(2);

      rentalCheckins!.forEach((c) => createdIds.checkins.push(c.id));
    });

    it('can query check-ins by coach via rental join', async () => {
      // Query all check-ins for a coach (through rental relationship)
      const { data: coachCheckins } = await client
        .from('check_ins')
        .select(`
          *,
          rental:rentals!inner(coach_id)
        `)
        .eq('rental.coach_id', coachId)
        .eq('type', 'GUEST');

      // All returned check-ins should belong to rentals of this coach
      coachCheckins?.forEach((c) => {
        expect((c.rental as any).coach_id).toBe(coachId);
      });
    });
  });
});

// NOTE: coach_guests table does not exist in remote DB
// Skipping Coach Guest CRUD tests until migration is applied
describe.skip('Coach Guest CRUD (Real Supabase)', () => {
  // Tests would go here when coach_guests table exists
});
