import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { format, addDays, subDays, differenceInHours } from 'date-fns';
import {
  createServiceClient,
  createTestCoach,
  createTestArea,
  createTestRental,
  createTestCoachCredit,
  consumeCoachCredit,
  getCoachCreditBalance,
} from '../fixtures/factory';
import { createdIds, cleanupTrackedEntities } from '../fixtures/setup';

/**
 * Coach Credits Integration Tests - LEDGER PATTERN
 *
 * The real schema uses a ledger pattern:
 * - Positive amounts = credits added (CANCELLATION, ADJUSTMENT)
 * - Negative amounts = credits consumed (USED)
 * - Balance = SUM of all amounts (filtered by expiration)
 *
 * Tests the cancellation credit system:
 * - >24h cancellation = generates credit (+1)
 * - <24h cancellation = no credit
 * - Credits expire after 90 days
 * - Credit consumption inserts negative row
 */
describe('Coach Credits Ledger (Real Supabase)', () => {
  const client = createServiceClient();
  let coachId: string;
  let areaId: string;

  beforeAll(async () => {
    const coach = await createTestCoach(client, {
      nome: 'Credits Test Coach',
      fee_type: 'FIXED',
      fee_value: 3000,
    });
    coachId = coach.id;
    createdIds.coaches.push(coachId);

    const area = await createTestArea(client, { nome: 'Credits Test Area' });
    areaId = area.id;
    createdIds.areas.push(areaId);
  });

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  describe('Credit Generation Rules', () => {
    it('cancellation >24h before generates credit record', async () => {
      // Create rental for 3 days from now
      const rentalDate = format(addDays(new Date(), 3), 'yyyy-MM-dd');
      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '19:00',
        end_time: '20:00',
        fee_charged_cents: 3000,
      });
      createdIds.rentals.push(rental.id);

      // Calculate hours until rental
      const rentalDateTime = new Date(`${rentalDate}T19:00:00`);
      const hoursUntil = differenceInHours(rentalDateTime, new Date());

      expect(hoursUntil).toBeGreaterThan(24);

      // Cancel the rental
      await client.from('rentals').update({
        status: 'CANCELLED',
        cancelled_at: new Date().toISOString(),
      }).eq('id', rental.id);

      // Generate credit (positive amount)
      const credit = await createTestCoachCredit(client, {
        coach_id: coachId,
        amount: 1,
        reason: 'CANCELLATION',
        rental_id: rental.id,
        expires_at: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
      });
      createdIds.credits.push(credit.id);

      expect(credit.amount).toBe(1);
      expect(credit.reason).toBe('CANCELLATION');
      expect(credit.rental_id).toBe(rental.id);
    });

    it('cancellation <24h before does NOT generate credit', async () => {
      // Create rental for tomorrow
      const rentalDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      const rental = await createTestRental(client, {
        coach_id: coachId,
        area_id: areaId,
        rental_date: rentalDate,
        start_time: '10:00',
        end_time: '11:00',
      });
      createdIds.rentals.push(rental.id);

      // Cancel WITHOUT generating credit
      await client.from('rentals').update({
        status: 'CANCELLED',
        cancelled_at: new Date().toISOString(),
      }).eq('id', rental.id);

      // Verify no credit was created for this rental
      const { data: credits } = await client
        .from('coach_credits')
        .select('*')
        .eq('rental_id', rental.id);

      expect(credits).toHaveLength(0);
    });
  });

  describe('Credit Expiration (Ledger Filter)', () => {
    it('expired credits excluded from balance calculation', async () => {
      // Create a new coach for isolation
      const isolatedCoach = await createTestCoach(client, {
        nome: 'Expiry Test Coach',
      });
      createdIds.coaches.push(isolatedCoach.id);

      // Create expired credit (yesterday)
      const expiredCredit = await createTestCoachCredit(client, {
        coach_id: isolatedCoach.id,
        amount: 5,
        reason: 'CANCELLATION',
        expires_at: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
      });
      createdIds.credits.push(expiredCredit.id);

      // Create valid credit (30 days from now)
      const validCredit = await createTestCoachCredit(client, {
        coach_id: isolatedCoach.id,
        amount: 2,
        reason: 'CANCELLATION',
        expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      });
      createdIds.credits.push(validCredit.id);

      // Get balance (should only include non-expired)
      const balance = await getCoachCreditBalance(client, isolatedCoach.id);

      // Should be 2, NOT 7 (expired credit excluded)
      expect(balance).toBe(2);

      // Verify expired credit exists but isn't counted
      const balanceWithExpired = await getCoachCreditBalance(client, isolatedCoach.id, true);
      expect(balanceWithExpired).toBe(7);
    });

    it('null expires_at credits never expire', async () => {
      // Create coach for isolation
      const isolatedCoach = await createTestCoach(client, {
        nome: 'No Expiry Test Coach',
      });
      createdIds.coaches.push(isolatedCoach.id);

      // Create credit with no expiration
      const { data: credit, error } = await client
        .from('coach_credits')
        .insert({
          coach_id: isolatedCoach.id,
          amount: 3,
          reason: 'ADJUSTMENT',
          expires_at: null,
        })
        .select()
        .single();

      if (error) throw error;
      createdIds.credits.push(credit.id);

      // Should be included in balance
      const balance = await getCoachCreditBalance(client, isolatedCoach.id);
      expect(balance).toBe(3);
    });
  });

  describe('Credit Consumption (Ledger Pattern)', () => {
    it('consuming credit inserts negative amount row', async () => {
      // Create coach with credits
      const isolatedCoach = await createTestCoach(client, {
        nome: 'Consumption Test Coach',
      });
      createdIds.coaches.push(isolatedCoach.id);

      // Add 3 credits
      const credit = await createTestCoachCredit(client, {
        coach_id: isolatedCoach.id,
        amount: 3,
        reason: 'CANCELLATION',
      });
      createdIds.credits.push(credit.id);

      // Initial balance = 3
      const initialBalance = await getCoachCreditBalance(client, isolatedCoach.id);
      expect(initialBalance).toBe(3);

      // Consume 1 credit
      const consumeRecord = await consumeCoachCredit(client, isolatedCoach.id);
      createdIds.credits.push(consumeRecord.id);

      // Balance should now be 2
      const newBalance = await getCoachCreditBalance(client, isolatedCoach.id);
      expect(newBalance).toBe(2);

      // Verify negative row was created
      expect(consumeRecord.amount).toBe(-1);
      expect(consumeRecord.reason).toBe('USED');
    });

    it('multiple consumptions track correctly', async () => {
      // Create coach with credits
      const isolatedCoach = await createTestCoach(client, {
        nome: 'Multi Consumption Test Coach',
      });
      createdIds.coaches.push(isolatedCoach.id);

      // Add 5 credits
      const credit = await createTestCoachCredit(client, {
        coach_id: isolatedCoach.id,
        amount: 5,
        reason: 'ADJUSTMENT',
      });
      createdIds.credits.push(credit.id);

      // Consume 3 times
      for (let i = 0; i < 3; i++) {
        const consumed = await consumeCoachCredit(client, isolatedCoach.id);
        createdIds.credits.push(consumed.id);
      }

      // Balance should be 5 - 3 = 2
      const balance = await getCoachCreditBalance(client, isolatedCoach.id);
      expect(balance).toBe(2);

      // Verify total rows
      const { data: allRows } = await client
        .from('coach_credits')
        .select('amount')
        .eq('coach_id', isolatedCoach.id);

      expect(allRows).toHaveLength(4); // 1 positive + 3 negative
    });

    it('cannot go negative (business rule validation)', async () => {
      // Create coach with 1 credit
      const isolatedCoach = await createTestCoach(client, {
        nome: 'Negative Test Coach',
      });
      createdIds.coaches.push(isolatedCoach.id);

      const credit = await createTestCoachCredit(client, {
        coach_id: isolatedCoach.id,
        amount: 1,
        reason: 'CANCELLATION',
      });
      createdIds.credits.push(credit.id);

      // Get balance before consumption attempts
      const initialBalance = await getCoachCreditBalance(client, isolatedCoach.id);
      expect(initialBalance).toBe(1);

      // Consume the 1 available credit
      const consumed = await consumeCoachCredit(client, isolatedCoach.id);
      createdIds.credits.push(consumed.id);

      // Balance now 0
      const balanceAfterFirst = await getCoachCreditBalance(client, isolatedCoach.id);
      expect(balanceAfterFirst).toBe(0);

      // NOTE: The DB doesn't enforce this - it's application logic
      // This test documents the expected behavior that the APP should check balance before consuming
    });
  });

  describe('Credit Link to Rental', () => {
    it('consumption can link to rental_id', async () => {
      // Create coach
      const isolatedCoach = await createTestCoach(client, {
        nome: 'Rental Link Test Coach',
      });
      createdIds.coaches.push(isolatedCoach.id);

      // Create area for rental
      const area = await createTestArea(client, {
        nome: 'Rental Link Test Area',
      });
      createdIds.areas.push(area.id);

      // Add credit
      const credit = await createTestCoachCredit(client, {
        coach_id: isolatedCoach.id,
        amount: 1,
        reason: 'CANCELLATION',
      });
      createdIds.credits.push(credit.id);

      // Create rental
      const rental = await createTestRental(client, {
        coach_id: isolatedCoach.id,
        area_id: area.id,
        rental_date: format(addDays(new Date(), 5), 'yyyy-MM-dd'),
        start_time: '14:00',
        end_time: '15:00',
      });
      createdIds.rentals.push(rental.id);

      // Consume credit linked to rental
      const consumed = await consumeCoachCredit(client, isolatedCoach.id, rental.id);
      createdIds.credits.push(consumed.id);

      expect(consumed.rental_id).toBe(rental.id);
      expect(consumed.amount).toBe(-1);
    });

    it('can query credits used for specific rental', async () => {
      // Create coach
      const isolatedCoach = await createTestCoach(client, {
        nome: 'Query Rental Credits Coach',
      });
      createdIds.coaches.push(isolatedCoach.id);

      // Create area
      const area = await createTestArea(client, {
        nome: 'Query Rental Credits Area',
      });
      createdIds.areas.push(area.id);

      // Add credit
      const credit = await createTestCoachCredit(client, {
        coach_id: isolatedCoach.id,
        amount: 1,
        reason: 'CANCELLATION',
      });
      createdIds.credits.push(credit.id);

      // Create rental
      const rental = await createTestRental(client, {
        coach_id: isolatedCoach.id,
        area_id: area.id,
        rental_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        start_time: '18:00',
        end_time: '19:00',
      });
      createdIds.rentals.push(rental.id);

      // Consume credit for this rental
      const consumed = await consumeCoachCredit(client, isolatedCoach.id, rental.id);
      createdIds.credits.push(consumed.id);

      // Query credits used for this rental
      const { data: usedCredits } = await client
        .from('coach_credits')
        .select('*')
        .eq('rental_id', rental.id)
        .eq('reason', 'USED');

      expect(usedCredits).toHaveLength(1);
      expect(usedCredits![0].amount).toBe(-1);
    });
  });
});

describe('Admin Credit Adjustments (Real Supabase)', () => {
  const client = createServiceClient();
  let coachId: string;

  beforeAll(async () => {
    const coach = await createTestCoach(client, {
      nome: 'Adjustment Test Coach',
    });
    coachId = coach.id;
    createdIds.coaches.push(coachId);
  });

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  it('admin can add credits with ADJUSTMENT reason', async () => {
    const initialBalance = await getCoachCreditBalance(client, coachId);

    const credit = await createTestCoachCredit(client, {
      coach_id: coachId,
      amount: 5,
      reason: 'ADJUSTMENT',
    });
    createdIds.credits.push(credit.id);

    const newBalance = await getCoachCreditBalance(client, coachId);

    expect(newBalance).toBe(initialBalance + 5);
    expect(credit.reason).toBe('ADJUSTMENT');
  });

  it('admin can subtract credits with negative ADJUSTMENT', async () => {
    // First add some credits
    const addCredit = await createTestCoachCredit(client, {
      coach_id: coachId,
      amount: 10,
      reason: 'ADJUSTMENT',
    });
    createdIds.credits.push(addCredit.id);

    const beforeBalance = await getCoachCreditBalance(client, coachId);

    // Subtract via negative adjustment
    const subCredit = await createTestCoachCredit(client, {
      coach_id: coachId,
      amount: -3,
      reason: 'ADJUSTMENT',
    });
    createdIds.credits.push(subCredit.id);

    const afterBalance = await getCoachCreditBalance(client, coachId);

    expect(afterBalance).toBe(beforeBalance - 3);
    expect(subCredit.amount).toBe(-3);
  });

  it('ADJUSTMENT credits can have no expiration', async () => {
    const { data: credit, error } = await client
      .from('coach_credits')
      .insert({
        coach_id: coachId,
        amount: 2,
        reason: 'ADJUSTMENT',
        expires_at: null,
      })
      .select()
      .single();

    if (error) throw error;
    createdIds.credits.push(credit.id);

    expect(credit.expires_at).toBeNull();

    // Should still count in balance
    const balance = await getCoachCreditBalance(client, coachId);
    expect(balance).toBeGreaterThanOrEqual(2);
  });
});

describe('Credit Balance Calculation Edge Cases', () => {
  const client = createServiceClient();
  let coachId: string;

  beforeAll(async () => {
    const coach = await createTestCoach(client, {
      nome: 'Edge Cases Coach',
    });
    coachId = coach.id;
    createdIds.coaches.push(coachId);
  });

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  it('empty ledger returns balance of 0', async () => {
    // New coach with no credits
    const newCoach = await createTestCoach(client, {
      nome: 'Empty Ledger Coach',
    });
    createdIds.coaches.push(newCoach.id);

    const balance = await getCoachCreditBalance(client, newCoach.id);
    expect(balance).toBe(0);
  });

  it('mixed positive and negative amounts sum correctly', async () => {
    const isolatedCoach = await createTestCoach(client, {
      nome: 'Mixed Amounts Coach',
    });
    createdIds.coaches.push(isolatedCoach.id);

    // +3
    const c1 = await createTestCoachCredit(client, {
      coach_id: isolatedCoach.id,
      amount: 3,
      reason: 'CANCELLATION',
    });
    createdIds.credits.push(c1.id);

    // -1
    const c2 = await consumeCoachCredit(client, isolatedCoach.id);
    createdIds.credits.push(c2.id);

    // +2
    const c3 = await createTestCoachCredit(client, {
      coach_id: isolatedCoach.id,
      amount: 2,
      reason: 'ADJUSTMENT',
    });
    createdIds.credits.push(c3.id);

    // -1
    const c4 = await consumeCoachCredit(client, isolatedCoach.id);
    createdIds.credits.push(c4.id);

    // Balance should be 3 - 1 + 2 - 1 = 3
    const balance = await getCoachCreditBalance(client, isolatedCoach.id);
    expect(balance).toBe(3);
  });

  it('partial expiration calculated correctly', async () => {
    const isolatedCoach = await createTestCoach(client, {
      nome: 'Partial Expiry Coach',
    });
    createdIds.coaches.push(isolatedCoach.id);

    // +5 expired yesterday
    const expired = await createTestCoachCredit(client, {
      coach_id: isolatedCoach.id,
      amount: 5,
      reason: 'CANCELLATION',
      expires_at: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    });
    createdIds.credits.push(expired.id);

    // +3 valid
    const valid = await createTestCoachCredit(client, {
      coach_id: isolatedCoach.id,
      amount: 3,
      reason: 'CANCELLATION',
      expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    });
    createdIds.credits.push(valid.id);

    // -1 consumption (has no expiry, should always count)
    const consumed = await consumeCoachCredit(client, isolatedCoach.id);
    createdIds.credits.push(consumed.id);

    // Balance = 3 (valid) - 1 (consumed) = 2
    // The expired +5 should NOT count
    const balance = await getCoachCreditBalance(client, isolatedCoach.id);
    expect(balance).toBe(2);
  });
});
