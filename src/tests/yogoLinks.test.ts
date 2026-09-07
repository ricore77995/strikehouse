import { beforeAll, describe, expect, it } from 'vitest';
import { buildPurchaseUrl, yogoProfileUrl, yogoServer } from '@/lib/yogoLinks';

beforeAll(() => {
  (window as unknown as Record<string, string>).YOGO_APP_SERVER = 'strikershouse.yogobooking.pt';
});

const BASE = 'https://strikershouse.yogobooking.pt/frontend/index.html';

describe('buildPurchaseUrl', () => {
  it('carries the plan and the chosen duration', () => {
    // Verified live: this URL opens a cart reading "(6 Month) €322 + €15 enrolment".
    expect(buildPurchaseUrl('membership_type', 6777, { paymentOption: 9029 })).toBe(
      `${BASE}?itemType=membership_type&itemId=6777&paymentOption=9029#/login-with-cart`
    );
  });

  it('omits the duration when there is none to send', () => {
    // YOGO then falls back to the item's first payment option.
    expect(buildPurchaseUrl('membership_type', 6777)).toBe(
      `${BASE}?itemType=membership_type&itemId=6777#/login-with-cart`
    );
    expect(buildPurchaseUrl('membership_type', 6777, { paymentOption: null })).not.toContain(
      'paymentOption'
    );
  });

  it('builds class pass and product links', () => {
    expect(buildPurchaseUrl('class_pass_type', 14172)).toBe(
      `${BASE}?itemType=class_pass_type&itemId=14172#/login-with-cart`
    );
    expect(buildPurchaseUrl('product', 3548)).toBe(
      `${BASE}?itemType=product&itemId=3548#/login-with-cart`
    );
  });

  it('can open the signup screen instead of login', () => {
    expect(buildPurchaseUrl('product', 3029, { signup: true })).toContain('signupMode=signup');
  });

  it('never emits the old scheme, which dropped the item', () => {
    const url = buildPurchaseUrl('membership_type', 6777, { paymentOption: 9029 });
    expect(url).not.toContain('/payment-option/');
    expect(url).not.toContain('/buy');
    expect(url).toContain('#/login-with-cart');
  });
});

describe('yogoProfileUrl', () => {
  it('points at the profile, where receipts live', () => {
    expect(yogoProfileUrl()).toBe(`${BASE}#/my-profile`);
  });
});

describe('yogoServer', () => {
  it('reads the global set by index.html', () => {
    expect(yogoServer()).toBe('strikershouse.yogobooking.pt');
  });
});
