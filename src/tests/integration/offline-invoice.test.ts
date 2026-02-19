import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Stripe from 'stripe';
import {
  createServiceClient,
  createTestMember,
  createTestStaff,
} from '../fixtures/factory';
import { createdIds, cleanupTrackedEntities } from '../fixtures/setup';

/**
 * Offline Invoice Integration Tests
 *
 * Tests the create-offline-invoice Edge Function for DINHEIRO, CARTAO, MBWAY payments.
 *
 * Requirements:
 * - Supabase remote running (uses VITE_SUPABASE_URL)
 * - Edge Function deployed (create-offline-invoice)
 * - STRIPE_SECRET_KEY env var
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cgdshqmqsqwgwpjfmesr.supabase.co';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/create-offline-invoice`;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

// Skip all tests if Stripe credentials are not configured
const describeIfStripe = STRIPE_SECRET_KEY ? describe : describe.skip;

describeIfStripe('Create Offline Invoice (Real Endpoint)', () => {
  let stripe: Stripe;
  const client = createServiceClient();
  let testStaff: { id: string };
  let testMember: { id: string; email: string; nome: string };
  let stripePriceId: string;

  beforeAll(async () => {
    // Initialize Stripe
    stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    // Get or create a one-time test price in Stripe
    // Note: Invoice API requires type=one_time (not recurring)
    const prices = await stripe.prices.list({ limit: 100, active: true, type: 'one_time' });
    const oneTimePrice = prices.data.find(p => p.type === 'one_time');

    if (oneTimePrice) {
      stripePriceId = oneTimePrice.id;
      console.log(`Using existing one-time price: ${stripePriceId}`);
    } else {
      // Create a test product and one-time price
      const product = await stripe.products.create({
        name: 'Test One-Time Product',
        metadata: { test: 'true' }
      });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: 6900,
        currency: 'eur',
        // type defaults to 'one_time' when no recurring interval specified
      });
      stripePriceId = price.id;
      console.log(`Created new one-time price: ${stripePriceId}`);
    }

    // Create test staff (admin)
    testStaff = await createTestStaff(client, {
      nome: 'Offline Invoice Test Staff',
      email: `offline-staff-${Date.now()}@test.local`,
      role: 'ADMIN',
    });
    createdIds.staff.push(testStaff.id);

    // Create test member
    testMember = await createTestMember(client, {
      nome: 'Offline Invoice Test Member',
      email: `offline-member-${Date.now()}@test.local`,
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
   * Helper to call the offline invoice function
   */
  async function createOfflineInvoice(body: {
    memberId: string;
    items: Array<{ priceId: string; quantity: number; description?: string }>;
    paymentMethod: 'DINHEIRO' | 'TRANSFERENCIA' | 'CARTAO' | 'MBWAY';
    staffId: string;
    description?: string;
    daysAccess?: number;
  }) {
    return fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
  }

  describe('DINHEIRO Payments', () => {
    it('creates invoice and marks as paid immediately', async () => {
      const response = await createOfflineInvoice({
        memberId: testMember.id,
        items: [{ priceId: stripePriceId, quantity: 1, description: 'Test subscription' }],
        paymentMethod: 'DINHEIRO',
        staffId: testStaff.id,
        description: 'Cash payment test',
      });

      if (response.status !== 200) {
        const errorData = await response.json();
        console.error('DINHEIRO test failed:', errorData);
      }

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.invoiceId).toBeTruthy();
      expect(data.status).toBe('paid');
      expect(data.memberActivated).toBe(true);

      // Verify Stripe customer was created
      const { data: member } = await client
        .from('members')
        .select('stripe_customer_id')
        .eq('id', testMember.id)
        .single();

      expect(member?.stripe_customer_id).toBeTruthy();

      // Cleanup: remove stripe_customer_id
      await client.from('members').update({ stripe_customer_id: null }).eq('id', testMember.id);
    });
  });

  describe('TRANSFERENCIA Payments', () => {
    it('creates invoice and returns URL for payment', async () => {
      const response = await createOfflineInvoice({
        memberId: testMember.id,
        items: [{ priceId: stripePriceId, quantity: 1 }],
        paymentMethod: 'TRANSFERENCIA',
        staffId: testStaff.id,
      });

      if (response.status !== 200) {
        const errorData = await response.json();
        console.error('TRANSFERENCIA test failed:', errorData);
      }

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.invoiceId).toBeTruthy();
      expect(data.status).toBe('open');
      expect(data.invoiceUrl).toBeTruthy();
      expect(data.amountDue).toBeGreaterThan(0);

      // Cleanup
      await client.from('members').update({ stripe_customer_id: null }).eq('id', testMember.id);
    });
  });

  describe('CARTAO TPA Payments', () => {
    it('creates invoice and marks as paid (out-of-band)', async () => {
      const response = await createOfflineInvoice({
        memberId: testMember.id,
        items: [{ priceId: stripePriceId, quantity: 1 }],
        paymentMethod: 'CARTAO',
        staffId: testStaff.id,
      });

      if (response.status !== 200) {
        const errorData = await response.json();
        console.error('CARTAO test failed:', errorData);
      }

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.status).toBe('paid');

      // Cleanup
      await client.from('members').update({ stripe_customer_id: null }).eq('id', testMember.id);
    });
  });

  describe('MBWAY Payments', () => {
    it('creates invoice and marks as paid (out-of-band)', async () => {
      const response = await createOfflineInvoice({
        memberId: testMember.id,
        items: [{ priceId: stripePriceId, quantity: 1 }],
        paymentMethod: 'MBWAY',
        staffId: testStaff.id,
      });

      if (response.status !== 200) {
        const errorData = await response.json();
        console.error('MBWAY test failed:', errorData);
      }

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.status).toBe('paid');

      // Cleanup
      await client.from('members').update({ stripe_customer_id: null }).eq('id', testMember.id);
    });
  });

  describe('Validation', () => {
    it('rejects missing required fields', async () => {
      const response = await createOfflineInvoice({
        memberId: testMember.id,
        items: [],
        paymentMethod: 'DINHEIRO',
        staffId: testStaff.id,
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('At least one item');
    });

    it('rejects invalid member ID', async () => {
      const response = await createOfflineInvoice({
        memberId: '00000000-0000-0000-0000-000000000000',
        items: [{ priceId: stripePriceId, quantity: 1 }],
        paymentMethod: 'DINHEIRO',
        staffId: testStaff.id,
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Member not found');
    });
  });

  describe('Stripe Customer Management', () => {
    it('creates Stripe customer if not exists', async () => {
      // Ensure member has no stripe_customer_id
      await client.from('members').update({ stripe_customer_id: null }).eq('id', testMember.id);

      const response = await createOfflineInvoice({
        memberId: testMember.id,
        items: [{ priceId: stripePriceId, quantity: 1 }],
        paymentMethod: 'DINHEIRO',
        staffId: testStaff.id,
      });

      expect(response.status).toBe(200);

      // Verify customer was created and linked
      const { data: member } = await client
        .from('members')
        .select('stripe_customer_id')
        .eq('id', testMember.id)
        .single();

      expect(member?.stripe_customer_id).toBeTruthy();
      expect(member?.stripe_customer_id).toMatch(/^cus_/);

      // Cleanup
      await client.from('members').update({ stripe_customer_id: null }).eq('id', testMember.id);
    });

    it('reuses existing Stripe customer', async () => {
      // Create a Stripe customer first
      const customer = await stripe.customers.create({
        email: `reuse-test-${Date.now()}@test.local`,
        name: 'Reuse Test',
        metadata: { test: 'true' }
      });

      // Set member's stripe_customer_id
      await client.from('members').update({
        stripe_customer_id: customer.id
      }).eq('id', testMember.id);

      const response = await createOfflineInvoice({
        memberId: testMember.id,
        items: [{ priceId: stripePriceId, quantity: 1 }],
        paymentMethod: 'DINHEIRO',
        staffId: testStaff.id,
      });

      expect(response.status).toBe(200);

      // Verify same customer was used (no new customer created)
      const { data: member } = await client
        .from('members')
        .select('stripe_customer_id')
        .eq('id', testMember.id)
        .single();

      expect(member?.stripe_customer_id).toBe(customer.id);

      // Cleanup
      await client.from('members').update({ stripe_customer_id: null }).eq('id', testMember.id);
    });
  });
});
