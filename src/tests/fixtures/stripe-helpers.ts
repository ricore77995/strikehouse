import Stripe from 'stripe';

/**
 * Stripe Test Helpers
 *
 * Shared helpers for Stripe webhook integration tests.
 * Uses generateTestHeaderString to create valid signed webhooks
 * that can be sent to the real Edge Function.
 *
 * Requirements:
 * - STRIPE_SECRET_KEY env var (for Stripe SDK)
 * - STRIPE_WEBHOOK_SECRET env var (for signature generation)
 * - VITE_SUPABASE_URL env var (for Edge Function URL)
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cgdshqmqsqwgwpjfmesr.supabase.co';
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/stripe-webhook`;

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// Initialize Stripe SDK
let stripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripe) {
    if (!STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }
  return stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET);
}

// =============================================================================
// Event Creators
// =============================================================================

export interface CheckoutSessionEventOptions {
  sessionId?: string;
  email?: string;
  name?: string;
  memberId?: string;
  amountTotal?: number;
  isNewMember?: boolean;
  subscriptionId?: string;
  customerId?: string;
  priceMetadata?: Record<string, string>;
}

/**
 * Create a checkout.session.completed event payload
 */
export function createCheckoutSessionEvent(options: CheckoutSessionEventOptions = {}) {
  const {
    sessionId = `cs_test_${Date.now()}`,
    email = 'test@test.local',
    name = 'Test Customer',
    memberId,
    amountTotal = 6900,
    isNewMember = true,
    subscriptionId,
    customerId = `cus_test_${Date.now()}`,
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
        mode: subscriptionId ? 'subscription' : 'payment',
        payment_status: 'paid',
        amount_total: amountTotal,
        currency: 'eur',
        customer: customerId,
        customer_email: email,
        customer_details: {
          email: email,
          name: name,
        },
        client_reference_id: memberId || null,
        metadata: {
          member_id: memberId || null,
          is_new_member: isNewMember ? 'true' : 'false',
          customer_name: name,
        },
        payment_method_types: ['card'],
        subscription: subscriptionId || null,
      },
    },
  };
}

export interface InvoicePaidEventOptions {
  invoiceId?: string;
  customerId?: string;
  subscriptionId?: string;
  amountPaid?: number;
  daysAccess?: number;
}

/**
 * Create an invoice.paid event payload (for renewals)
 */
export function createInvoicePaidEvent(options: InvoicePaidEventOptions = {}) {
  const {
    invoiceId = `in_test_${Date.now()}`,
    customerId = `cus_test_${Date.now()}`,
    subscriptionId = `sub_test_${Date.now()}`,
    amountPaid = 6900,
    daysAccess = 30,
  } = options;

  return {
    id: `evt_test_invoice_paid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    object: 'event',
    api_version: '2023-10-16',
    created: Math.floor(Date.now() / 1000),
    type: 'invoice.paid',
    data: {
      object: {
        id: invoiceId,
        object: 'invoice',
        customer: customerId,
        subscription: subscriptionId,
        amount_paid: amountPaid,
        currency: 'eur',
        status: 'paid',
        metadata: {
          days_access: String(daysAccess),
        },
      },
    },
  };
}

export interface SubscriptionEventOptions {
  subscriptionId?: string;
  customerId?: string;
  status?: 'active' | 'past_due' | 'canceled' | 'unpaid';
  currentPeriodEndDays?: number; // Days from now
}

/**
 * Create a customer.subscription.updated event payload
 */
export function createSubscriptionUpdatedEvent(options: SubscriptionEventOptions = {}) {
  const {
    subscriptionId = `sub_test_${Date.now()}`,
    customerId = `cus_test_${Date.now()}`,
    status = 'active',
    currentPeriodEndDays = 30,
  } = options;

  return {
    id: `evt_test_sub_updated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    object: 'event',
    api_version: '2023-10-16',
    created: Math.floor(Date.now() / 1000),
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status: status,
        current_period_end: Math.floor(Date.now() / 1000) + (currentPeriodEndDays * 24 * 60 * 60),
      },
    },
  };
}

/**
 * Create a customer.subscription.deleted event payload
 */
export function createSubscriptionDeletedEvent(options: SubscriptionEventOptions = {}) {
  const {
    subscriptionId = `sub_test_${Date.now()}`,
    customerId = `cus_test_${Date.now()}`,
  } = options;

  return {
    id: `evt_test_sub_deleted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    object: 'event',
    api_version: '2023-10-16',
    created: Math.floor(Date.now() / 1000),
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status: 'canceled',
      },
    },
  };
}

export interface PaymentFailedEventOptions {
  invoiceId?: string;
  customerId?: string;
  amountDue?: number;
}

/**
 * Create an invoice.payment_failed event payload
 */
export function createPaymentFailedEvent(options: PaymentFailedEventOptions = {}) {
  const {
    invoiceId = `in_test_failed_${Date.now()}`,
    customerId = `cus_test_${Date.now()}`,
    amountDue = 6900,
  } = options;

  return {
    id: `evt_test_payment_failed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    object: 'event',
    api_version: '2023-10-16',
    created: Math.floor(Date.now() / 1000),
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: invoiceId,
        object: 'invoice',
        customer: customerId,
        amount_due: amountDue,
        currency: 'eur',
      },
    },
  };
}

// =============================================================================
// Webhook Sender
// =============================================================================

/**
 * Send a fabricated webhook event with valid Stripe signature
 * to the deployed Edge Function.
 *
 * The webhook is processed synchronously - no need for polling.
 */
export async function sendWebhook(event: object, secret?: string): Promise<Response> {
  const stripeClient = getStripeClient();
  const payload = JSON.stringify(event);
  const signature = stripeClient.webhooks.generateTestHeaderString({
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

/**
 * Send webhook and verify it was successful (status 200)
 */
export async function sendWebhookExpectSuccess(event: object): Promise<{ response: Response; data: any }> {
  const response = await sendWebhook(event);
  const data = await response.json();

  if (response.status !== 200) {
    throw new Error(`Webhook failed: ${response.status} - ${JSON.stringify(data)}`);
  }

  return { response, data };
}

// =============================================================================
// REAL Stripe API Functions (creates actual objects!)
// =============================================================================

/**
 * Create a REAL Stripe Customer and link it to member in database
 * This customer will appear in Stripe Dashboard!
 *
 * IMPORTANT: Also updates the member's stripe_customer_id in the database
 * so that webhooks can find the member by customer ID.
 */
export async function createRealStripeCustomer(
  memberId: string,
  email: string,
  name?: string,
  supabaseClient?: ReturnType<typeof import('@supabase/supabase-js').createClient>
) {
  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email,
    name: name || `Test Member ${Date.now()}`,
    metadata: { member_id: memberId },
  });

  // If supabase client provided, update member's stripe_customer_id
  // This is CRITICAL for webhooks to find the member!
  if (supabaseClient) {
    const { error } = await supabaseClient
      .from('members')
      .update({ stripe_customer_id: customer.id })
      .eq('id', memberId);

    if (error) {
      console.error('Failed to update member stripe_customer_id:', error);
    } else {
      // IMPORTANT: Wait for the update to be visible to other connections
      // This prevents race condition where webhook arrives before DB update is visible
      let verified = false;
      for (let i = 0; i < 10; i++) {
        const { data } = await supabaseClient
          .from('members')
          .select('stripe_customer_id')
          .eq('id', memberId)
          .single();

        if (data?.stripe_customer_id === customer.id) {
          verified = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!verified) {
        console.warn('Warning: stripe_customer_id update may not be visible yet');
      }
    }
  }

  return customer;
}

/**
 * Create a test PaymentMethod for a customer
 * Uses Stripe test token that always succeeds
 */
export async function createTestPaymentMethod(customerId: string) {
  const stripe = getStripeClient();

  // Create a PaymentMethod using test card token
  const paymentMethod = await stripe.paymentMethods.create({
    type: 'card',
    card: {
      token: 'tok_visa', // Stripe test token that always succeeds
    },
  });

  // Attach to customer
  await stripe.paymentMethods.attach(paymentMethod.id, {
    customer: customerId,
  });

  // Set as default payment method
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethod.id,
    },
  });

  return paymentMethod;
}

/**
 * Create a REAL Stripe Subscription
 * This triggers REAL webhooks: customer.subscription.created, invoice.paid
 * First creates a test PaymentMethod, then creates subscription
 */
export async function createRealSubscription(
  customerId: string,
  priceId: string,
  memberId: string
) {
  const stripe = getStripeClient();

  // First, create and attach a test payment method
  const paymentMethod = await createTestPaymentMethod(customerId);

  // Now create subscription with the payment method
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    default_payment_method: paymentMethod.id,
    metadata: { member_id: memberId },
  });
}

/**
 * Find a Price by weekly_limit metadata
 * Returns the first active price matching the weekly_limit
 */
export async function findPriceByWeeklyLimit(weeklyLimit: number | null): Promise<string | null> {
  const stripe = getStripeClient();
  const prices = await stripe.prices.list({ active: true, limit: 100 });

  const matchingPrice = prices.data.find(p => {
    if (weeklyLimit === null) {
      // Looking for unlimited (no weekly_limit set)
      return !p.metadata?.weekly_limit || p.metadata.weekly_limit === '';
    }
    return p.metadata?.weekly_limit === String(weeklyLimit);
  });

  return matchingPrice?.id || null;
}

/**
 * Find any active recurring price with access_type SUBSCRIPTION (for basic tests)
 * Excludes ADDON, DAILY_PASS, ENROLLMENT_FEE prices
 */
export async function findAnyActivePrice(): Promise<string | null> {
  const stripe = getStripeClient();
  const prices = await stripe.prices.list({
    active: true,
    limit: 100,
    type: 'recurring'
  });

  // Find a price with access_type SUBSCRIPTION (not ADDON, DAILY_PASS, etc.)
  const subscriptionPrice = prices.data.find(p =>
    p.metadata?.access_type === 'SUBSCRIPTION'
  );

  if (subscriptionPrice) {
    console.log(`Found SUBSCRIPTION price: ${subscriptionPrice.id} - ${subscriptionPrice.metadata?.display_name}`);
    return subscriptionPrice.id;
  }

  // Fallback: return first recurring price
  console.log('No SUBSCRIPTION price found, using fallback:', prices.data[0]?.id);
  return prices.data[0]?.id || null;
}

/**
 * Cleanup: Cancel all subscriptions and delete customer
 * IMPORTANT: Always call this in afterAll/afterEach!
 */
export async function cleanupStripeCustomer(customerId: string) {
  const stripe = getStripeClient();

  try {
    // First cancel all active subscriptions
    const subs = await stripe.subscriptions.list({ customer: customerId });
    for (const sub of subs.data) {
      if (sub.status !== 'canceled') {
        await stripe.subscriptions.cancel(sub.id);
      }
    }

    // Then delete the customer
    await stripe.customers.del(customerId);
  } catch (error) {
    // Ignore errors during cleanup (customer might not exist)
    console.log(`Cleanup warning for customer ${customerId}:`, error);
  }
}

/**
 * Wait for webhook to be processed
 * Since webhooks are async, we need to wait for Stripe to send them
 */
export function waitForWebhook(ms: number = 5000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a REAL one-time payment via Invoice
 * For testing one-time payments (drop-in, enrollment fee, etc.)
 */
export async function createRealOneTimePayment(
  customerId: string,
  priceId: string,
  memberId: string
) {
  const stripe = getStripeClient();

  // Create invoice
  const invoice = await stripe.invoices.create({
    customer: customerId,
    metadata: { member_id: memberId },
    auto_advance: false, // Don't auto-finalize
  });

  // Add line item
  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    price: priceId,
  });

  // Finalize and pay
  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
  const paidInvoice = await stripe.invoices.pay(finalizedInvoice.id, {
    payment_method: 'pm_card_visa',
  });

  return paidInvoice;
}

// =============================================================================
// Exports for test configuration
// =============================================================================

export { WEBHOOK_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET };
