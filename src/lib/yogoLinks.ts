/**
 * Direct-link URLs into the YOGO checkout.
 *
 * YOGO documents the `?itemType=…&itemId=…#/login-with-cart` scheme, and it is the only
 * one that actually carries the item: the older `#/membership-type/{id}/payment-option/{id}/buy`
 * form we used before opened a bare login screen with an empty cart, silently losing both
 * the plan and the duration the visitor had picked.
 *
 * Verified against the live tenant:
 *   membership_type + paymentOption → cart shows "(6 Month) €322 + €15 enrolment"
 *   class_pass_type                 → cart shows the pass
 *   product                         → cart shows "1 x Gloves €30"  (undocumented, works)
 */

export type YogoItemType =
  | "membership_type"
  | "class_pass_type"
  | "product"
  | "event"
  | "class_series_type";

/** Tenant host, set as a global by index.html. */
export function yogoServer(): string {
  return (window as unknown as Record<string, string>).YOGO_APP_SERVER || "";
}

function frontendBase(): string {
  return `https://${yogoServer()}/frontend/index.html`;
}

export interface PurchaseUrlOptions {
  /**
   * Payment option id, for items sold in several durations. The parameter is
   * `paymentOption` — `paymentOptionId` is silently ignored and YOGO then falls back to
   * the item's first option, which is always the monthly one.
   */
  paymentOption?: number | null;
  /** Show "create account" instead of the login screen. */
  signup?: boolean;
}

export function buildPurchaseUrl(
  itemType: YogoItemType,
  itemId: number,
  options: PurchaseUrlOptions = {}
): string {
  const params = new URLSearchParams({ itemType, itemId: String(itemId) });
  if (options.paymentOption) params.set("paymentOption", String(options.paymentOption));
  if (options.signup) params.set("signupMode", "signup");
  return `${frontendBase()}?${params}#/login-with-cart`;
}

/** Where a member finds their receipts and bookings. */
export function yogoProfileUrl(): string {
  return `${frontendBase()}#/my-profile`;
}
