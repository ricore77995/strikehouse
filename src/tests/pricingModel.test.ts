import { describe, expect, it } from 'vitest';
import {
  groupSortKey,
  type PaymentOptionItem,
  type PricingItem,
} from '@/hooks/useYogoPricing';
import {
  durationSaving,
  groupDurations,
  isFreeItem,
  monthlyEquivalent,
  perClassPrice,
  planQuota,
  resolveOption,
  weeklyCap,
} from '@/components/pricing/pricingModel';

function option(months: number | null, price: number): PaymentOptionItem {
  return { id: months ?? 0, name: '', price, months, purchaseUrl: '#' };
}

function plan(overrides: Partial<PricingItem>): PricingItem {
  return {
    id: 1,
    type: 'membership',
    name: 'Plan',
    description: '',
    imageUrl: null,
    paymentOptions: [option(1, 60), option(3, 162), option(6, 324)],
    registrationFee: 15,
    classesPerWeek: null,
    classesPerMonth: null,
    isUnlimited: false,
    numberOfClasses: null,
    validDays: null,
    purchaseUrl: '#',
    sortInGroup: 0,
    campaign: null,
    ...overrides,
  };
}

// Live Yogo config for the visible "Striker" group: 10% off at 3 months, 20% at 6.
const hero = plan({ id: 6777, name: 'Plano Hero', classesPerMonth: 12,
  paymentOptions: [option(1, 67), option(3, 180), option(6, 322)] });
const contender = plan({ id: 6776, name: 'Contender', classesPerMonth: 8,
  paymentOptions: [option(1, 60), option(3, 162), option(6, 288)] });
// Kids caps both per week and per month, which is why weeklyCap exists.
const kids = plan({ id: 7098, name: 'KIDS', classesPerWeek: 3, classesPerMonth: 12,
  paymentOptions: [option(1, 60), option(3, 162), option(6, 288)] });
const premium = plan({ id: 6778, name: 'PREMIUM', isUnlimited: true, registrationFee: 0,
  paymentOptions: [option(1, 75), option(3, 202), option(6, 360)] });
const experimental = plan({ id: 14172, type: 'class_pass', name: 'Experimental',
  numberOfClasses: 1, validDays: 30, registrationFee: 0, paymentOptions: [option(null, 0)] });
const monthlyOnly = plan({ id: 6294, name: 'PT 8 Passes', classesPerMonth: 8,
  paymentOptions: [option(1, 400)] });

const paidGroup = [kids, hero, contender, premium];

describe('groupSortKey', () => {
  it('sends unsorted plans to the end instead of the front', () => {
    // Yogo stamps -1 on a plan whose position was never set, and editing a plan
    // resets it — so -1 must not outrank an explicit 1.
    expect(groupSortKey(-1)).toBeGreaterThan(groupSortKey(1));
    expect(groupSortKey(null)).toBeGreaterThan(groupSortKey(3));
  });

  it('keeps explicit positions, zero included', () => {
    expect(groupSortKey(0)).toBe(0);
    expect(groupSortKey(2)).toBe(2);
  });
});

describe('planQuota', () => {
  it('reports a monthly cap even when no weekly cap is set', () => {
    // The regression: every Yogo plan has has_max_number_of_classes_per_week = false,
    // so testing isUnlimited first made 12- and 8-pass plans read as unlimited.
    expect(planQuota(hero)).toEqual({ kind: 'perMonth', count: 12 });
    expect(planQuota(contender)).toEqual({ kind: 'perMonth', count: 8 });
  });

  it('keeps genuinely uncapped plans unlimited', () => {
    expect(planQuota(premium)).toEqual({ kind: 'unlimited' });
    expect(planQuota(plan({ isUnlimited: true }))).toEqual({ kind: 'unlimited' });
  });

  it('counts passes for class passes', () => {
    expect(planQuota(experimental)).toEqual({ kind: 'passes', count: 1 });
  });

  it('labels a countless class pass as a pack', () => {
    expect(planQuota(plan({ type: 'class_pass' }))).toEqual({ kind: 'classPack' });
  });

  it('quotes a monthly cap when a plan carries both, so cards share one unit', () => {
    expect(planQuota(plan({ classesPerWeek: 3, classesPerMonth: 12 })))
      .toEqual({ kind: 'perMonth', count: 12 });
  });

  it('falls back to the weekly cap when that is the only one', () => {
    expect(planQuota(plan({ classesPerWeek: 3 }))).toEqual({ kind: 'perWeek', count: 3 });
  });
});

describe('weeklyCap', () => {
  it('reports a weekly cap only when the eyebrow is showing the monthly one', () => {
    expect(weeklyCap(kids)).toBe(3);
    expect(weeklyCap(plan({ classesPerWeek: 3 }))).toBeNull();
    expect(weeklyCap(hero)).toBeNull();
  });
});

describe('groupDurations', () => {
  it('collects distinct months ascending', () => {
    expect(groupDurations(paidGroup)).toEqual([1, 3, 6]);
  });

  it('ignores class passes, which have no period', () => {
    expect(groupDurations([experimental])).toEqual([]);
  });
});

describe('resolveOption', () => {
  it('returns the exact match when the plan sells that duration', () => {
    expect(resolveOption(hero, 6)?.price).toBe(322);
  });

  it('falls back to the longest shorter option instead of hiding the plan', () => {
    expect(resolveOption(monthlyOnly, 6)).toEqual(option(1, 400));
  });

  it('falls back to the cheapest when only longer options exist', () => {
    const noMonthly = plan({ paymentOptions: [option(3, 162), option(6, 324)] });
    expect(resolveOption(noMonthly, 1)?.months).toBe(3);
  });

  it('returns the single option for a class pass', () => {
    expect(resolveOption(experimental, 3)?.price).toBe(0);
  });

  it('returns undefined when there is nothing to sell', () => {
    expect(resolveOption(plan({ paymentOptions: [] }), 1)).toBeUndefined();
  });
});

describe('monthlyEquivalent', () => {
  it('divides a multi-month total', () => {
    expect(monthlyEquivalent(option(6, 324))).toBe(54);
    expect(monthlyEquivalent(option(3, 180))).toBe(60);
  });

  it('leaves single-month and period-less options alone', () => {
    expect(monthlyEquivalent(option(1, 67))).toBe(67);
    expect(monthlyEquivalent(option(null, 0))).toBe(0);
  });
});

describe('durationSaving', () => {
  it('reports the shared discount when plans agree', () => {
    // 3 months: Kids/Contender exactly 10%, Hero 10.4%, Premium 10.2% — within tolerance.
    expect(durationSaving(paidGroup, 3)).toEqual({ percent: 10, uniform: true });
    expect(durationSaving(paidGroup, 6)).toEqual({ percent: 20, uniform: true });
  });

  it('rounds rather than floors, so 19.9% is not advertised as 19%', () => {
    // Hero at 322€ over 6 months is 19.901% off its 67€ monthly rate.
    expect(durationSaving([hero], 6)?.percent).toBe(20);
  });

  it('flags a non-uniform group so the copy can say "up to"', () => {
    const shallow = plan({ id: 2, paymentOptions: [option(1, 60), option(6, 342)] }); // 5%
    expect(durationSaving([kids, shallow], 6)).toEqual({ percent: 20, uniform: false });
  });

  it('returns null for the monthly option and for negligible discounts', () => {
    expect(durationSaving(paidGroup, 1)).toBeNull();
    const flat = plan({ paymentOptions: [option(1, 60), option(6, 360)] });
    expect(durationSaving([flat], 6)).toBeNull();
  });
});

describe('perClassPrice', () => {
  it('reconciles with the price the card is showing', () => {
    // 162€ over 3 months is 54€/month, so 12 classes must read 4,50€ — not the 5,00€
    // the base monthly rate would give.
    expect(perClassPrice(kids, option(1, 60))).toBeCloseTo(5);
    expect(perClassPrice(kids, option(3, 162))).toBeCloseTo(4.5);
    expect(perClassPrice(kids, option(6, 288))).toBeCloseTo(4);
  });

  it('divides the exact total, not the rounded monthly figure', () => {
    // 322/6 rounds to 54€/month on the card, but 322/6/12 is 4,472 not 4,5.
    expect(perClassPrice(hero, option(6, 322))).toBeCloseTo(322 / 6 / 12);
  });

  it('uses the pass total for class passes, which have no period', () => {
    expect(perClassPrice(plan({ type: 'class_pass', numberOfClasses: 4 }), option(null, 30)))
      .toBe(7.5);
  });

  it('is null when the plan is unlimited or free', () => {
    expect(perClassPrice(premium, option(1, 75))).toBeNull();
    expect(perClassPrice(experimental, option(null, 0))).toBeNull();
  });
});

describe('isFreeItem', () => {
  it('recognises the trial pass', () => {
    expect(isFreeItem(experimental)).toBe(true);
    expect(isFreeItem(kids)).toBe(false);
  });

  it('is false for a plan with no options at all', () => {
    expect(isFreeItem(plan({ paymentOptions: [] }))).toBe(false);
  });
});
