import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Stripe from 'stripe';
import {
  createServiceClient,
  createTestMember,
  createTestStaff,
} from '../fixtures/factory';
import { createdIds, cleanupTrackedEntities } from '../fixtures/setup';

/**
 * Stripe Webhook Integration Tests - REAL Edge Function
 *
 * Tests the stripe-webhook Edge Function directly via HTTP.
 * Uses Stripe SDK to generate valid test signatures.
 *
 * Requirements:
 * - Supabase remote running (uses VITE_SUPABASE_URL)
 * - Edge Function deployed (stripe-webhook)
 * - STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET env vars
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cgdshqmqsqwgwpjfmesr.supabase.co';
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/stripe-webhook`;

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// Skip all tests if Stripe credentials are not configured
const describeIfStripe = STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET ? describe : describe.skip;

describeIfStripe('Stripe Webhook (Real Endpoint)', () => {
  let stripe: Stripe;
  const client = createServiceClient();
  let testStaff: { id: string };
  let testMember: { id: string; email: string; nome: string };

  beforeAll(async () => {
    // Initialize Stripe
    stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    // Create test staff (admin)
    testStaff = await createTestStaff(client, {
      nome: 'Webhook Test Staff',
      email: `webhook-staff-${Date.now()}@test.local`,
      role: 'ADMIN',
    });
    createdIds.staff.push(testStaff.id);

    // Create test member for auto-match tests
    testMember = await createTestMember(client, {
      nome: 'Webhook Test Member',
      email: `webhook-member-${Date.now()}@test.local`,
      telefone: `9${Math.floor(10000000 + Math.random() * 90000000)}`,
      status: 'LEAD',
      access_type: null,
    });
    createdIds.members.push(testMember.id);
  });

  afterAll(async () => {
    await cleanupTrackedEntities();
  });

  /**
   * Helper to create a Stripe event payload
   */
  function createCheckoutSessionEvent(options: {
    sessionId?: string;
    email?: string;
    name?: string;
    memberId?: string;
    amountTotal?: number;
    isNewMember?: boolean;
  }) {
    const {
      sessionId = `cs_test_${Date.now()}`,
      email = 'test@test.local',
      name = 'Test Customer',
      memberId,
      amountTotal = 6900,
      isNewMember = true,
    } = options;

    return {
      id: `evt_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      object: 'event',
      api_version: '2023-10-16',
      created: Math.floor(Date.now() / 1000),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          mode: 'payment',
          payment_status: 'paid',
          amount_total: amountTotal,
          currency: 'eur',
          customer: `cus_test_${Date.now()}`,
          customer_email: email,
          customer_details: {
            email: email,
            name: name,
          },
          client_reference_id: memberId || null,
          metadata: {
            member_id: memberId || null,  // null instead of empty string for UUID compatibility
            is_new_member: isNewMember ? 'true' : 'false',
            customer_name: name,
          },
          payment_method_types: ['card'],
          subscription: null,
        },
      },
    };
  }

  /**
   * Helper to send webhook with valid signature
   */
  async function sendWebhook(event: object, secret?: string) {
    const payload = JSON.stringify(event);
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: secret || STRIPE_WEBHOOK_SECRET,
    });

    return fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature,
      },
      body: payload,
    });
  }

  describe('checkout.session.completed', () => {
    it('processes valid event and inserts into stripe_payment_ledger', async () => {
      const sessionId = `cs_test_valid_${Date.now()}`;
      const event = createCheckoutSessionEvent({
        sessionId,
        email: 'valid-webhook@test.local',
        name: 'Valid Webhook Test',
        amountTotal: 7500,
      });

      const response = await sendWebhook(event);
      const data = await response.json();

      if (response.status !== 200) {
        console.error('Webhook failed:', response.status, data);
      }

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);

      // Verify entry in stripe_payment_ledger
      const { data: ledgerEntry } = await client
        .from('stripe_payment_ledger')
        .select('*')
        .eq('stripe_session_id', sessionId)
        .single();

      expect(ledgerEntry).toBeTruthy();
      expect(ledgerEntry.payment_status).toBe('paid');
      expect(ledgerEntry.amount_total).toBe(7500);
      expect(ledgerEntry.customer_email).toBe('valid-webhook@test.local');
      // In new architecture, all payments are auto-confirmed by webhook
      expect(ledgerEntry.confirmed).toBe(true);

      // Cleanup
      await client.from('stripe_payment_ledger').delete().eq('id', ledgerEntry.id);
    });

    it('auto-matches member by email', async () => {
      const sessionId = `cs_test_automatch_${Date.now()}`;
      const event = createCheckoutSessionEvent({
        sessionId,
        email: testMember.email, // Use existing member's email
        name: testMember.nome,
        amountTotal: 6900,
      });

      const response = await sendWebhook(event);
      expect(response.status).toBe(200);

      // Verify auto-match
      const { data: ledgerEntry } = await client
        .from('stripe_payment_ledger')
        .select('*')
        .eq('stripe_session_id', sessionId)
        .single();

      expect(ledgerEntry).toBeTruthy();
      expect(ledgerEntry.matched_member_id).toBe(testMember.id);
      expect(ledgerEntry.auto_matched).toBe(true);

      // Cleanup
      await client.from('stripe_payment_ledger').delete().eq('id', ledgerEntry.id);
    });

    it('uses memberId from metadata when provided', async () => {
      const sessionId = `cs_test_metadata_${Date.now()}`;
      const event = createCheckoutSessionEvent({
        sessionId,
        email: 'different@test.local',
        memberId: testMember.id,
        amountTotal: 6900,
      });

      const response = await sendWebhook(event);
      expect(response.status).toBe(200);

      const { data: ledgerEntry } = await client
        .from('stripe_payment_ledger')
        .select('*')
        .eq('stripe_session_id', sessionId)
        .single();

      expect(ledgerEntry).toBeTruthy();
      expect(ledgerEntry.matched_member_id).toBe(testMember.id);
      expect(ledgerEntry.auto_matched).toBe(false); // Not auto-matched, came from metadata

      // Cleanup
      await client.from('stripe_payment_ledger').delete().eq('id', ledgerEntry.id);
    });
  });

  describe('Idempotency', () => {
    it('rejects duplicate events gracefully', async () => {
      const sessionId = `cs_test_idempotent_${Date.now()}`;
      const event = createCheckoutSessionEvent({
        sessionId,
        email: 'idempotent@test.local',
      });

      // First request - should succeed
      const response1 = await sendWebhook(event);
      if (response1.status !== 200) {
        const errData = await response1.json();
        console.error('Idempotency test - first request failed:', response1.status, errData);
      }
      expect(response1.status).toBe(200);

      // Verify entry created
      const { data: firstEntry } = await client
        .from('stripe_payment_ledger')
        .select('id')
        .eq('stripe_session_id', sessionId)
        .single();

      expect(firstEntry).toBeTruthy();

      // Second request with same event - should also return 200 but not duplicate
      const response2 = await sendWebhook(event);
      const data2 = await response2.json();

      expect(response2.status).toBe(200);
      expect(data2.message).toBe('Already processed');

      // Verify only one entry exists
      const { count } = await client
        .from('stripe_payment_ledger')
        .select('*', { count: 'exact', head: true })
        .eq('stripe_session_id', sessionId);

      expect(count).toBe(1);

      // Cleanup
      await client.from('stripe_payment_ledger').delete().eq('id', firstEntry.id);
    });
  });

  describe('Signature Validation', () => {
    it('rejects invalid signature', async () => {
      const event = createCheckoutSessionEvent({
        sessionId: `cs_test_invalid_sig_${Date.now()}`,
      });

      const payload = JSON.stringify(event);

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 't=123456789,v1=invalid_signature_here',
        },
        body: payload,
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('signature');
    });

    it('rejects missing signature header', async () => {
      const event = createCheckoutSessionEvent({
        sessionId: `cs_test_no_sig_${Date.now()}`,
      });

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No stripe-signature header
        },
        body: JSON.stringify(event),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('invoice.paid (Renewal/Offline)', () => {
    it('renews member access on invoice.paid', async () => {
      // First, create a member with stripe_customer_id
      const stripeCustomerId = `cus_test_renewal_${Date.now()}`;
      const { error: updateError } = await client
        .from('members')
        .update({
          stripe_customer_id: stripeCustomerId,
          status: 'ATIVO',
          access_type: 'SUBSCRIPTION'
        })
        .eq('id', testMember.id);

      if (updateError) {
        console.error('Failed to set stripe_customer_id:', updateError);
      }

      // Simulate invoice.paid event
      const invoiceId = `in_test_renewal_${Date.now()}`;
      const event = {
        id: `evt_test_invoice_paid_${Date.now()}`,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'invoice.paid',
        data: {
          object: {
            id: invoiceId,
            object: 'invoice',
            customer: stripeCustomerId,
            subscription: `sub_test_${Date.now()}`,
            amount_paid: 6900,
            currency: 'eur',
            status: 'paid',
            metadata: {
              days_access: '30'
            }
          },
        },
      };

      const response = await sendWebhook(event);
      expect(response.status).toBe(200);

      // Verify member was renewed
      const { data: updatedMember } = await client
        .from('members')
        .select('status, access_expires_at')
        .eq('id', testMember.id)
        .single();

      expect(updatedMember?.status).toBe('ATIVO');
      // Access should be extended
      expect(updatedMember?.access_expires_at).toBeTruthy();

      // Verify event logged
      const { data: stripeEvent } = await client
        .from('stripe_events')
        .select('*')
        .eq('event_id', event.id)
        .single();

      expect(stripeEvent).toBeTruthy();
      expect(stripeEvent.event_type).toBe('invoice.paid');
      expect(stripeEvent.success).toBe(true);

      // Cleanup
      await client.from('stripe_events').delete().eq('id', stripeEvent.id);
      await client.from('members').update({ stripe_customer_id: null }).eq('id', testMember.id);
    });

    it('logs event for invoice without matching member', async () => {
      const event = {
        id: `evt_test_invoice_no_member_${Date.now()}`,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'invoice.paid',
        data: {
          object: {
            id: `in_test_no_member_${Date.now()}`,
            object: 'invoice',
            customer: `cus_nonexistent_${Date.now()}`,
            amount_paid: 6900,
            currency: 'eur',
            status: 'paid',
          },
        },
      };

      const response = await sendWebhook(event);
      expect(response.status).toBe(200);

      // Event should still be logged
      const { data: stripeEvent } = await client
        .from('stripe_events')
        .select('id')
        .eq('event_id', event.id)
        .single();

      expect(stripeEvent).toBeTruthy();
      await client.from('stripe_events').delete().eq('id', stripeEvent.id);
    });
  });

  describe('Subscription Lifecycle', () => {
    it('handles customer.subscription.updated (active)', async () => {
      const stripeCustomerId = `cus_test_sub_update_${Date.now()}`;
      await client
        .from('members')
        .update({
          stripe_customer_id: stripeCustomerId,
          status: 'BLOQUEADO'
        })
        .eq('id', testMember.id);

      const event = {
        id: `evt_test_sub_updated_${Date.now()}`,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: `sub_test_${Date.now()}`,
            object: 'subscription',
            customer: stripeCustomerId,
            status: 'active',
            current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
          },
        },
      };

      const response = await sendWebhook(event);
      expect(response.status).toBe(200);

      // Verify member was activated
      const { data: updatedMember } = await client
        .from('members')
        .select('status, access_type')
        .eq('id', testMember.id)
        .single();

      expect(updatedMember?.status).toBe('ATIVO');
      expect(updatedMember?.access_type).toBe('SUBSCRIPTION');

      // Cleanup
      const { data: stripeEvent } = await client
        .from('stripe_events')
        .select('id')
        .eq('event_id', event.id)
        .single();
      if (stripeEvent) {
        await client.from('stripe_events').delete().eq('id', stripeEvent.id);
      }
      await client.from('members').update({
        stripe_customer_id: null,
        status: 'LEAD',
        access_type: null
      }).eq('id', testMember.id);
    });

    it('handles customer.subscription.deleted (blocks access)', async () => {
      const stripeCustomerId = `cus_test_sub_delete_${Date.now()}`;
      await client
        .from('members')
        .update({
          stripe_customer_id: stripeCustomerId,
          status: 'ATIVO',
          access_type: 'SUBSCRIPTION',
          stripe_subscription_id: `sub_test_${Date.now()}`
        })
        .eq('id', testMember.id);

      const event = {
        id: `evt_test_sub_deleted_${Date.now()}`,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: `sub_test_${Date.now()}`,
            object: 'subscription',
            customer: stripeCustomerId,
            status: 'canceled',
          },
        },
      };

      const response = await sendWebhook(event);
      expect(response.status).toBe(200);

      // Verify member was blocked
      const { data: updatedMember } = await client
        .from('members')
        .select('status, stripe_subscription_id')
        .eq('id', testMember.id)
        .single();

      expect(updatedMember?.status).toBe('BLOQUEADO');
      expect(updatedMember?.stripe_subscription_id).toBeNull();

      // Cleanup
      const { data: stripeEvent } = await client
        .from('stripe_events')
        .select('id')
        .eq('event_id', event.id)
        .single();
      if (stripeEvent) {
        await client.from('stripe_events').delete().eq('id', stripeEvent.id);
      }
      await client.from('members').update({
        stripe_customer_id: null,
        status: 'LEAD',
        access_type: null
      }).eq('id', testMember.id);
    });

    it('handles invoice.payment_failed (logs without blocking)', async () => {
      const event = {
        id: `evt_test_payment_failed_${Date.now()}`,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: `in_test_failed_${Date.now()}`,
            object: 'invoice',
            customer: `cus_test_${Date.now()}`,
            amount_due: 6900,
            currency: 'eur',
          },
        },
      };

      const response = await sendWebhook(event);
      expect(response.status).toBe(200);

      // Verify event was logged
      const { data: stripeEvent } = await client
        .from('stripe_events')
        .select('id, success')
        .eq('event_id', event.id)
        .single();

      expect(stripeEvent).toBeTruthy();
      expect(stripeEvent.success).toBe(true); // Event processed successfully (not the payment)

      // Cleanup
      await client.from('stripe_events').delete().eq('id', stripeEvent.id);
    });
  });

  describe('stripe_events Logging', () => {
    it('logs all events to stripe_events table', async () => {
      const event = {
        id: `evt_test_logging_${Date.now()}`,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'some.random.event',
        data: {
          object: {
            id: `obj_test_${Date.now()}`,
          },
        },
      };

      const response = await sendWebhook(event);
      expect(response.status).toBe(200);

      // Verify event was logged
      const { data: stripeEvent } = await client
        .from('stripe_events')
        .select('*')
        .eq('event_id', event.id)
        .single();

      expect(stripeEvent).toBeTruthy();
      expect(stripeEvent.event_type).toBe('some.random.event');
      expect(stripeEvent.success).toBe(true);
      expect(stripeEvent.payload).toBeTruthy();

      // Cleanup
      await client.from('stripe_events').delete().eq('id', stripeEvent.id);
    });
  });

  describe('Other Event Types', () => {
    it('handles unknown event types gracefully', async () => {
      const event = {
        id: `evt_test_unknown_${Date.now()}`,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'some.unknown.event',
        data: {
          object: {
            id: `obj_test_${Date.now()}`,
          },
        },
      };

      const response = await sendWebhook(event);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.received).toBe(true);

      // Cleanup
      const { data: stripeEvent } = await client
        .from('stripe_events')
        .select('id')
        .eq('event_id', event.id)
        .single();
      if (stripeEvent) {
        await client.from('stripe_events').delete().eq('id', stripeEvent.id);
      }
    });
  });
});
