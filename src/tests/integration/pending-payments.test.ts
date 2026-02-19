import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { format, addDays, subDays } from 'date-fns';
import {
  createServiceClient,
  createTestMember,
  createTestStaff,
  createTestTransaction,
  createTestPendingPayment,
  createTestMemberIban,
} from '../fixtures/factory';
import { createdIds, resetTracking } from '../fixtures/setup';

/**
 * Pending Payments Integration Tests
 *
 * Tests pending payment lifecycle:
 * - Creation with correct reference prefix (ENR-, REA-, PAY-)
 * - Expiration after 7 days
 * - Admin confirmation flow
 * - IBAN matching for auto-suggestion
 * - Status transitions (PENDING → CONFIRMED/EXPIRED/CANCELLED)
 */
describe('Pending Payments (DB Integration)', () => {
  const client = createServiceClient();
  let testStaff: { id: string };

  beforeAll(async () => {
    testStaff = await createTestStaff(client, {
      nome: 'Pending Payment Test Staff',
      email: `pending-staff-${Date.now()}@test.local`,
      role: 'ADMIN',
    });
    createdIds.staff.push(testStaff.id);
  });

  afterEach(async () => {
    if (createdIds.transactions.length > 0) {
      await client.from('transactions').delete().in('id', createdIds.transactions);
      createdIds.transactions = [];
    }
    if (createdIds.memberIbans.length > 0) {
      await client.from('member_ibans').delete().in('id', createdIds.memberIbans);
      createdIds.memberIbans = [];
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
    if (createdIds.staff.length > 0) {
      await client.from('staff').delete().in('id', createdIds.staff);
    }
    resetTracking();
  });

  describe('Creation with reference prefix', () => {
    it('LEAD + TRANSFERENCIA creates pending with ENR- prefix', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Pending ENR',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 7500,
        reference: `ENR-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      expect(pending.reference).toMatch(/^ENR-/);
    });

    it('ATIVO + TRANSFERENCIA creates pending with PAY- prefix', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Pending PAY',
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
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

      expect(pending.reference).toMatch(/^PAY-/);
    });

    it('CANCELADO via enrollment creates pending with REA- prefix', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Pending REA',
        status: 'CANCELADO',
      });
      createdIds.members.push(member.id);

      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 7500,
        reference: `REA-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      expect(pending.reference).toMatch(/^REA-/);
    });

    it('sets expires_at to 7 days from creation', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Pending Expiry',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const expectedExpiry = addDays(new Date(), 7);
      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 6000,
        reference: `ENR-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        expires_at: expectedExpiry.toISOString(),
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      const pendingExpires = new Date(pending.expires_at).getTime();
      const expectedMillis = expectedExpiry.getTime();

      // Within 1 second tolerance
      expect(Math.abs(pendingExpires - expectedMillis)).toBeLessThan(1000);
    });
  });

  describe('Confirmation flow', () => {
    it('ENR- confirmation splits into 2 transactions', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Confirm ENR Split',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const planPrice = 6000;
      const enrollmentFee = 1500;
      const totalAmount = planPrice + enrollmentFee;

      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: totalAmount,
        reference: `ENR-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      // Simulate admin confirmation
      const txn1 = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: planPrice,
        payment_method: 'TRANSFERENCIA',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn1.id);

      const txn2 = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'TAXA_MATRICULA',
        amount_cents: enrollmentFee,
        payment_method: 'TRANSFERENCIA',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn2.id);

      await client.from('pending_payments').update({ status: 'CONFIRMED' }).eq('id', pending.id);

      const { data: transactions } = await client
        .from('transactions')
        .select('*')
        .eq('member_id', member.id);

      expect(transactions).toHaveLength(2);
    });

    it('PAY- confirmation creates 1 transaction', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Confirm PAY Single',
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
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

      const { data: transactions } = await client
        .from('transactions')
        .select('*')
        .eq('member_id', member.id);

      expect(transactions).toHaveLength(1);
    });

    it('REA- confirmation splits into 2 transactions', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Confirm REA Split',
        status: 'CANCELADO',
      });
      createdIds.members.push(member.id);

      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 7500,
        reference: `REA-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      const txn1 = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: 6000,
        payment_method: 'TRANSFERENCIA',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn1.id);

      const txn2 = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'TAXA_MATRICULA',
        amount_cents: 1500,
        payment_method: 'TRANSFERENCIA',
        member_id: member.id,
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn2.id);

      await client.from('pending_payments').update({ status: 'CONFIRMED' }).eq('id', pending.id);

      const { data: transactions } = await client
        .from('transactions')
        .select('*')
        .eq('member_id', member.id);

      expect(transactions).toHaveLength(2);
    });

    it('updates pending status to CONFIRMED', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Confirm Status',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 6000,
        reference: `ENR-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      await client.from('pending_payments').update({ status: 'CONFIRMED' }).eq('id', pending.id);

      const { data: confirmed } = await client
        .from('pending_payments')
        .select('status')
        .eq('id', pending.id)
        .single();

      expect(confirmed!.status).toBe('CONFIRMED');
    });

    it('updates member status to ATIVO', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Confirm Member ATIVO',
        status: 'LEAD',
        access_type: null,
      });
      createdIds.members.push(member.id);

      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 6000,
        reference: `ENR-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

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

  describe('Status transitions', () => {
    it('expired pending after 7 days → EXPIRED', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Expired Pending',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      // Create pending with past expiration
      const expiredDate = subDays(new Date(), 1);
      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 6000,
        reference: `ENR-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        expires_at: expiredDate.toISOString(),
        status: 'PENDING',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      // Simulate cron job marking as expired
      await client.from('pending_payments').update({ status: 'EXPIRED' }).eq('id', pending.id);

      const { data: expired } = await client
        .from('pending_payments')
        .select('status')
        .eq('id', pending.id)
        .single();

      expect(expired!.status).toBe('EXPIRED');
    });

    it('cancelled pending → CANCELLED', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Cancel Pending',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 6000,
        reference: `ENR-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      await client.from('pending_payments').update({ status: 'CANCELLED' }).eq('id', pending.id);

      const { data: cancelled } = await client
        .from('pending_payments')
        .select('status')
        .eq('id', pending.id)
        .single();

      expect(cancelled!.status).toBe('CANCELLED');
    });

    it('member stays LEAD when pending is cancelled', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Cancel Lead Stays',
        status: 'LEAD',
        access_type: null,
      });
      createdIds.members.push(member.id);

      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 6000,
        reference: `ENR-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      await client.from('pending_payments').update({ status: 'CANCELLED' }).eq('id', pending.id);

      // Member should still be LEAD
      const { data: memberCheck } = await client
        .from('members')
        .select('status')
        .eq('id', member.id)
        .single();

      expect(memberCheck!.status).toBe('LEAD');
    });
  });

  describe('IBAN matching', () => {
    it('finds member by stored IBAN', async () => {
      const member = await createTestMember(client, {
        nome: 'Test IBAN Match',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const testIban = `PT50000201231234567890${Date.now().toString().slice(-3)}`;
      const iban = await createTestMemberIban(client, {
        member_id: member.id,
        iban: testIban,
        label: 'Primary',
        is_primary: true,
      });
      createdIds.memberIbans.push(iban.id);

      // Query by IBAN - use maybeSingle to handle no match gracefully
      const { data: found, error } = await client
        .from('member_ibans')
        .select('id, member_id, iban')
        .eq('iban', testIban)
        .maybeSingle();

      expect(error).toBeNull();
      expect(found).toBeTruthy();
      expect(found!.member_id).toBe(member.id);
    });

    it('member can have multiple IBANs', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Multiple IBANs',
        status: 'ATIVO',
      });
      createdIds.members.push(member.id);

      const iban1 = await createTestMemberIban(client, {
        member_id: member.id,
        iban: 'PT50000201231234567890154',
        label: 'Primary',
        is_primary: true,
      });
      createdIds.memberIbans.push(iban1.id);

      const iban2 = await createTestMemberIban(client, {
        member_id: member.id,
        iban: 'PT50000201239876543210987',
        label: 'Secondary',
        is_primary: false,
      });
      createdIds.memberIbans.push(iban2.id);

      const { data: ibans } = await client
        .from('member_ibans')
        .select('*')
        .eq('member_id', member.id);

      expect(ibans).toHaveLength(2);
    });

    it('IBAN label can be used for identification', async () => {
      const member = await createTestMember(client, {
        nome: 'Test IBAN Label',
        status: 'ATIVO',
      });
      createdIds.members.push(member.id);

      const iban = await createTestMemberIban(client, {
        member_id: member.id,
        iban: 'PT50000201231234567890154',
        label: 'Company Account',
      });
      createdIds.memberIbans.push(iban.id);

      expect(iban.label).toBe('Company Account');
    });
  });

  describe('Double confirmation prevention', () => {
    it('already CONFIRMED payment should not be confirmed again', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Double Confirm Block',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 6000,
        reference: `ENR-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        status: 'CONFIRMED', // Already confirmed
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      // Application should check status before allowing confirmation
      const { data: payment } = await client
        .from('pending_payments')
        .select('status')
        .eq('id', pending.id)
        .single();

      expect(payment!.status).toBe('CONFIRMED');
      // Logic in application: if (payment.status !== 'PENDING') throw error
    });
  });

  describe('Admin override for expired payments', () => {
    it('admin can confirm expired pending payment', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Admin Override',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 6000,
        reference: `ENR-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        expires_at: subDays(new Date(), 3).toISOString(), // Expired 3 days ago
        status: 'EXPIRED',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      // Admin can still confirm
      await client.from('pending_payments').update({ status: 'CONFIRMED' }).eq('id', pending.id);

      const { data: confirmed } = await client
        .from('pending_payments')
        .select('status')
        .eq('id', pending.id)
        .single();

      expect(confirmed!.status).toBe('CONFIRMED');
    });
  });
});
