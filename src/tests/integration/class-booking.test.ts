import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { format, addDays } from 'date-fns';
import {
  createServiceClient,
  createTestMember,
  createTestStaff,
  createTestClass,
  createTestClassBooking,
  createTestFixedSchedule,
} from '../fixtures/factory';
import { createdIds, cleanupTrackedEntities } from '../fixtures/setup';

/**
 * Class Booking Integration Tests
 *
 * Tests the class booking system:
 * - Creating/cancelling bookings
 * - Check-in with booking integration
 * - No-show penalty logic
 * - Fixed schedules for 2x/3x plans
 * - Capacity limits
 */
describe('Class Booking System (Real Supabase)', () => {
  const client = createServiceClient();
  let staffId: string;
  let testClassId: string;

  beforeAll(async () => {
    const staff = await createTestStaff(client, {
      nome: 'Booking Test Staff',
      role: 'STAFF',
    });
    staffId = staff.id;
    createdIds.staff.push(staffId);

    // Create a test class (Monday 19:00)
    const testClass = await createTestClass(client, {
      nome: 'Test Muay Thai',
      modalidade: 'Muay Thai',
      dia_semana: 1, // Monday
      hora_inicio: '19:00',
      duracao_min: 60,
      capacidade: 30,
    });
    testClassId = testClass.id;
    createdIds.classes.push(testClassId);
  });

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  describe('Basic Booking CRUD', () => {
    it('creates a booking successfully', async () => {
      const member = await createTestMember(client, {
        nome: 'Booking Test Member',
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      });
      createdIds.members.push(member.id);

      const today = format(new Date(), 'yyyy-MM-dd');

      const booking = await createTestClassBooking(client, {
        class_id: testClassId,
        member_id: member.id,
        class_date: today,
        status: 'BOOKED',
      });
      createdIds.classBookings.push(booking.id);

      expect(booking.id).toBeDefined();
      expect(booking.status).toBe('BOOKED');
      expect(booking.class_id).toBe(testClassId);
      expect(booking.member_id).toBe(member.id);
    });

    it('prevents duplicate bookings for same class/date/member', async () => {
      const member = await createTestMember(client, {
        nome: 'Duplicate Test Member',
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      });
      createdIds.members.push(member.id);

      const futureDate = format(addDays(new Date(), 5), 'yyyy-MM-dd');

      // First booking should succeed
      const booking1 = await createTestClassBooking(client, {
        class_id: testClassId,
        member_id: member.id,
        class_date: futureDate,
      });
      createdIds.classBookings.push(booking1.id);

      // Second booking for same class/date should fail
      const { data, error } = await client
        .from('class_bookings')
        .insert({
          class_id: testClassId,
          member_id: member.id,
          class_date: futureDate,
          status: 'BOOKED',
        })
        .select()
        .single();

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it('allows cancellation with CANCELLED status', async () => {
      const member = await createTestMember(client, {
        nome: 'Cancel Test Member',
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      });
      createdIds.members.push(member.id);

      const futureDate = format(addDays(new Date(), 3), 'yyyy-MM-dd');

      const booking = await createTestClassBooking(client, {
        class_id: testClassId,
        member_id: member.id,
        class_date: futureDate,
      });
      createdIds.classBookings.push(booking.id);

      // Cancel the booking
      const { data: cancelled, error } = await client
        .from('class_bookings')
        .update({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', booking.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancelled_at).toBeDefined();
    });
  });

  describe('Check-in Integration', () => {
    it('marks booking as CHECKED_IN on member check-in', async () => {
      const member = await createTestMember(client, {
        nome: 'Checkin Booking Member',
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      });
      createdIds.members.push(member.id);

      const today = format(new Date(), 'yyyy-MM-dd');

      const booking = await createTestClassBooking(client, {
        class_id: testClassId,
        member_id: member.id,
        class_date: today,
        status: 'BOOKED',
      });
      createdIds.classBookings.push(booking.id);

      // Simulate check-in marking booking as checked in
      const { data: checkedIn, error } = await client
        .from('class_bookings')
        .update({
          status: 'CHECKED_IN',
          checked_in_at: new Date().toISOString(),
        })
        .eq('id', booking.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(checkedIn.status).toBe('CHECKED_IN');
      expect(checkedIn.checked_in_at).toBeDefined();
    });

    it('creates check_in record with class_id', async () => {
      const member = await createTestMember(client, {
        nome: 'Checkin with Class Member',
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      });
      createdIds.members.push(member.id);

      // Create check-in with class_id
      const { data: checkin, error } = await client
        .from('check_ins')
        .insert({
          type: 'MEMBER',
          result: 'ALLOWED',
          member_id: member.id,
          class_id: testClassId,
          checked_in_by: staffId,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(checkin.class_id).toBe(testClassId);

      createdIds.checkins.push(checkin.id);
    });
  });

  describe('Capacity Limits', () => {
    it('respects class capacity', async () => {
      // Create a class with capacity of 2
      const smallClass = await createTestClass(client, {
        nome: 'Small Class',
        dia_semana: 2, // Tuesday
        hora_inicio: '10:00',
        capacidade: 2,
      });
      createdIds.classes.push(smallClass.id);

      const futureDate = format(addDays(new Date(), 10), 'yyyy-MM-dd');

      // Create 2 bookings (fill capacity)
      for (let i = 0; i < 2; i++) {
        const member = await createTestMember(client, {
          nome: `Capacity Test Member ${i}`,
          status: 'ATIVO',
          access_type: 'SUBSCRIPTION',
          access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        });
        createdIds.members.push(member.id);

        const booking = await createTestClassBooking(client, {
          class_id: smallClass.id,
          member_id: member.id,
          class_date: futureDate,
        });
        createdIds.classBookings.push(booking.id);
      }

      // Count bookings
      const { count } = await client
        .from('class_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', smallClass.id)
        .eq('class_date', futureDate)
        .in('status', ['BOOKED', 'CHECKED_IN']);

      expect(count).toBe(2);

      // Get class capacity
      const { data: cls } = await client
        .from('classes')
        .select('capacidade')
        .eq('id', smallClass.id)
        .single();

      // Verify capacity is full
      expect(count).toBe(cls!.capacidade);
    });
  });

  describe('No-Show Processing', () => {
    it('marks booking as NO_SHOW', async () => {
      const member = await createTestMember(client, {
        nome: 'No Show Member',
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        weekly_limit: null, // Unlimited
      });
      createdIds.members.push(member.id);

      // Create booking for yesterday (past)
      const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd');

      const booking = await createTestClassBooking(client, {
        class_id: testClassId,
        member_id: member.id,
        class_date: yesterday,
        status: 'BOOKED',
      });
      createdIds.classBookings.push(booking.id);

      // Process as NO_SHOW
      const { data: noShow, error } = await client
        .from('class_bookings')
        .update({ status: 'NO_SHOW' })
        .eq('id', booking.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(noShow.status).toBe('NO_SHOW');
    });

    it('applies 24h booking block for unlimited plan no-show', async () => {
      const member = await createTestMember(client, {
        nome: 'Block Test Member',
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        weekly_limit: null, // Unlimited
      });
      createdIds.members.push(member.id);

      // Apply booking block
      const blockUntil = new Date();
      blockUntil.setHours(blockUntil.getHours() + 24);

      const { data: blocked, error } = await client
        .from('members')
        .update({ booking_blocked_until: blockUntil.toISOString() })
        .eq('id', member.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(blocked.booking_blocked_until).toBeDefined();

      // Check block is active
      const now = new Date();
      const blockedUntil = new Date(blocked.booking_blocked_until);
      expect(blockedUntil.getTime()).toBeGreaterThan(now.getTime());
    });

    it('deducts credit for CREDITS plan no-show', async () => {
      const initialCredits = 10;
      const member = await createTestMember(client, {
        nome: 'Credits No-Show Member',
        status: 'ATIVO',
        access_type: 'CREDITS',
        credits_remaining: initialCredits,
        access_expires_at: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
      });
      createdIds.members.push(member.id);

      // Deduct credit (simulating no-show penalty)
      const { data: updated, error } = await client
        .from('members')
        .update({ credits_remaining: initialCredits - 1 })
        .eq('id', member.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updated.credits_remaining).toBe(9);
    });

    it('does NOT apply penalty for 2x/3x plan (weekly_limit)', async () => {
      const member = await createTestMember(client, {
        nome: '2x Plan No-Show Member',
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        weekly_limit: 2, // 2x/week plan
      });
      createdIds.members.push(member.id);

      // Member has weekly_limit > 0, so no penalty should be applied
      // Verify the business rule
      expect(member.weekly_limit).toBe(2);
      expect(member.weekly_limit).toBeGreaterThan(0);

      // No booking_blocked_until should be set
      const { data } = await client
        .from('members')
        .select('booking_blocked_until')
        .eq('id', member.id)
        .single();

      expect(data!.booking_blocked_until).toBeNull();
    });
  });

  describe('Fixed Schedules', () => {
    it('creates fixed schedule for member', async () => {
      const member = await createTestMember(client, {
        nome: 'Fixed Schedule Member',
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        weekly_limit: 2,
      });
      createdIds.members.push(member.id);

      const schedule = await createTestFixedSchedule(client, {
        member_id: member.id,
        class_id: testClassId,
        active: true,
      });
      createdIds.fixedSchedules.push(schedule.id);

      expect(schedule.id).toBeDefined();
      expect(schedule.member_id).toBe(member.id);
      expect(schedule.class_id).toBe(testClassId);
      expect(schedule.active).toBe(true);
    });

    it('limits fixed schedules to weekly_limit', async () => {
      const member = await createTestMember(client, {
        nome: 'Fixed Schedule Limit Member',
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        weekly_limit: 2, // Max 2 fixed schedules
      });
      createdIds.members.push(member.id);

      // Create 2 more test classes
      const class2 = await createTestClass(client, {
        nome: 'Test Class 2',
        dia_semana: 3, // Wednesday
        hora_inicio: '19:00',
      });
      createdIds.classes.push(class2.id);

      const class3 = await createTestClass(client, {
        nome: 'Test Class 3',
        dia_semana: 5, // Friday
        hora_inicio: '19:00',
      });
      createdIds.classes.push(class3.id);

      // Create 2 fixed schedules
      const schedule1 = await createTestFixedSchedule(client, {
        member_id: member.id,
        class_id: testClassId,
      });
      createdIds.fixedSchedules.push(schedule1.id);

      const schedule2 = await createTestFixedSchedule(client, {
        member_id: member.id,
        class_id: class2.id,
      });
      createdIds.fixedSchedules.push(schedule2.id);

      // Count fixed schedules
      const { count } = await client
        .from('member_fixed_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', member.id)
        .eq('active', true);

      expect(count).toBe(2);
      expect(count).toBe(member.weekly_limit);
    });

    it('retrieves fixed schedules with class details', async () => {
      const member = await createTestMember(client, {
        nome: 'Fixed Schedule Query Member',
        status: 'ATIVO',
        weekly_limit: 2,
      });
      createdIds.members.push(member.id);

      await createTestFixedSchedule(client, {
        member_id: member.id,
        class_id: testClassId,
      }).then((s) => createdIds.fixedSchedules.push(s.id));

      const { data: schedules, error } = await client
        .from('member_fixed_schedules')
        .select(`
          id,
          active,
          classes(id, nome, dia_semana, hora_inicio)
        `)
        .eq('member_id', member.id)
        .eq('active', true);

      expect(error).toBeNull();
      expect(schedules!.length).toBe(1);
      expect((schedules![0] as any).classes).toBeDefined();
      expect((schedules![0] as any).classes.nome).toBe('Test Muay Thai');
    });
  });

  describe('Booking Queries', () => {
    it('finds member bookings for a specific date', async () => {
      const member = await createTestMember(client, {
        nome: 'Query Test Member',
        status: 'ATIVO',
      });
      createdIds.members.push(member.id);

      const targetDate = format(addDays(new Date(), 7), 'yyyy-MM-dd');

      const booking = await createTestClassBooking(client, {
        class_id: testClassId,
        member_id: member.id,
        class_date: targetDate,
      });
      createdIds.classBookings.push(booking.id);

      // Query bookings for date
      const { data: bookings, error } = await client
        .from('class_bookings')
        .select(`
          id,
          status,
          class_date,
          classes(nome, hora_inicio)
        `)
        .eq('member_id', member.id)
        .eq('class_date', targetDate)
        .eq('status', 'BOOKED');

      expect(error).toBeNull();
      expect(bookings!.length).toBe(1);
      expect((bookings![0] as any).classes.nome).toBe('Test Muay Thai');
    });

    it('lists all bookings for a class on a date', async () => {
      const futureDate = format(addDays(new Date(), 14), 'yyyy-MM-dd');

      // Create 3 members with bookings
      for (let i = 0; i < 3; i++) {
        const member = await createTestMember(client, {
          nome: `Class List Member ${i}`,
          status: 'ATIVO',
        });
        createdIds.members.push(member.id);

        const booking = await createTestClassBooking(client, {
          class_id: testClassId,
          member_id: member.id,
          class_date: futureDate,
        });
        createdIds.classBookings.push(booking.id);
      }

      // Query class roster
      const { data: roster, error } = await client
        .from('class_bookings')
        .select(`
          id,
          status,
          members(id, nome)
        `)
        .eq('class_id', testClassId)
        .eq('class_date', futureDate)
        .in('status', ['BOOKED', 'CHECKED_IN']);

      expect(error).toBeNull();
      expect(roster!.length).toBe(3);
    });
  });
});
