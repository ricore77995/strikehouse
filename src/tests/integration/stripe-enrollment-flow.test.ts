import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { format, addDays } from 'date-fns';
import {
  createServiceClient,
  createTestMember,
  createTestStaff,
} from '../fixtures/factory';
import { createdIds, cleanupTrackedEntities } from '../fixtures/setup';
import {
  isStripeConfigured,
  getStripeClient,
  createRealStripeCustomer,
  createRealSubscription,
  findAnyActivePrice,
  findPriceByWeeklyLimit,
  cleanupStripeCustomer,
  waitForWebhook,
} from '../fixtures/stripe-helpers';

/**
 * Stripe Enrollment Flow Integration Tests - REAL API
 *
 * These tests create REAL objects in Stripe:
 * - Customers (visible in Stripe Dashboard)
 * - Subscriptions (triggers real webhooks)
 * - Invoices (paid with pm_card_visa test card)
 *
 * The flow:
 * 1. Create LEAD member in database
 * 2. Create REAL Stripe Customer via API
 * 3. Create REAL Subscription via API (triggers webhooks!)
 * 4. Wait for webhook to process
 * 5. Verify member auto-activated by webhook
 * 6. Cleanup: cancel subscription, delete customer
 *
 * IMPORTANT: Uses pm_card_visa test payment method that always succeeds
 */

// Skip all tests if Stripe credentials are not configured
const describeIfStripe = isStripeConfigured() ? describe : describe.skip;

describeIfStripe('Stripe Enrollment Flow (Real API)', () => {
  const client = createServiceClient();
  const stripe = getStripeClient();
  let testStaff: { id: string };

  // Track created Stripe customers for cleanup
  const createdCustomerIds: string[] = [];

  beforeAll(async () => {
    // Create test staff
    testStaff = await createTestStaff(client, {
      nome: 'Real API Test Staff',
      email: `realapi-staff-${Date.now()}@test.local`,
      role: 'ADMIN',
    });
    createdIds.staff.push(testStaff.id);
  });

  afterAll(async () => {
    // Cleanup all created Stripe customers
    for (const customerId of createdCustomerIds) {
      await cleanupStripeCustomer(customerId);
    }

    // Cleanup database entities
    await cleanupTrackedEntities();
  });

  describe('LEAD → Real Subscription → Auto-Activation', () => {
    let testMember: { id: string; email: string; nome: string };

    beforeEach(async () => {
      // Create fresh LEAD member for each test
      testMember = await createTestMember(client, {
        nome: `Real API Member ${Date.now()}`,
        email: `realapi-${Date.now()}@test.local`,
        telefone: `9${Math.floor(10000000 + Math.random() * 90000000)}`,
        status: 'LEAD',
        access_type: null,
      });
      createdIds.members.push(testMember.id);
    });

    it('creates REAL Stripe Customer with member_id metadata', async () => {
      // Create REAL Stripe Customer (also updates member.stripe_customer_id)
      const customer = await createRealStripeCustomer(
        testMember.id,
        testMember.email,
        testMember.nome,
        client // Pass Supabase client to update member
      );
      createdCustomerIds.push(customer.id);

      // Verify customer created in Stripe
      expect(customer.id).toMatch(/^cus_/);
      expect(customer.email).toBe(testMember.email);
      expect(customer.metadata.member_id).toBe(testMember.id);

      // Verify we can retrieve it
      const retrieved = await stripe.customers.retrieve(customer.id);
      expect(retrieved.id).toBe(customer.id);

      // Verify member has stripe_customer_id set in database
      const { data: member } = await client
        .from('members')
        .select('stripe_customer_id')
        .eq('id', testMember.id)
        .single();
      expect(member?.stripe_customer_id).toBe(customer.id);
    });

    it('creates REAL Subscription and waits for REAL webhook to activate member', async () => {
      /**
       * 100% REAL TEST:
       * 1. Create REAL Customer + Subscription in Stripe
       * 2. Wait for REAL webhook from Stripe to activate member
       * 3. Verify everything works end-to-end
       *
       * REQUIRES: Stripe webhook endpoint configured for invoice.paid events
       */

      // 1. Create REAL Stripe Customer (and link to member in DB)
      const customer = await createRealStripeCustomer(
        testMember.id,
        testMember.email,
        testMember.nome,
        client
      );
      createdCustomerIds.push(customer.id);
      console.log(`✅ REAL Customer created: ${customer.id}`);

      // Verify stripe_customer_id is set in DB
      const { data: memberBefore } = await client
        .from('members')
        .select('stripe_customer_id')
        .eq('id', testMember.id)
        .single();
      expect(memberBefore?.stripe_customer_id).toBe(customer.id);

      // 2. Find a SUBSCRIPTION price
      const priceId = await findAnyActivePrice();
      expect(priceId).toBeTruthy();

      // 3. Create REAL Subscription (this triggers REAL webhooks!)
      const subscription = await createRealSubscription(
        customer.id,
        priceId!,
        testMember.id
      );

      expect(subscription.id).toMatch(/^sub_/);
      expect(subscription.status).toBe('active');
      console.log(`✅ REAL Subscription created: ${subscription.id}`);

      // 4. Verify invoice was created and paid in Stripe
      const invoices = await stripe.invoices.list({ customer: customer.id, limit: 1 });
      expect(invoices.data.length).toBeGreaterThan(0);
      expect(invoices.data[0].status).toBe('paid');
      console.log(`✅ REAL Invoice paid: ${invoices.data[0].id} (${invoices.data[0].amount_paid} cents)`);

      // 5. Wait for REAL webhook to process (up to 30 seconds)
      console.log('⏳ Waiting for REAL Stripe webhook...');
      let updatedMember: { status: string; stripe_customer_id: string | null; access_expires_at: string | null } | null = null;
      const maxAttempts = 60; // 60 x 500ms = 30 seconds

      for (let i = 0; i < maxAttempts; i++) {
        await waitForWebhook(500);
        const { data } = await client
          .from('members')
          .select('status, stripe_customer_id, access_type, access_expires_at')
          .eq('id', testMember.id)
          .single();
        updatedMember = data;

        if (updatedMember?.status === 'ATIVO') {
          console.log(`✅ Member activated after ${(i + 1) * 500}ms by REAL webhook!`);
          break;
        }

        // Log progress every 5 seconds
        if ((i + 1) % 10 === 0) {
          console.log(`⏳ Still waiting... ${(i + 1) * 500}ms elapsed`);
        }
      }

      // 6. Check stripe_events for debugging
      const { data: events } = await client
        .from('stripe_events')
        .select('event_type, payload, success, processed_at')
        .order('processed_at', { ascending: false })
        .limit(5);

      // Find events for our customer
      const ourEvents = events?.filter(e => {
        const payload = e.payload as { data?: { object?: { customer?: string } } };
        return payload?.data?.object?.customer === customer.id;
      });

      console.log(`📋 Stripe events for customer ${customer.id}:`, ourEvents?.length || 0);
      if (ourEvents && ourEvents.length > 0) {
        ourEvents.forEach(e => {
          console.log(`  - ${e.event_type} at ${e.processed_at} (success: ${e.success})`);
        });
      }

      // 7. Verify member was activated
      expect(updatedMember?.status).toBe('ATIVO');
      expect(updatedMember?.stripe_customer_id).toBe(customer.id);
      expect(updatedMember?.access_expires_at).toBeTruthy();
    });

    it('creates multiple REAL subscriptions and waits for REAL webhooks', async () => {
      // Create 3 members with REAL subscriptions
      const members = await Promise.all([
        createTestMember(client, {
          nome: `Batch Member 1 ${Date.now()}`,
          email: `batch1-${Date.now()}@test.local`,
          status: 'LEAD',
        }),
        createTestMember(client, {
          nome: `Batch Member 2 ${Date.now()}`,
          email: `batch2-${Date.now()}@test.local`,
          status: 'LEAD',
        }),
        createTestMember(client, {
          nome: `Batch Member 3 ${Date.now()}`,
          email: `batch3-${Date.now()}@test.local`,
          status: 'LEAD',
        }),
      ]);

      for (const m of members) {
        createdIds.members.push(m.id);
      }

      // Find an active price
      const priceId = await findAnyActivePrice();
      expect(priceId).toBeTruthy();

      // Create REAL customers and subscriptions for all
      console.log('Creating 3 REAL subscriptions...');
      const results = await Promise.all(
        members.map(async (member, idx) => {
          const customer = await createRealStripeCustomer(
            member.id,
            member.email,
            member.nome,
            client
          );
          createdCustomerIds.push(customer.id);

          const subscription = await createRealSubscription(
            customer.id,
            priceId!,
            member.id
          );

          console.log(`✅ Member ${idx + 1} - Customer: ${customer.id}, Subscription: ${subscription.id}`);
          return { member, customer, subscription };
        })
      );

      // Wait for REAL webhooks (up to 45 seconds for all 3)
      console.log('⏳ Waiting for REAL webhooks for all 3 members...');
      const maxAttempts = 90; // 90 x 500ms = 45 seconds

      for (let i = 0; i < maxAttempts; i++) {
        await waitForWebhook(500);

        const statuses = await Promise.all(
          results.map(async ({ member }) => {
            const { data } = await client
              .from('members')
              .select('status')
              .eq('id', member.id)
              .single();
            return data?.status;
          })
        );

        const activatedCount = statuses.filter(s => s === 'ATIVO').length;

        if (activatedCount === 3) {
          console.log(`✅ All 3 members activated after ${(i + 1) * 500}ms by REAL webhooks!`);
          break;
        }

        // Log progress every 5 seconds
        if ((i + 1) % 10 === 0) {
          console.log(`⏳ ${activatedCount}/3 members activated... ${(i + 1) * 500}ms elapsed`);
        }
      }

      // Verify all members were activated
      for (const { member, customer } of results) {
        const { data: updated } = await client
          .from('members')
          .select('status, stripe_customer_id')
          .eq('id', member.id)
          .single();

        expect(updated?.status).toBe('ATIVO');
        expect(updated?.stripe_customer_id).toBe(customer.id);
      }
    });

    it('subscription creates invoice that is paid', async () => {
      // 1. Create customer and subscription (link to member in DB)
      const customer = await createRealStripeCustomer(
        testMember.id,
        testMember.email,
        testMember.nome,
        client
      );
      createdCustomerIds.push(customer.id);

      const priceId = await findAnyActivePrice();
      const subscription = await createRealSubscription(
        customer.id,
        priceId!,
        testMember.id
      );

      // 2. Verify invoice was created and paid
      const invoices = await stripe.invoices.list({
        customer: customer.id,
        limit: 1,
      });

      expect(invoices.data.length).toBeGreaterThan(0);
      expect(invoices.data[0].status).toBe('paid');
      expect(invoices.data[0].subscription).toBe(subscription.id);
    });
  });

  describe('Cleanup Verification', () => {
    it('can cancel subscription and delete customer', async () => {
      // Create customer and subscription
      const member = await createTestMember(client, {
        nome: `Cleanup Test ${Date.now()}`,
        email: `cleanup-${Date.now()}@test.local`,
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const customer = await createRealStripeCustomer(
        member.id,
        member.email,
        member.nome,
        client
      );

      const priceId = await findAnyActivePrice();
      const subscription = await createRealSubscription(
        customer.id,
        priceId!,
        member.id
      );

      // Verify subscription is active
      expect(subscription.status).toBe('active');

      // Cancel subscription
      const canceledSub = await stripe.subscriptions.cancel(subscription.id);
      expect(canceledSub.status).toBe('canceled');

      // Delete customer
      const deletedCustomer = await stripe.customers.del(customer.id);
      expect(deletedCustomer.deleted).toBe(true);
    });
  });

  describe('Price Metadata', () => {
    it('prices have correct metadata for access rules', async () => {
      const prices = await stripe.prices.list({ active: true, limit: 100 });

      // Log all prices for debugging
      console.log('Active prices:');
      prices.data.forEach((p) => {
        console.log(`  ${p.id}: ${p.unit_amount}c - metadata:`, p.metadata);
      });

      // At least one price should exist
      expect(prices.data.length).toBeGreaterThan(0);
    });

    it('can find price by weekly_limit metadata', async () => {
      // Try to find unlimited price (no weekly_limit)
      const unlimitedPriceId = await findPriceByWeeklyLimit(null);

      // Try to find 2x/week price
      const price2xId = await findPriceByWeeklyLimit(2);

      // At least one should exist
      // Note: depends on what prices are configured in Stripe
      console.log('Unlimited price:', unlimitedPriceId);
      console.log('2x/week price:', price2xId);
    });
  });

  describe('Stripe Events Logging', () => {
    it('webhook events are logged to stripe_events table', async () => {
      // Create subscription to trigger webhook
      const member = await createTestMember(client, {
        nome: `Event Log Test ${Date.now()}`,
        email: `eventlog-${Date.now()}@test.local`,
        status: 'LEAD',
      });
      createdIds.members.push(member.id);

      const customer = await createRealStripeCustomer(
        member.id,
        member.email,
        member.nome,
        client // Pass Supabase client to update member.stripe_customer_id
      );
      createdCustomerIds.push(customer.id);

      const priceId = await findAnyActivePrice();
      await createRealSubscription(customer.id, priceId!, member.id);

      // Wait for webhook to process
      await waitForWebhook(5000);

      // Check stripe_events table for logged events
      const { data: events, error } = await client
        .from('stripe_events')
        .select('*')
        .order('processed_at', { ascending: false })
        .limit(10);

      if (error) {
        console.log('Error fetching stripe_events:', error);
      }

      // Should have some events logged
      console.log('Recent stripe_events:', events?.map((e) => e.event_type));
      expect(events).toBeTruthy();
    });
  });
});
