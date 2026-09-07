import type { PaymentOptionItem, PricingItem } from "@/hooks/useYogoPricing";

/** A plan whose every for-sale option costs nothing (the free trial pass). */
export function isFreeItem(item: PricingItem): boolean {
  return item.paymentOptions.length > 0 && item.paymentOptions.every((o) => o.price === 0);
}

/** Distinct commitment lengths offered anywhere in a group, ascending. */
export function groupDurations(items: PricingItem[]): number[] {
  const months = new Set<number>();
  for (const item of items) {
    for (const option of item.paymentOptions) {
      if (option.months && option.months > 0) months.add(option.months);
    }
  }
  return [...months].sort((a, b) => a - b);
}

/**
 * Option to show for the selected duration. Falls back to the longest option that
 * still fits, so a plan sold only monthly stays visible and purchasable instead of
 * disappearing when the visitor picks "6 meses".
 */
export function resolveOption(
  item: PricingItem,
  months: number | null
): PaymentOptionItem | undefined {
  const options = item.paymentOptions;
  if (!options.length) return undefined;
  if (months == null) return options[0];

  const exact = options.find((o) => o.months === months);
  if (exact) return exact;

  const shorter = options.filter((o) => o.months != null && o.months < months);
  if (shorter.length) return shorter[shorter.length - 1];

  return options[0];
}

/** What the visitor pays per month under this option. */
export function monthlyEquivalent(option: PaymentOptionItem): number {
  return option.months && option.months > 1
    ? Math.round(option.price / option.months)
    : option.price;
}

export interface DurationSaving {
  percent: number;
  /** false when plans discount by different amounts, so the copy must say "up to". */
  uniform: boolean;
}

const MIN_SAVING_PCT = 5;
const UNIFORM_TOLERANCE_PCT = 2;

/**
 * Discount a duration buys, versus paying monthly. Reports the smallest saving when
 * plans agree (true of every card) and the largest with an "up to" flag when they
 * diverge, so the badge never overstates what a given card delivers.
 */
export function durationSaving(items: PricingItem[], months: number): DurationSaving | null {
  if (!months || months <= 1) return null;

  const ratios: number[] = [];
  for (const item of items) {
    const monthly = item.paymentOptions.find((o) => o.months === 1);
    const longer = item.paymentOptions.find((o) => o.months === months);
    if (!monthly || !longer || monthly.price <= 0) continue;
    ratios.push(1 - longer.price / months / monthly.price);
  }
  if (!ratios.length) return null;

  const low = Math.round(Math.min(...ratios) * 100);
  const high = Math.round(Math.max(...ratios) * 100);
  if (high < MIN_SAVING_PCT) return null;

  const uniform = high - low <= UNIFORM_TOLERANCE_PCT;
  return { percent: uniform ? low : high, uniform };
}

/** How many classes the plan allows in the period the price covers. */
function sessionCount(item: PricingItem): number | null {
  if (item.numberOfClasses) return item.numberOfClasses;
  if (item.classesPerMonth) return item.classesPerMonth;
  if (item.classesPerWeek) return item.classesPerWeek * 4;
  return null;
}

/**
 * Price per class under the selected option, or null when the plan is unlimited.
 * It must track the price the card is showing: quoting the base monthly rate next to
 * a discounted price contradicts it (54€/month alongside "5,00€ per class" for 12
 * classes, when 54/12 is 4,50€). Divides the exact total rather than the rounded
 * monthly figure, so no rounding drift creeps in either.
 */
export function perClassPrice(item: PricingItem, option: PaymentOptionItem): number | null {
  const sessions = sessionCount(item);
  if (!sessions || !option.price) return null;
  const months = item.type === "class_pass" ? 1 : (option.months || 1);
  return option.price / months / sessions;
}

export type PlanQuota =
  | { kind: "passes"; count: number }
  | { kind: "perMonth"; count: number }
  | { kind: "perWeek"; count: number }
  | { kind: "unlimited" }
  | { kind: "classPack" }
  | { kind: "plan" };

/**
 * The plan's access shape. Concrete caps are checked before `isUnlimited` — the
 * reverse order is what made "12 passes/month" plans read as unlimited. A monthly
 * cap wins over a weekly one so every card in a row is quoted in the same unit;
 * `weeklyCap` then surfaces the weekly limit of a plan that carries both.
 */
export function planQuota(item: PricingItem): PlanQuota {
  if (item.type === "class_pass") {
    return item.numberOfClasses
      ? { kind: "passes", count: item.numberOfClasses }
      : { kind: "classPack" };
  }
  if (item.classesPerMonth) return { kind: "perMonth", count: item.classesPerMonth };
  if (item.classesPerWeek) return { kind: "perWeek", count: item.classesPerWeek };
  if (item.isUnlimited) return { kind: "unlimited" };
  return { kind: "plan" };
}

/** Weekly cap worth stating separately, i.e. one the eyebrow is not already showing. */
export function weeklyCap(item: PricingItem): number | null {
  return item.classesPerMonth && item.classesPerWeek ? item.classesPerWeek : null;
}
