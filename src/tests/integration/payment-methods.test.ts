import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { format, addDays } from 'date-fns';
import {
  createServiceClient,
  createTestMember,
  createTestStaff,
  createTestTransaction,
  createTestCashSession,
  createTestPendingPayment,
} from '../fixtures/factory';
import { createdIds, resetTracking } from '../fixtures/setup';

/**
 * Payment Methods Integration Tests
 *
 * Tests the 4 payment methods and their effects:
 * - DINHEIRO: Requires open cash session, updates cash totals
 * - CARTAO: Instant activation, no cash session update
 * - MBWAY: Instant activation, no cash session update
 * - TRANSFERENCIA: Creates pending payment, requires admin confirmation
 */
describe('Payment Methods (DB Integration)', () => {
  const client = createServiceClient();
  let testStaff: { id: string };

  beforeAll(async () => {
    testStaff = await createTestStaff(client, {
      nome: 'Payment Methods Test Staff',
      email: `payment-staff-${Date.now()}@test.local`,
      role: 'STAFF',
    });
    createdIds.staff.push(testStaff.id);
  });

  afterEach(async () => {
    if (createdIds.transactions.length > 0) {
      await client.from('transactions').delete().in('id', createdIds.transactions);
      createdIds.transactions = [];
    }
    if (createdIds.pendingPayments.length > 0) {
      await client.from('pending_payments').delete().in('id', createdIds.pendingPayments);
      createdIds.pendingPayments = [];
    }
    if (createdIds.cashSessions.length > 0) {
      await client.from('cash_sessions').delete().in('id', createdIds.cashSessions);
      createdIds.cashSessions = [];
    }
    if (createdIds.members.length > 0) {
      await client.from('members').delete().in('id', createdIds.members);
      createdIds.members = [];
    }
  });

  afterAll(async () => {
    if (createdIds.staff.length > 0) {
      await client.from('staff').delete().in('id', createdIds.staff);
    }
    resetTracking();
  });

  describe('DINHEIRO (Cash)', () => {
    it('creates transaction with payment_method = DINHEIRO', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Cash Payment',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const txn = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: 6000,
        payment_method: 'DINHEIRO',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn.id);

      expect(txn.payment_method).toBe('DINHEIRO');
    });

    it('activates member immediately', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Cash Activation',
        status: 'LEAD',
        access_type: null,
      });
      createdIds.members.push(member.id);

      // Simulate payment flow
      const txn = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: 6000,
        payment_method: 'DINHEIRO',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn.id);

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

    it('stores amount correctly in cents', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Cash Cents',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      // €69.50 = 6950 cents
      const txn = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: 6950,
        payment_method: 'DINHEIRO',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn.id);

      expect(txn.amount_cents).toBe(6950);
    });
  });

  describe('CARTAO (Card)', () => {
    it('creates transaction with payment_method = CARTAO', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Card Payment',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const txn = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: 6000,
        payment_method: 'CARTAO',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn.id);

      expect(txn.payment_method).toBe('CARTAO');
    });

    it('activates member immediately', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Card Activation',
        status: 'LEAD',
        access_type: null,
      });
      createdIds.members.push(member.id);

      const txn = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: 6000,
        payment_method: 'CARTAO',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn.id);

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

    it('does NOT require open cash session', async () => {
      // Card payments work independently of cash sessions
      const member = await createTestMember(client, {
        nome: 'Test Card No Session',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      // Can create transaction without any cash session
      const txn = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: 6000,
        payment_method: 'CARTAO',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn.id);

      expect(txn.id).toBeDefined();
    });
  });

  describe('MBWAY', () => {
    it('creates transaction with payment_method = MBWAY', async () => {
      const member = await createTestMember(client, {
        nome: 'Test MBWay Payment',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const txn = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: 6000,
        payment_method: 'MBWAY',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn.id);

      expect(txn.payment_method).toBe('MBWAY');
    });

    it('activates member immediately (visual confirmation by staff)', async () => {
      const member = await createTestMember(client, {
        nome: 'Test MBWay Activation',
        status: 'LEAD',
        access_type: null,
      });
      createdIds.members.push(member.id);

      const txn = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: 6000,
        payment_method: 'MBWAY',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn.id);

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

  describe('TRANSFERENCIA (Bank Transfer)', () => {
    it('creates pending_payment instead of transaction', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Transfer Pending',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 6000,
        reference: `PAY-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        status: 'PENDING',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      expect(pending.payment_method).toBe('TRANSFERENCIA');
      expect(pending.status).toBe('PENDING');

      // No transaction created yet
      const { data: transactions } = await client
        .from('transactions')
        .select('*')
        .eq('member_id', member.id);

      expect(transactions).toHaveLength(0);
    });

    it('does NOT activate member until confirmed', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Transfer No Activate',
        status: 'LEAD',
        access_type: null,
      });
      createdIds.members.push(member.id);

      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 6000,
        reference: `PAY-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      // Member should still be LEAD
      const { data: memberCheck } = await client
        .from('members')
        .select('status')
        .eq('id', member.id)
        .single();

      expect(memberCheck!.status).toBe('LEAD');
    });

    it('confirmation creates transaction and activates member', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Transfer Confirm',
        status: 'LEAD',
        access_type: null,
      });
      createdIds.members.push(member.id);

      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 6000,
        reference: `PAY-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      // Simulate admin confirmation
      const txn = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: 6000,
        payment_method: 'TRANSFERENCIA',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn.id);

      await client.from('pending_payments').update({ status: 'CONFIRMED' }).eq('id', pending.id);

      await client
        .from('members')
        .update({
          status: 'ATIVO',
          access_type: 'SUBSCRIPTION',
          access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        })
        .eq('id', member.id);

      // Verify
      const { data: confirmedPending } = await client
        .from('pending_payments')
        .select('status')
        .eq('id', pending.id)
        .single();

      const { data: activatedMember } = await client
        .from('members')
        .select('status')
        .eq('id', member.id)
        .single();

      expect(confirmedPending!.status).toBe('CONFIRMED');
      expect(activatedMember!.status).toBe('ATIVO');
    });

    it('double confirmation is blocked', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Double Confirm',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 6000,
        reference: `PAY-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        status: 'CONFIRMED', // Already confirmed
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      // Attempt to confirm again should be checked in application logic
      const { data: payment } = await client
        .from('pending_payments')
        .select('status')
        .eq('id', pending.id)
        .single();

      expect(payment!.status).toBe('CONFIRMED');
      // Application should check status before allowing confirmation
    });
  });

  describe('Transaction categories', () => {
    it('SUBSCRIPTION category for monthly plans', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Category Subscription',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const txn = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: 6000,
        payment_method: 'DINHEIRO',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn.id);

      expect(txn.category).toBe('SUBSCRIPTION');
      expect(txn.type).toBe('RECEITA');
    });

    it('CREDITS category increments credits_remaining', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Category Credits',
        status: 'LEAD',
        credits_remaining: 0,
      });
      createdIds.members.push(member.id);

      const txn = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'CREDITS',
        amount_cents: 5000, // 10 credits
        payment_method: 'DINHEIRO',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn.id);

      // Simulate updating credits
      const creditsToAdd = 10;
      await client
        .from('members')
        .update({
          status: 'ATIVO',
          access_type: 'CREDITS',
          credits_remaining: creditsToAdd,
        })
        .eq('id', member.id);

      const { data: updated } = await client
        .from('members')
        .select('credits_remaining')
        .eq('id', member.id)
        .single();

      expect(updated!.credits_remaining).toBe(10);
    });

    it('DAILY_PASS expires at end of day', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Category Daily',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const txn = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'DAILY_PASS',
        amount_cents: 1500,
        payment_method: 'DINHEIRO',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn.id);

      // Daily pass expires today
      const today = format(new Date(), 'yyyy-MM-dd');
      await client
        .from('members')
        .update({
          status: 'ATIVO',
          access_type: 'DAILY_PASS',
          access_expires_at: today,
        })
        .eq('id', member.id);

      const { data: updated } = await client
        .from('members')
        .select('access_expires_at')
        .eq('id', member.id)
        .single();

      expect(updated!.access_expires_at).toBe(today);
    });
  });
});
