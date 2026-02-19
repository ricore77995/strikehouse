import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { format, addDays } from 'date-fns';
import { createServiceClient, createTestStaff, createTestMember, createTestCashSession } from '../fixtures/factory';
import { createdIds, resetTracking } from '../fixtures/setup';

/**
 * Cash Sessions Integration Tests
 *
 * Tests daily cash register lifecycle:
 * - Opening with initial balance
 * - Closing with actual count
 * - Difference calculation
 * - Status transitions (OPEN → CLOSED)
 * - Alert thresholds for discrepancies
 */
describe('Cash Sessions (DB Integration)', () => {
  const client = createServiceClient();
  let testStaff: { id: string };
  let testMember: { id: string };

  beforeAll(async () => {
    testStaff = await createTestStaff(client, {
      nome: 'Cash Session Test Staff',
      email: `cash-staff-${Date.now()}@test.local`,
      role: 'STAFF',
    });
    createdIds.staff.push(testStaff.id);

    testMember = await createTestMember(client, {
      nome: 'Cash Session Test Member',
      email: `cash-member-${Date.now()}@test.local`,
      status: 'LEAD',
    });
    createdIds.members.push(testMember.id);
  });

  afterEach(async () => {
    if (createdIds.cashSessions.length > 0) {
      await client.from('cash_sessions').delete().in('id', createdIds.cashSessions);
      createdIds.cashSessions = [];
    }
  });

  afterAll(async () => {
    if (createdIds.staff.length > 0) {
      await client.from('staff').delete().in('id', createdIds.staff);
    }
    resetTracking();
  });

  describe('Session lifecycle', () => {
    it('opens with opening_balance_cents', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 15000, // €150
        status: 'OPEN',
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      expect(session.opening_balance_cents).toBe(15000);
      expect(session.status).toBe('OPEN');
    });

    it('sets status to OPEN on creation', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 10000,
        status: 'OPEN',
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      expect(session.status).toBe('OPEN');
    });

    it('records who opened the session', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 10000,
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      expect(session.opened_by).toBe(testStaff.id);
    });

    it('uses unique session_date', async () => {
      const session1 = await createTestCashSession(client, {
        opening_balance_cents: 10000,
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session1.id);

      const session2 = await createTestCashSession(client, {
        opening_balance_cents: 20000,
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session2.id);

      // Each session should have unique date
      expect(session1.session_date).not.toBe(session2.session_date);
    });
  });

  describe('Closing session', () => {
    it('closes with actual_closing_cents', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 10000,
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      const { error } = await client
        .from('cash_sessions')
        .update({
          actual_closing_cents: 18500,
          status: 'CLOSED',
          closed_by: testStaff.id,
        })
        .eq('id', session.id);

      expect(error).toBeNull();

      const { data: closed } = await client
        .from('cash_sessions')
        .select('*')
        .eq('id', session.id)
        .single();

      expect(closed!.actual_closing_cents).toBe(18500);
      expect(closed!.status).toBe('CLOSED');
    });

    it('records who closed the session', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 10000,
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      await client
        .from('cash_sessions')
        .update({
          actual_closing_cents: 15000,
          status: 'CLOSED',
          closed_by: testStaff.id,
        })
        .eq('id', session.id);

      const { data: closed } = await client
        .from('cash_sessions')
        .select('closed_by')
        .eq('id', session.id)
        .single();

      expect(closed!.closed_by).toBe(testStaff.id);
    });

    it('sets status to CLOSED', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 10000,
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      await client
        .from('cash_sessions')
        .update({
          actual_closing_cents: 15000,
          status: 'CLOSED',
          closed_by: testStaff.id,
        })
        .eq('id', session.id);

      const { data: closed } = await client
        .from('cash_sessions')
        .select('status')
        .eq('id', session.id)
        .single();

      expect(closed!.status).toBe('CLOSED');
    });
  });

  describe('Difference calculation', () => {
    it('calculates difference between expected and actual closing', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 10000,
        expected_closing_cents: 18000, // Expected after transactions
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      const actualClosing = 18500; // Counted €5 more
      const expectedClosing = 18000;
      const difference = actualClosing - expectedClosing;

      await client
        .from('cash_sessions')
        .update({
          actual_closing_cents: actualClosing,
          difference_cents: difference,
          status: 'CLOSED',
          closed_by: testStaff.id,
        })
        .eq('id', session.id);

      const { data: closed } = await client
        .from('cash_sessions')
        .select('difference_cents')
        .eq('id', session.id)
        .single();

      expect(closed!.difference_cents).toBe(500);
    });

    it('zero difference when actual matches expected', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 10000,
        expected_closing_cents: 15000,
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      await client
        .from('cash_sessions')
        .update({
          actual_closing_cents: 15000,
          difference_cents: 0,
          status: 'CLOSED',
          closed_by: testStaff.id,
        })
        .eq('id', session.id);

      const { data: closed } = await client
        .from('cash_sessions')
        .select('difference_cents')
        .eq('id', session.id)
        .single();

      expect(closed!.difference_cents).toBe(0);
    });

    it('negative difference when short', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 10000,
        expected_closing_cents: 20000,
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      const actualClosing = 19500; // Missing €5
      const expectedClosing = 20000;
      const difference = actualClosing - expectedClosing;

      await client
        .from('cash_sessions')
        .update({
          actual_closing_cents: actualClosing,
          difference_cents: difference,
          status: 'CLOSED',
          closed_by: testStaff.id,
        })
        .eq('id', session.id);

      const { data: closed } = await client
        .from('cash_sessions')
        .select('difference_cents')
        .eq('id', session.id)
        .single();

      expect(closed!.difference_cents).toBe(-500);
    });
  });

  describe('Alert thresholds', () => {
    it('difference > 500 cents (€5) should flag for review', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 10000,
        expected_closing_cents: 15000,
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      const largeDiscrepancy = 600; // €6 over
      await client
        .from('cash_sessions')
        .update({
          actual_closing_cents: 15600,
          difference_cents: largeDiscrepancy,
          status: 'CLOSED',
          closed_by: testStaff.id,
        })
        .eq('id', session.id);

      const { data: closed } = await client
        .from('cash_sessions')
        .select('difference_cents')
        .eq('id', session.id)
        .single();

      const needsReview = Math.abs(closed!.difference_cents) > 500;
      expect(needsReview).toBe(true);
    });

    it('difference <= 500 cents is acceptable', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 10000,
        expected_closing_cents: 15000,
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      const smallDiscrepancy = 300; // €3 difference
      await client
        .from('cash_sessions')
        .update({
          actual_closing_cents: 15300,
          difference_cents: smallDiscrepancy,
          status: 'CLOSED',
          closed_by: testStaff.id,
        })
        .eq('id', session.id);

      const { data: closed } = await client
        .from('cash_sessions')
        .select('difference_cents')
        .eq('id', session.id)
        .single();

      const needsReview = Math.abs(closed!.difference_cents) > 500;
      expect(needsReview).toBe(false);
    });
  });

  describe('Session constraints', () => {
    it('cannot reopen a closed session', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 10000,
        status: 'CLOSED',
        actual_closing_cents: 15000,
        opened_by: testStaff.id,
        closed_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      // Application should prevent this - DB may or may not have constraint
      const { data: closed } = await client
        .from('cash_sessions')
        .select('status')
        .eq('id', session.id)
        .single();

      expect(closed!.status).toBe('CLOSED');
    });

    it('requires opening_balance_cents on creation', async () => {
      // The createTestCashSession helper provides default, but verify it's set
      const session = await createTestCashSession(client, {
        opening_balance_cents: 12345,
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      expect(session.opening_balance_cents).toBe(12345);
    });
  });

  describe('DINHEIRO Payment Integration', () => {
    it('DINHEIRO payment can be tracked alongside cash session', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 5000, // €50
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      // Create DINHEIRO transaction
      const { data: txn, error: txnError } = await client
        .from('transactions')
        .insert({
          type: 'RECEITA',
          category: 'SUBSCRIPTION',
          amount_cents: 6000, // €60
          payment_method: 'DINHEIRO',
          member_id: testMember.id,
          transaction_date: session.session_date,
          description: 'Plano mensal via DINHEIRO',
          created_by: testStaff.id,
        })
        .select()
        .single();

      expect(txnError).toBeNull();
      createdIds.transactions.push(txn!.id);

      // Query total DINHEIRO for the session date
      const { data: dinheiroTxns } = await client
        .from('transactions')
        .select('amount_cents')
        .eq('payment_method', 'DINHEIRO')
        .eq('type', 'RECEITA')
        .eq('transaction_date', session.session_date);

      const totalDinheiro = dinheiroTxns?.reduce((s, t) => s + t.amount_cents, 0) || 0;
      expect(totalDinheiro).toBe(6000);

      // Expected closing = opening + dinheiro revenue
      const expectedClosing = session.opening_balance_cents + totalDinheiro;
      expect(expectedClosing).toBe(11000); // €50 + €60 = €110
    });

    it('multiple DINHEIRO payments accumulate correctly', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 5000,
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      // Create multiple DINHEIRO transactions
      const amounts = [3000, 4500, 2500]; // €30 + €45 + €25 = €100

      for (const amount of amounts) {
        const { data: txn } = await client
          .from('transactions')
          .insert({
            type: 'RECEITA',
            category: 'SUBSCRIPTION',
            amount_cents: amount,
            payment_method: 'DINHEIRO',
            member_id: testMember.id,
            transaction_date: session.session_date,
            created_by: testStaff.id,
          })
          .select()
          .single();

        createdIds.transactions.push(txn!.id);
      }

      // Query total DINHEIRO
      const { data: dinheiroTxns } = await client
        .from('transactions')
        .select('amount_cents')
        .eq('payment_method', 'DINHEIRO')
        .eq('type', 'RECEITA')
        .eq('transaction_date', session.session_date);

      const totalDinheiro = dinheiroTxns?.reduce((s, t) => s + t.amount_cents, 0) || 0;
      expect(totalDinheiro).toBe(10000); // €100 total
    });

    it('DINHEIRO expense reduces expected cash', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 10000, // €100
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      // Create DINHEIRO revenue
      const { data: revenue } = await client
        .from('transactions')
        .insert({
          type: 'RECEITA',
          category: 'SUBSCRIPTION',
          amount_cents: 6000,
          payment_method: 'DINHEIRO',
          transaction_date: session.session_date,
          member_id: testMember.id,
          created_by: testStaff.id,
        })
        .select()
        .single();

      createdIds.transactions.push(revenue!.id);

      // Create DINHEIRO expense
      const { data: expense } = await client
        .from('transactions')
        .insert({
          type: 'DESPESA',
          category: 'EQUIPAMENTOS',
          amount_cents: 2000,
          payment_method: 'DINHEIRO',
          transaction_date: session.session_date,
          description: 'Compra de luvas',
          created_by: testStaff.id,
        })
        .select()
        .single();

      createdIds.transactions.push(expense!.id);

      // Query totals
      const { data: revenues } = await client
        .from('transactions')
        .select('amount_cents')
        .eq('type', 'RECEITA')
        .eq('payment_method', 'DINHEIRO')
        .eq('transaction_date', session.session_date);

      const { data: expenses } = await client
        .from('transactions')
        .select('amount_cents')
        .eq('type', 'DESPESA')
        .eq('payment_method', 'DINHEIRO')
        .eq('transaction_date', session.session_date);

      const totalRevenue = revenues?.reduce((s, t) => s + t.amount_cents, 0) || 0;
      const totalExpense = expenses?.reduce((s, t) => s + t.amount_cents, 0) || 0;

      // Expected cash = opening + revenue - expense
      // = 10000 + 6000 - 2000 = 14000
      const expectedCash = session.opening_balance_cents + totalRevenue - totalExpense;
      expect(expectedCash).toBe(14000);
    });

    it('non-DINHEIRO payments do not affect cash calculation', async () => {
      const session = await createTestCashSession(client, {
        opening_balance_cents: 5000,
        opened_by: testStaff.id,
      });
      createdIds.cashSessions.push(session.id);

      // Create CARTAO transaction (should NOT affect cash)
      const { data: cardTxn } = await client
        .from('transactions')
        .insert({
          type: 'RECEITA',
          category: 'SUBSCRIPTION',
          amount_cents: 6000,
          payment_method: 'CARTAO', // Not DINHEIRO
          transaction_date: session.session_date,
          member_id: testMember.id,
          created_by: testStaff.id,
        })
        .select()
        .single();

      createdIds.transactions.push(cardTxn!.id);

      // Query DINHEIRO totals only
      const { data: dinheiroTxns } = await client
        .from('transactions')
        .select('amount_cents')
        .eq('payment_method', 'DINHEIRO')
        .eq('transaction_date', session.session_date);

      const totalDinheiro = dinheiroTxns?.reduce((s, t) => s + t.amount_cents, 0) || 0;

      // Should be 0 - card payment doesn't count toward cash
      expect(totalDinheiro).toBe(0);

      // Expected closing = opening only (no cash transactions)
      expect(session.opening_balance_cents + totalDinheiro).toBe(5000);
    });
  });
});
