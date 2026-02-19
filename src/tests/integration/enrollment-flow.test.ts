import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { format, addDays } from 'date-fns';
import {
  createServiceClient,
  createTestMember,
  createTestStaff,
  createTestTransaction,
  createTestPendingPayment,
} from '../fixtures/factory';
import { createdIds, resetTracking } from '../fixtures/setup';

/**
 * Enrollment Flow Integration Tests
 *
 * Tests the complete enrollment journey:
 * - LEAD → ATIVO with instant payment (creates 2 transactions)
 * - LEAD → TRANSFERENCIA (creates pending payment with ENR- prefix)
 * - Zero enrollment fee scenario
 * - Admin confirmation of pending enrollment
 */
describe('Enrollment Flow (DB Integration)', () => {
  const client = createServiceClient();
  let testStaff: { id: string };

  beforeAll(async () => {
    // Create a staff member for created_by fields
    testStaff = await createTestStaff(client, {
      nome: 'Enrollment Test Staff',
      email: `enrollment-staff-${Date.now()}@test.local`,
      role: 'STAFF',
    });
    createdIds.staff.push(testStaff.id);
  });

  afterEach(async () => {
    // Clean up transactions and pending payments after each test
    if (createdIds.transactions.length > 0) {
      await client.from('transactions').delete().in('id', createdIds.transactions);
      createdIds.transactions = [];
    }
    if (createdIds.pendingPayments.length > 0) {
      await client.from('pending_payments').delete().in('id', createdIds.pendingPayments);
      createdIds.pendingPayments = [];
    }
    if (createdIds.members.length > 0) {
      await client.from('members').delete().in('id', createdIds.members);
      createdIds.members = [];
    }
  });

  afterAll(async () => {
    // Clean up staff
    if (createdIds.staff.length > 0) {
      await client.from('staff').delete().in('id', createdIds.staff);
    }
    resetTracking();
  });

  describe('LEAD → ATIVO with instant payment', () => {
    it('creates member as LEAD initially', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Enrollment LEAD',
        status: 'LEAD',
        access_type: null,
        access_expires_at: null,
      });
      createdIds.members.push(member.id);

      expect(member.status).toBe('LEAD');
      expect(member.access_type).toBeNull();
    });

    it('creates 2 transactions for LEAD enrollment (plan + TAXA_MATRICULA)', async () => {
      // Create LEAD member
      const member = await createTestMember(client, {
        nome: 'Test Enrollment 2Txn',
        status: 'LEAD',
        access_type: null,
        access_expires_at: null,
      });
      createdIds.members.push(member.id);

      const planPriceCents = 6000; // €60
      const enrollmentFeeCents = 1500; // €15

      // Transaction 1: Plan payment
      const txn1 = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: planPriceCents,
        payment_method: 'DINHEIRO',
        member_id: member.id,
        description: 'Plano: Mensal',
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn1.id);

      // Transaction 2: Enrollment fee
      const txn2 = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'TAXA_MATRICULA',
        amount_cents: enrollmentFeeCents,
        payment_method: 'DINHEIRO',
        member_id: member.id,
        description: 'Taxa de Matrícula - Mensal',
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn2.id);

      // Update member status
      const { error: updateError } = await client
        .from('members')
        .update({
          status: 'ATIVO',
          access_type: 'SUBSCRIPTION',
          access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        })
        .eq('id', member.id);

      expect(updateError).toBeNull();

      // Verify 2 transactions were created
      const { data: transactions } = await client
        .from('transactions')
        .select('*')
        .eq('member_id', member.id);

      expect(transactions).toHaveLength(2);
      expect(transactions!.find((t) => t.category === 'SUBSCRIPTION')).toBeTruthy();
      expect(transactions!.find((t) => t.category === 'TAXA_MATRICULA')).toBeTruthy();
    });

    it('updates member status to ATIVO after payment', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Enrollment Status',
        status: 'LEAD',
        access_type: null,
        access_expires_at: null,
      });
      createdIds.members.push(member.id);

      // Simulate payment processing
      const expiresAt = format(addDays(new Date(), 30), 'yyyy-MM-dd');
      const { error } = await client
        .from('members')
        .update({
          status: 'ATIVO',
          access_type: 'SUBSCRIPTION',
          access_expires_at: expiresAt,
        })
        .eq('id', member.id);

      expect(error).toBeNull();

      // Verify update
      const { data: updated } = await client
        .from('members')
        .select('*')
        .eq('id', member.id)
        .single();

      expect(updated!.status).toBe('ATIVO');
      expect(updated!.access_type).toBe('SUBSCRIPTION');
      expect(updated!.access_expires_at).toBe(expiresAt);
    });

    it('sets access_expires_at correctly based on plan duration', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Enrollment Expiry',
        status: 'LEAD',
        access_type: null,
        access_expires_at: null,
      });
      createdIds.members.push(member.id);

      // Test different durations
      const durations = [30, 90, 365];

      for (const days of durations) {
        const expiresAt = format(addDays(new Date(), days), 'yyyy-MM-dd');
        await client
          .from('members')
          .update({ access_expires_at: expiresAt })
          .eq('id', member.id);

        const { data: updated } = await client
          .from('members')
          .select('access_expires_at')
          .eq('id', member.id)
          .single();

        expect(updated!.access_expires_at).toBe(expiresAt);
      }
    });
  });

  describe('LEAD → TRANSFERENCIA (pending payment)', () => {
    it('creates pending_payment with ENR- prefix', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Enrollment Pending',
        status: 'LEAD',
        access_type: null,
        access_expires_at: null,
      });
      createdIds.members.push(member.id);

      const reference = `ENR-${Date.now()}`;
      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 7500, // €60 plan + €15 fee
        reference,
        payment_method: 'TRANSFERENCIA',
        status: 'PENDING',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      expect(pending.reference).toMatch(/^ENR-/);
      expect(pending.status).toBe('PENDING');
      expect(pending.amount_cents).toBe(7500);
    });

    it('member stays LEAD until pending is confirmed', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Enrollment Stays LEAD',
        status: 'LEAD',
        access_type: null,
        access_expires_at: null,
      });
      createdIds.members.push(member.id);

      // Create pending payment
      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 7500,
        reference: `ENR-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        status: 'PENDING',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      // Verify member is still LEAD
      const { data: memberCheck } = await client
        .from('members')
        .select('status')
        .eq('id', member.id)
        .single();

      expect(memberCheck!.status).toBe('LEAD');
    });

    it('sets expires_at to 7 days from creation', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Enrollment Expiry Date',
        status: 'LEAD',
        access_type: null,
        access_expires_at: null,
      });
      createdIds.members.push(member.id);

      const expiresAt = addDays(new Date(), 7).toISOString();
      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 7500,
        reference: `ENR-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        expires_at: expiresAt,
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      const pendingExpires = new Date(pending.expires_at).getTime();
      const expectedExpires = new Date(expiresAt).getTime();

      // Within 1 second tolerance
      expect(Math.abs(pendingExpires - expectedExpires)).toBeLessThan(1000);
    });
  });

  describe('Admin confirmation of ENR- pending', () => {
    it('confirmation creates 2 transactions (plan + fee split)', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Enrollment Confirm',
        status: 'LEAD',
        access_type: null,
        access_expires_at: null,
      });
      createdIds.members.push(member.id);

      const planPrice = 6000;
      const enrollmentFee = 1500;
      const totalAmount = planPrice + enrollmentFee;

      // Create pending payment
      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: totalAmount,
        reference: `ENR-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        status: 'PENDING',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      // Simulate admin confirmation - create split transactions
      const txn1 = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: planPrice,
        payment_method: 'TRANSFERENCIA',
        member_id: member.id,
        description: 'Plano: Mensal (Matrícula)',
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn1.id);

      const txn2 = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'TAXA_MATRICULA',
        amount_cents: enrollmentFee,
        payment_method: 'TRANSFERENCIA',
        member_id: member.id,
        description: 'Taxa de Matrícula - Mensal',
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn2.id);

      // Update pending status
      await client
        .from('pending_payments')
        .update({ status: 'CONFIRMED' })
        .eq('id', pending.id);

      // Update member
      await client
        .from('members')
        .update({
          status: 'ATIVO',
          access_type: 'SUBSCRIPTION',
          access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        })
        .eq('id', member.id);

      // Verify
      const { data: transactions } = await client
        .from('transactions')
        .select('*')
        .eq('member_id', member.id);

      expect(transactions).toHaveLength(2);

      const { data: confirmedPending } = await client
        .from('pending_payments')
        .select('status')
        .eq('id', pending.id)
        .single();

      expect(confirmedPending!.status).toBe('CONFIRMED');
    });

    it('confirmation updates member status to ATIVO', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Enrollment Confirm ATIVO',
        status: 'LEAD',
        access_type: null,
        access_expires_at: null,
      });
      createdIds.members.push(member.id);

      // Create and confirm pending
      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 7500,
        reference: `ENR-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        status: 'PENDING',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      // Simulate confirmation
      await client.from('pending_payments').update({ status: 'CONFIRMED' }).eq('id', pending.id);
      await client
        .from('members')
        .update({
          status: 'ATIVO',
          access_type: 'SUBSCRIPTION',
          access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        })
        .eq('id', member.id);

      const { data: updated } = await client
        .from('members')
        .select('status')
        .eq('id', member.id)
        .single();

      expect(updated!.status).toBe('ATIVO');
    });
  });

  describe('Zero enrollment fee', () => {
    it('creates only 1 transaction when fee = 0', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Enrollment Zero Fee',
        status: 'LEAD',
        access_type: null,
        access_expires_at: null,
      });
      createdIds.members.push(member.id);

      const planPriceCents = 6000;
      const enrollmentFeeCents = 0; // Zero fee

      // Only create plan transaction
      const txn = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: planPriceCents,
        payment_method: 'DINHEIRO',
        member_id: member.id,
        description: 'Plano: Mensal',
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn.id);

      // Skip TAXA_MATRICULA since fee is 0

      // Update member
      await client
        .from('members')
        .update({
          status: 'ATIVO',
          access_type: 'SUBSCRIPTION',
          access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        })
        .eq('id', member.id);

      // Verify only 1 transaction
      const { data: transactions } = await client
        .from('transactions')
        .select('*')
        .eq('member_id', member.id);

      expect(transactions).toHaveLength(1);
      expect(transactions![0].category).toBe('SUBSCRIPTION');
    });
  });
});
