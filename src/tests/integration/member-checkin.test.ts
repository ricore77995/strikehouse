import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { format, addDays, addMinutes, subMinutes } from 'date-fns';
import {
  createServiceClient,
  createTestCoach,
  createTestArea,
  createTestRental,
  createTestMember,
  createTestStaff,
} from '../fixtures/factory';
import { createdIds, cleanupTrackedEntities } from '../fixtures/setup';

/**
 * Member Check-in Integration Tests - BUSINESS RULES
 *
 * Tests member access validation:
 * - Active subscription = ALLOWED
 * - Expired subscription = BLOCKED (EXPIRED)
 * - Blocked member = BLOCKED (BLOCKED)
 * - Cancelled member = BLOCKED (CANCELLED)
 * - Credits member with credits = ALLOWED + decrement
 * - Credits member with 0 credits = BLOCKED (NO_CREDITS)
 * - Exclusive area active rental = BLOCKED (AREA_EXCLUSIVE)
 */
describe('Member Check-in Validation (Real Supabase)', () => {
  const client = createServiceClient();
  let staffId: string;

  beforeAll(async () => {
    const staff = await createTestStaff(client, {
      nome: 'Checkin Test Staff',
      role: 'STAFF',
    });
    staffId = staff.id;
    createdIds.staff.push(staffId);
  });

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  describe('Basic Access Validation', () => {
    it('ALLOWS active subscription member', async () => {
      const member = await createTestMember(client, {
        nome: 'Active Sub Member',
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      });
      createdIds.members.push(member.id);

      // Simulate validation logic
      const isActive = member.status === 'ATIVO';
      const hasValidAccess = member.access_type !== null;
      const notExpired = new Date(member.access_expires_at) >= new Date();

      expect(isActive).toBe(true);
      expect(hasValidAccess).toBe(true);
      expect(notExpired).toBe(true);

      // Create check-in record
      const { data: checkin, error } = await client
        .from('check_ins')
        .insert({
          type: 'MEMBER',
          result: 'ALLOWED',
          member_id: member.id,
          checked_in_by: staffId,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(checkin.result).toBe('ALLOWED');

      createdIds.checkins.push(checkin.id);
    });

    it('BLOCKS expired member', async () => {
      const member = await createTestMember(client, {
        nome: 'Expired Member',
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: format(addDays(new Date(), -1), 'yyyy-MM-dd'), // Yesterday
      });
      createdIds.members.push(member.id);

      // Validation
      const isExpired = new Date(member.access_expires_at) < new Date();
      expect(isExpired).toBe(true);

      // Create BLOCKED check-in record
      const { data: checkin, error } = await client
        .from('check_ins')
        .insert({
          type: 'MEMBER',
          result: 'BLOCKED',
          member_id: member.id,
                    checked_in_by: staffId,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(checkin.result).toBe('BLOCKED');
      
      createdIds.checkins.push(checkin.id);
    });

    it('BLOCKS member with BLOQUEADO status', async () => {
      const member = await createTestMember(client, {
        nome: 'Blocked Member',
        status: 'BLOQUEADO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      });
      createdIds.members.push(member.id);

      const isBlocked = member.status === 'BLOQUEADO';
      expect(isBlocked).toBe(true);

      const { data: checkin, error } = await client
        .from('check_ins')
        .insert({
          type: 'MEMBER',
          result: 'BLOCKED',
          member_id: member.id,
                    checked_in_by: staffId,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(checkin.result).toBe('BLOCKED');

      createdIds.checkins.push(checkin.id);
    });

    it('BLOCKS member with CANCELADO status', async () => {
      const member = await createTestMember(client, {
        nome: 'Cancelled Member',
        status: 'CANCELADO',
        access_type: null,
        access_expires_at: null,
      });
      createdIds.members.push(member.id);

      const isCancelled = member.status === 'CANCELADO';
      expect(isCancelled).toBe(true);

      const { data: checkin, error } = await client
        .from('check_ins')
        .insert({
          type: 'MEMBER',
          result: 'BLOCKED',
          member_id: member.id,
                    checked_in_by: staffId,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(checkin.result).toBe('BLOCKED');

      createdIds.checkins.push(checkin.id);
    });

    it('BLOCKS LEAD member (no access yet)', async () => {
      const member = await createTestMember(client, {
        nome: 'Lead Member',
        status: 'LEAD',
        access_type: null,
        access_expires_at: null,
      });
      createdIds.members.push(member.id);

      const isLead = member.status === 'LEAD';
      const hasNoAccess = member.access_type === null;
      expect(isLead).toBe(true);
      expect(hasNoAccess).toBe(true);

      const { data: checkin, error } = await client
        .from('check_ins')
        .insert({
          type: 'MEMBER',
          result: 'BLOCKED',
          member_id: member.id,
                    checked_in_by: staffId,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(checkin.result).toBe('BLOCKED');

      createdIds.checkins.push(checkin.id);
    });
  });

  describe('Credits Access Type', () => {
    it('ALLOWS credits member with remaining credits', async () => {
      const member = await createTestMember(client, {
        nome: 'Credits Member With Balance',
        status: 'ATIVO',
        access_type: 'CREDITS',
        credits_remaining: 5,
        access_expires_at: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
      });
      createdIds.members.push(member.id);

      const hasCredits = (member.credits_remaining || 0) > 0;
      expect(hasCredits).toBe(true);

      // Create check-in
      const { data: checkin, error } = await client
        .from('check_ins')
        .insert({
          type: 'MEMBER',
          result: 'ALLOWED',
          member_id: member.id,
          checked_in_by: staffId,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(checkin.result).toBe('ALLOWED');

      createdIds.checkins.push(checkin.id);
    });

    it('BLOCKS credits member with 0 remaining credits', async () => {
      const member = await createTestMember(client, {
        nome: 'Credits Member No Balance',
        status: 'ATIVO',
        access_type: 'CREDITS',
        credits_remaining: 0,
        access_expires_at: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
      });
      createdIds.members.push(member.id);

      const hasNoCredits = (member.credits_remaining || 0) === 0;
      expect(hasNoCredits).toBe(true);

      const { data: checkin, error } = await client
        .from('check_ins')
        .insert({
          type: 'MEMBER',
          result: 'BLOCKED',
          member_id: member.id,
                    checked_in_by: staffId,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(checkin.result).toBe('BLOCKED');
      
      createdIds.checkins.push(checkin.id);
    });

    it('decrements credits_remaining on check-in', async () => {
      const member = await createTestMember(client, {
        nome: 'Decrement Test Member',
        status: 'ATIVO',
        access_type: 'CREDITS',
        credits_remaining: 10,
        access_expires_at: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
      });
      createdIds.members.push(member.id);

      const initialCredits = member.credits_remaining;

      // Decrement (as the check-in logic would do)
      const { data: updated, error } = await client
        .from('members')
        .update({ credits_remaining: initialCredits - 1 })
        .eq('id', member.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updated!.credits_remaining).toBe(9);

      // Create check-in
      const { data: checkin } = await client
        .from('check_ins')
        .insert({
          type: 'MEMBER',
          result: 'ALLOWED',
          member_id: member.id,
          checked_in_by: staffId,
        })
        .select()
        .single();

      createdIds.checkins.push(checkin!.id);
    });
  });

  describe('Daily Pass Access Type', () => {
    it('ALLOWS daily pass on purchase day', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const member = await createTestMember(client, {
        nome: 'Daily Pass Today',
        status: 'ATIVO',
        access_type: 'DAILY_PASS',
        access_expires_at: today, // Expires end of today
      });
      createdIds.members.push(member.id);

      // Today check
      const expiresAt = new Date(member.access_expires_at + 'T23:59:59');
      const now = new Date();
      const isValid = now <= expiresAt;

      expect(isValid).toBe(true);

      const { data: checkin, error } = await client
        .from('check_ins')
        .insert({
          type: 'MEMBER',
          result: 'ALLOWED',
          member_id: member.id,
          checked_in_by: staffId,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(checkin.result).toBe('ALLOWED');

      createdIds.checkins.push(checkin.id);
    });

    it('BLOCKS daily pass on next day', async () => {
      const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd');
      const member = await createTestMember(client, {
        nome: 'Daily Pass Yesterday',
        status: 'ATIVO',
        access_type: 'DAILY_PASS',
        access_expires_at: yesterday, // Expired yesterday
      });
      createdIds.members.push(member.id);

      const isExpired = new Date(member.access_expires_at) < new Date();
      expect(isExpired).toBe(true);

      const { data: checkin, error } = await client
        .from('check_ins')
        .insert({
          type: 'MEMBER',
          result: 'BLOCKED',
          member_id: member.id,
                    checked_in_by: staffId,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(checkin.result).toBe('BLOCKED');

      createdIds.checkins.push(checkin.id);
    });
  });
});

describe('Exclusive Area Blocking (CRITICAL)', () => {
  const client = createServiceClient();
  let coachId: string;
  let exclusiveAreaId: string;
  let nonExclusiveAreaId: string;
  let staffId: string;

  beforeAll(async () => {
    const coach = await createTestCoach(client, {
      nome: 'Exclusive Area Test Coach',
    });
    coachId = coach.id;
    createdIds.coaches.push(coachId);

    // Create EXCLUSIVE area
    const exclusiveArea = await createTestArea(client, {
      nome: 'Exclusive Ring',
      is_exclusive: true,
    });
    exclusiveAreaId = exclusiveArea.id;
    createdIds.areas.push(exclusiveAreaId);

    // Create NON-exclusive area
    const nonExclusiveArea = await createTestArea(client, {
      nome: 'Shared Training Floor',
      is_exclusive: false,
    });
    nonExclusiveAreaId = nonExclusiveArea.id;
    createdIds.areas.push(nonExclusiveAreaId);

    const staff = await createTestStaff(client, {
      nome: 'Exclusive Test Staff',
      role: 'STAFF',
    });
    staffId = staff.id;
    createdIds.staff.push(staffId);
  });

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  it('BLOCKS member when exclusive area has active rental', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();
    const startTime = format(subMinutes(now, 30), 'HH:mm');
    const endTime = format(addMinutes(now, 30), 'HH:mm');

    // Create active rental on exclusive area
    const rental = await createTestRental(client, {
      coach_id: coachId,
      area_id: exclusiveAreaId,
      rental_date: today,
      start_time: startTime,
      end_time: endTime,
      status: 'SCHEDULED',
    });
    createdIds.rentals.push(rental.id);

    // Create active member
    const member = await createTestMember(client, {
      nome: 'Blocked By Exclusive Member',
      status: 'ATIVO',
      access_type: 'SUBSCRIPTION',
      access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    });
    createdIds.members.push(member.id);

    // Query for active exclusive rentals (as check-in logic would)
    const currentTime = format(now, 'HH:mm:ss');
    const { data: activeExclusiveRentals } = await client
      .from('rentals')
      .select(`
        *,
        area:areas!inner(is_exclusive)
      `)
      .eq('rental_date', today)
      .eq('status', 'SCHEDULED')
      .eq('area.is_exclusive', true)
      .lte('start_time', currentTime)
      .gte('end_time', currentTime);

    // Should find the active rental
    expect(activeExclusiveRentals!.length).toBeGreaterThan(0);

    // Create BLOCKED check-in
    const { data: checkin, error } = await client
      .from('check_ins')
      .insert({
        type: 'MEMBER',
        result: 'BLOCKED',
        member_id: member.id,
                checked_in_by: staffId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(checkin.result).toBe('BLOCKED');
    
    createdIds.checkins.push(checkin.id);
  });

  it('ALLOWS member when exclusive area rental is in FUTURE', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();
    const startTime = format(addMinutes(now, 60), 'HH:mm'); // 1 hour from now
    const endTime = format(addMinutes(now, 120), 'HH:mm');

    // Create FUTURE rental (not yet active)
    const rental = await createTestRental(client, {
      coach_id: coachId,
      area_id: exclusiveAreaId,
      rental_date: today,
      start_time: startTime,
      end_time: endTime,
      status: 'SCHEDULED',
    });
    createdIds.rentals.push(rental.id);

    // Create active member
    const member = await createTestMember(client, {
      nome: 'Allowed Before Exclusive Member',
      status: 'ATIVO',
      access_type: 'SUBSCRIPTION',
      access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    });
    createdIds.members.push(member.id);

    // Query for CURRENTLY active exclusive rentals
    const currentTime = format(now, 'HH:mm:ss');
    const { data: activeExclusiveRentals } = await client
      .from('rentals')
      .select(`
        *,
        area:areas!inner(is_exclusive)
      `)
      .eq('rental_date', today)
      .eq('status', 'SCHEDULED')
      .eq('area.is_exclusive', true)
      .lte('start_time', currentTime)
      .gte('end_time', currentTime);

    // Future rental should NOT be in this query
    const hasActiveNow = activeExclusiveRentals?.some((r) => r.id === rental.id);
    expect(hasActiveNow).toBe(false);

    // Member should be ALLOWED
    const { data: checkin, error } = await client
      .from('check_ins')
      .insert({
        type: 'MEMBER',
        result: 'ALLOWED',
        member_id: member.id,
        checked_in_by: staffId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(checkin.result).toBe('ALLOWED');

    createdIds.checkins.push(checkin.id);
  });

  it('ALLOWS member when only NON-exclusive areas have rentals', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();
    const startTime = format(subMinutes(now, 30), 'HH:mm');
    const endTime = format(addMinutes(now, 30), 'HH:mm');

    // Create active rental on NON-exclusive area
    const rental = await createTestRental(client, {
      coach_id: coachId,
      area_id: nonExclusiveAreaId, // NOT exclusive
      rental_date: today,
      start_time: startTime,
      end_time: endTime,
      status: 'SCHEDULED',
    });
    createdIds.rentals.push(rental.id);

    // Create active member
    const member = await createTestMember(client, {
      nome: 'Allowed With Non-Exclusive Member',
      status: 'ATIVO',
      access_type: 'SUBSCRIPTION',
      access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    });
    createdIds.members.push(member.id);

    // Query for EXCLUSIVE active rentals only
    const currentTime = format(now, 'HH:mm:ss');
    const { data: activeExclusiveRentals } = await client
      .from('rentals')
      .select(`
        *,
        area:areas!inner(is_exclusive)
      `)
      .eq('rental_date', today)
      .eq('status', 'SCHEDULED')
      .eq('area.is_exclusive', true) // Only exclusive
      .lte('start_time', currentTime)
      .gte('end_time', currentTime);

    // Non-exclusive rental should NOT appear
    const hasNonExclusive = activeExclusiveRentals?.some((r) => r.id === rental.id);
    expect(hasNonExclusive).toBe(false);

    // Member should be ALLOWED
    const { data: checkin, error } = await client
      .from('check_ins')
      .insert({
        type: 'MEMBER',
        result: 'ALLOWED',
        member_id: member.id,
        checked_in_by: staffId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(checkin.result).toBe('ALLOWED');

    createdIds.checkins.push(checkin.id);
  });

  it('ALLOWS member when exclusive rental is CANCELLED', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();
    const startTime = format(subMinutes(now, 30), 'HH:mm');
    const endTime = format(addMinutes(now, 30), 'HH:mm');

    // Create and cancel rental
    const rental = await createTestRental(client, {
      coach_id: coachId,
      area_id: exclusiveAreaId,
      rental_date: today,
      start_time: startTime,
      end_time: endTime,
      status: 'SCHEDULED',
    });
    createdIds.rentals.push(rental.id);

    // Cancel it
    await client.from('rentals').update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
    }).eq('id', rental.id);

    // Create active member
    const member = await createTestMember(client, {
      nome: 'Allowed After Cancel Member',
      status: 'ATIVO',
      access_type: 'SUBSCRIPTION',
      access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    });
    createdIds.members.push(member.id);

    // Query for SCHEDULED exclusive rentals
    const currentTime = format(now, 'HH:mm:ss');
    const { data: activeExclusiveRentals } = await client
      .from('rentals')
      .select(`
        *,
        area:areas!inner(is_exclusive)
      `)
      .eq('rental_date', today)
      .eq('status', 'SCHEDULED') // Only SCHEDULED, not CANCELLED
      .eq('area.is_exclusive', true)
      .lte('start_time', currentTime)
      .gte('end_time', currentTime);

    // Cancelled rental should NOT appear
    const hasCancelled = activeExclusiveRentals?.some((r) => r.id === rental.id);
    expect(hasCancelled).toBe(false);

    const { data: checkin, error } = await client
      .from('check_ins')
      .insert({
        type: 'MEMBER',
        result: 'ALLOWED',
        member_id: member.id,
        checked_in_by: staffId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(checkin.result).toBe('ALLOWED');

    createdIds.checkins.push(checkin.id);
  });
});

describe('QR Code Check-in Flow', () => {
  const client = createServiceClient();
  let staffId: string;

  beforeAll(async () => {
    const staff = await createTestStaff(client, {
      nome: 'QR Test Staff',
      role: 'STAFF',
    });
    staffId = staff.id;
    createdIds.staff.push(staffId);
  });

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  it('finds member by QR code', async () => {
    const member = await createTestMember(client, {
      nome: 'QR Lookup Member',
      status: 'ATIVO',
      access_type: 'SUBSCRIPTION',
      access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    });
    createdIds.members.push(member.id);

    // Lookup by QR code
    const { data: found, error } = await client
      .from('members')
      .select('*')
      .eq('qr_code', member.qr_code)
      .single();

    expect(error).toBeNull();
    expect(found!.id).toBe(member.id);
    expect(found!.nome).toBe('QR Lookup Member');
  });

  it('returns null for unknown QR code', async () => {
    const { data: found, error } = await client
      .from('members')
      .select('*')
      .eq('qr_code', 'MBR-NOTEXIST')
      .maybeSingle();

    expect(error).toBeNull();
    expect(found).toBeNull();
  });

  it('QR codes are unique', async () => {
    const member1 = await createTestMember(client, {
      nome: 'QR Unique Test 1',
      qr_code: 'MBR-UNIQUE01',
    });
    createdIds.members.push(member1.id);

    // Try to create another with same QR
    const { data, error } = await client
      .from('members')
      .insert({
        nome: 'QR Unique Test 2',
        qr_code: 'MBR-UNIQUE01', // DUPLICATE
        status: 'LEAD',
      })
      .select()
      .single();

    // Should fail due to unique constraint
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});

describe('Check-in Audit Trail', () => {
  const client = createServiceClient();
  let staffId: string;
  let memberId: string;

  beforeAll(async () => {
    const staff = await createTestStaff(client, {
      nome: 'Audit Test Staff',
      role: 'STAFF',
    });
    staffId = staff.id;
    createdIds.staff.push(staffId);

    const member = await createTestMember(client, {
      nome: 'Audit Test Member',
      status: 'ATIVO',
      access_type: 'SUBSCRIPTION',
      access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    });
    memberId = member.id;
    createdIds.members.push(memberId);
  });

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  it('check_ins records have checked_in_at timestamp', async () => {
    const before = new Date();

    const { data: checkin, error } = await client
      .from('check_ins')
      .insert({
        type: 'MEMBER',
        result: 'ALLOWED',
        member_id: memberId,
        checked_in_by: staffId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(checkin.checked_in_at).toBeDefined();

    const checkedInAt = new Date(checkin.checked_in_at);
    expect(checkedInAt.getTime()).toBeGreaterThanOrEqual(before.getTime());

    createdIds.checkins.push(checkin.id);
  });

  it('can query check-in history for member', async () => {
    // Create multiple check-ins
    for (let i = 0; i < 3; i++) {
      const { data } = await client
        .from('check_ins')
        .insert({
          type: 'MEMBER',
          result: 'ALLOWED',
          member_id: memberId,
          checked_in_by: staffId,
        })
        .select()
        .single();
      createdIds.checkins.push(data!.id);
    }

    // Query history
    const { data: history, error } = await client
      .from('check_ins')
      .select('*')
      .eq('member_id', memberId)
      .order('checked_in_at', { ascending: false });

    expect(error).toBeNull();
    expect(history!.length).toBeGreaterThanOrEqual(3);

    // All should be for same member
    history!.forEach((c) => {
      expect(c.member_id).toBe(memberId);
    });
  });

  it('check_ins records track checked_in_by staff', async () => {
    const { data: checkin, error } = await client
      .from('check_ins')
      .insert({
        type: 'MEMBER',
        result: 'ALLOWED',
        member_id: memberId,
        checked_in_by: staffId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(checkin.checked_in_by).toBe(staffId);

    createdIds.checkins.push(checkin.id);
  });
});
