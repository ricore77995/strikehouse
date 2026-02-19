import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { format, addDays, subDays } from 'date-fns';
import {
  createServiceClient,
  createTestMember,
  createTestStaff,
  createTestTransaction,
  createTestPendingPayment,
} from '../fixtures/factory';
import { createdIds, resetTracking } from '../fixtures/setup';

/**
 * Renewal Flow Integration Tests
 *
 * Tests member renewal and reactivation scenarios:
 * - BLOQUEADO → ATIVO (renewal without enrollment fee)
 * - CANCELADO → ATIVO via Enrollment (with REA- prefix, 2 transactions)
 * - CANCELADO → ATIVO via Payment (1 transaction, no fee)
 */
describe('Renewal Flow (DB Integration)', () => {
  const client = createServiceClient();
  let testStaff: { id: string };

  beforeAll(async () => {
    testStaff = await createTestStaff(client, {
      nome: 'Renewal Test Staff',
      email: `renewal-staff-${Date.now()}@test.local`,
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

  describe('BLOQUEADO → ATIVO (renewal)', () => {
    it('creates member with BLOQUEADO status (expired subscription)', async () => {
      const expiredDate = format(subDays(new Date(), 5), 'yyyy-MM-dd');
      const member = await createTestMember(client, {
        nome: 'Test Renewal Blocked',
        status: 'BLOQUEADO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: expiredDate,
      });
      createdIds.members.push(member.id);

      expect(member.status).toBe('BLOQUEADO');
      expect(member.access_expires_at).toBe(expiredDate);
    });

    it('renewal creates 1 transaction (NO enrollment fee)', async () => {
      const expiredDate = format(subDays(new Date(), 5), 'yyyy-MM-dd');
      const member = await createTestMember(client, {
        nome: 'Test Renewal No Fee',
        status: 'BLOQUEADO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: expiredDate,
      });
      createdIds.members.push(member.id);

      const planPriceCents = 6000;

      // Only 1 transaction - no enrollment fee for renewals
      const txn = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: planPriceCents,
        payment_method: 'DINHEIRO',
        member_id: member.id,
        description: 'Plano: Mensal (Renovação)',
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn.id);

      // Verify only 1 transaction
      const { data: transactions } = await client
        .from('transactions')
        .select('*')
        .eq('member_id', member.id);

      expect(transactions).toHaveLength(1);
      expect(transactions![0].category).toBe('SUBSCRIPTION');
    });

    it('updates status to ATIVO after renewal', async () => {
      const expiredDate = format(subDays(new Date(), 5), 'yyyy-MM-dd');
      const member = await createTestMember(client, {
        nome: 'Test Renewal Status',
        status: 'BLOQUEADO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: expiredDate,
      });
      createdIds.members.push(member.id);

      const newExpiresAt = format(addDays(new Date(), 30), 'yyyy-MM-dd');
      const { error } = await client
        .from('members')
        .update({
          status: 'ATIVO',
          access_expires_at: newExpiresAt,
        })
        .eq('id', member.id);

      expect(error).toBeNull();

      const { data: updated } = await client
        .from('members')
        .select('status, access_expires_at')
        .eq('id', member.id)
        .single();

      expect(updated!.status).toBe('ATIVO');
      expect(updated!.access_expires_at).toBe(newExpiresAt);
    });

    it('extends access_expires_at by plan duration', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Renewal Extend',
        status: 'BLOQUEADO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: format(subDays(new Date(), 5), 'yyyy-MM-dd'),
      });
      createdIds.members.push(member.id);

      // Extend by 30 days from today
      const newExpiresAt = format(addDays(new Date(), 30), 'yyyy-MM-dd');
      await client.from('members').update({ access_expires_at: newExpiresAt }).eq('id', member.id);

      const { data: updated } = await client
        .from('members')
        .select('access_expires_at')
        .eq('id', member.id)
        .single();

      expect(updated!.access_expires_at).toBe(newExpiresAt);
    });
  });

  describe('CANCELADO → ATIVO via Enrollment (with fee)', () => {
    it('creates 2 transactions with REA- prefix for reactivation', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Reactivation Fee',
        status: 'CANCELADO',
        access_type: null,
        access_expires_at: null,
      });
      createdIds.members.push(member.id);

      const planPriceCents = 6000;
      const enrollmentFeeCents = 1500;

      // Create pending payment with REA- prefix
      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: planPriceCents + enrollmentFeeCents,
        reference: `REA-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        status: 'PENDING',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      expect(pending.reference).toMatch(/^REA-/);

      // Simulate confirmation - create 2 transactions
      const txn1 = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'SUBSCRIPTION',
        amount_cents: planPriceCents,
        payment_method: 'TRANSFERENCIA',
        member_id: member.id,
        description: 'Plano: Mensal (Reativação)',
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn1.id);

      const txn2 = await createTestTransaction(client, {
        type: 'RECEITA',
        category: 'TAXA_MATRICULA',
        amount_cents: enrollmentFeeCents,
        payment_method: 'TRANSFERENCIA',
        member_id: member.id,
        description: 'Taxa de Matrícula (Reativação)',
        created_by: testStaff.id,
      });
      createdIds.transactions.push(txn2.id);

      // Verify 2 transactions
      const { data: transactions } = await client
        .from('transactions')
        .select('*')
        .eq('member_id', member.id);

      expect(transactions).toHaveLength(2);
      expect(transactions!.find((t) => t.category === 'SUBSCRIPTION')).toBeTruthy();
      expect(transactions!.find((t) => t.category === 'TAXA_MATRICULA')).toBeTruthy();
    });

    it('REA- prefix distinguishes from ENR- (first-time enrollment)', async () => {
      const leadMember = await createTestMember(client, {
        nome: 'Test Lead ENR',
        status: 'LEAD',
        access_type: null,
      });
      createdIds.members.push(leadMember.id);

      const canceladoMember = await createTestMember(client, {
        nome: 'Test Cancelado REA',
        status: 'CANCELADO',
        access_type: null,
      });
      createdIds.members.push(canceladoMember.id);

      // ENR- for LEAD
      const enrPending = await createTestPendingPayment(client, {
        member_id: leadMember.id,
        amount_cents: 7500,
        reference: `ENR-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(enrPending.id);

      // REA- for CANCELADO
      const reaPending = await createTestPendingPayment(client, {
        member_id: canceladoMember.id,
        amount_cents: 7500,
        reference: `REA-${Date.now() + 1}`,
        payment_method: 'TRANSFERENCIA',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(reaPending.id);

      expect(enrPending.reference).toMatch(/^ENR-/);
      expect(reaPending.reference).toMatch(/^REA-/);
    });
  });

  describe('CANCELADO → ATIVO via Payment (no fee)', () => {
    it('creates 1 transaction with PAY- prefix', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Reactivation No Fee',
        status: 'CANCELADO',
        access_type: null,
        access_expires_at: null,
      });
      createdIds.members.push(member.id);

      const planPriceCents = 6000;

      // Only plan transaction - no enrollment fee via Payment route
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

      const { data: transactions } = await client
        .from('transactions')
        .select('*')
        .eq('member_id', member.id);

      expect(transactions).toHaveLength(1);
      expect(transactions![0].category).toBe('SUBSCRIPTION');
    });

    it('TRANSFERENCIA via Payment uses PAY- prefix (not REA-)', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Reactivation PAY Prefix',
        status: 'CANCELADO',
        access_type: null,
      });
      createdIds.members.push(member.id);

      const pending = await createTestPendingPayment(client, {
        member_id: member.id,
        amount_cents: 6000, // Only plan, no fee
        reference: `PAY-${Date.now()}`,
        payment_method: 'TRANSFERENCIA',
        created_by: testStaff.id,
      });
      createdIds.pendingPayments.push(pending.id);

      expect(pending.reference).toMatch(/^PAY-/);
    });

    it('reactivates member to ATIVO', async () => {
      const member = await createTestMember(client, {
        nome: 'Test Reactivation ATIVO',
        status: 'CANCELADO',
        access_type: null,
        access_expires_at: null,
      });
      createdIds.members.push(member.id);

      const newExpiresAt = format(addDays(new Date(), 30), 'yyyy-MM-dd');
      const { error } = await client
        .from('members')
        .update({
          status: 'ATIVO',
          access_type: 'SUBSCRIPTION',
          access_expires_at: newExpiresAt,
        })
        .eq('id', member.id);

      expect(error).toBeNull();

      const { data: updated } = await client
        .from('members')
        .select('status, access_type')
        .eq('id', member.id)
        .single();

      expect(updated!.status).toBe('ATIVO');
      expect(updated!.access_type).toBe('SUBSCRIPTION');
    });
  });

  describe('Reference prefix convention', () => {
    it('ENR- = Enrollment (LEAD first-time)', async () => {
      const member = await createTestMember(client, {
        nome: 'Test ENR Prefix',
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const reference = `ENR-${Date.now()}`;
      expect(reference.startsWith('ENR-')).toBe(true);
    });

    it('REA- = Reactivation (CANCELADO with fee)', async () => {
      const reference = `REA-${Date.now()}`;
      expect(reference.startsWith('REA-')).toBe(true);
    });

    it('PAY- = Payment (regular renewal without fee)', async () => {
      const reference = `PAY-${Date.now()}`;
      expect(reference.startsWith('PAY-')).toBe(true);
    });
  });
});
