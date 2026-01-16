import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateFreezeRequest,
  calculateNewExpiresAt,
  isCurrentlyFrozen,
  getRemainingFreezeDays,
  formatFreezePeriod,
  MAX_FREEZE_DAYS_PER_YEAR,
  type FreezeHistory,
} from '../subscription-freeze';

describe('validateFreezeRequest', () => {
  beforeEach(() => {
    // Mock current year to 2026 for deterministic tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts request within annual limit', () => {
    const result = validateFreezeRequest([], 7);

    expect(result.valid).toBe(true);
    expect(result.remainingDays).toBe(MAX_FREEZE_DAYS_PER_YEAR);
  });

  it('rejects request exceeding limit', () => {
    const history: FreezeHistory[] = [
      { frozen_at: '2026-01-01', frozen_until: '2026-01-25' }, // 24 days used
    ];

    const result = validateFreezeRequest(history, 10); // Asks for 10, only 6 available

    expect(result.valid).toBe(false);
    expect(result.remainingDays).toBe(6);
    expect(result.error).toContain('6 dias');
  });

  it('allows staff override beyond limit', () => {
    const history: FreezeHistory[] = [
      { frozen_at: '2026-01-01', frozen_until: '2026-01-30' }, // 29 days used
    ];

    const result = validateFreezeRequest(history, 10, true); // isStaffOverride

    expect(result.valid).toBe(true);
  });

  it('rejects 0 days', () => {
    const result = validateFreezeRequest([], 0);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalido');
  });

  it('rejects negative days', () => {
    const result = validateFreezeRequest([], -5);

    expect(result.valid).toBe(false);
  });

  it('ignores history from previous years', () => {
    const history: FreezeHistory[] = [
      { frozen_at: '2025-01-01', frozen_until: '2025-01-30' }, // Last year - ignored
    ];

    const result = validateFreezeRequest(history, 30);

    expect(result.valid).toBe(true);
    expect(result.remainingDays).toBe(30); // Full allowance available
  });

  it('accumulates multiple freezes in same year', () => {
    const history: FreezeHistory[] = [
      { frozen_at: '2026-01-01', frozen_until: '2026-01-11' }, // 10 days
      { frozen_at: '2026-02-01', frozen_until: '2026-02-11' }, // 10 days
    ];

    const result = validateFreezeRequest(history, 15); // Asks for 15, only 10 available

    expect(result.valid).toBe(false);
    expect(result.remainingDays).toBe(10);
  });

  it('allows exactly remaining days', () => {
    const history: FreezeHistory[] = [
      { frozen_at: '2026-01-01', frozen_until: '2026-01-21' }, // 20 days used
    ];

    const result = validateFreezeRequest(history, 10); // Exactly 10 remaining

    expect(result.valid).toBe(true);
    expect(result.remainingDays).toBe(10);
  });
});

describe('calculateNewExpiresAt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('extends expiration by freeze days', () => {
    const freezeUntil = new Date('2026-01-22'); // 7 days from "today" (Jan 15)
    const result = calculateNewExpiresAt('2026-02-15', freezeUntil);

    expect(result).toBe('2026-02-22');
  });

  it('handles month rollover', () => {
    const freezeUntil = new Date('2026-01-25'); // 10 days from "today"
    const result = calculateNewExpiresAt('2026-02-25', freezeUntil);

    expect(result).toBe('2026-03-07');
  });

  it('handles year rollover', () => {
    vi.setSystemTime(new Date('2026-12-20'));
    const freezeUntil = new Date('2026-12-30'); // 10 days
    const result = calculateNewExpiresAt('2026-12-31', freezeUntil);

    expect(result).toBe('2027-01-10');
  });
});

describe('isCurrentlyFrozen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false without dates', () => {
    expect(isCurrentlyFrozen(null, null)).toBe(false);
  });

  it('returns false with only start date', () => {
    expect(isCurrentlyFrozen('2026-01-10', null)).toBe(false);
  });

  it('returns false with only end date', () => {
    expect(isCurrentlyFrozen(null, '2026-01-20')).toBe(false);
  });

  it('returns true during freeze period', () => {
    vi.setSystemTime(new Date('2026-01-15'));
    const result = isCurrentlyFrozen('2026-01-10', '2026-01-20');

    expect(result).toBe(true);
  });

  it('returns true on start date', () => {
    vi.setSystemTime(new Date('2026-01-10'));
    const result = isCurrentlyFrozen('2026-01-10', '2026-01-20');

    expect(result).toBe(true);
  });

  it('returns true on end date', () => {
    vi.setSystemTime(new Date('2026-01-20'));
    const result = isCurrentlyFrozen('2026-01-10', '2026-01-20');

    expect(result).toBe(true);
  });

  it('returns false before freeze period', () => {
    vi.setSystemTime(new Date('2026-01-05'));
    const result = isCurrentlyFrozen('2026-01-10', '2026-01-20');

    expect(result).toBe(false);
  });

  it('returns false after freeze period', () => {
    vi.setSystemTime(new Date('2026-01-25'));
    const result = isCurrentlyFrozen('2026-01-10', '2026-01-20');

    expect(result).toBe(false);
  });
});

describe('getRemainingFreezeDays', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns max days without history', () => {
    expect(getRemainingFreezeDays([])).toBe(MAX_FREEZE_DAYS_PER_YEAR);
  });

  it('subtracts used days', () => {
    const history: FreezeHistory[] = [
      { frozen_at: '2026-01-01', frozen_until: '2026-01-11' }, // 10 days
    ];

    expect(getRemainingFreezeDays(history)).toBe(20);
  });

  it('accumulates multiple freezes', () => {
    const history: FreezeHistory[] = [
      { frozen_at: '2026-01-01', frozen_until: '2026-01-08' }, // 7 days
      { frozen_at: '2026-02-01', frozen_until: '2026-02-08' }, // 7 days
    ];

    expect(getRemainingFreezeDays(history)).toBe(16);
  });

  it('ignores previous year history', () => {
    const history: FreezeHistory[] = [
      { frozen_at: '2025-01-01', frozen_until: '2025-01-30' }, // Last year
    ];

    expect(getRemainingFreezeDays(history)).toBe(30);
  });

  it('returns 0 when all days used', () => {
    const history: FreezeHistory[] = [
      { frozen_at: '2026-01-01', frozen_until: '2026-01-31' }, // 30 days
    ];

    expect(getRemainingFreezeDays(history)).toBe(0);
  });

  it('never returns negative', () => {
    const history: FreezeHistory[] = [
      { frozen_at: '2026-01-01', frozen_until: '2026-02-10' }, // 40 days (override)
    ];

    expect(getRemainingFreezeDays(history)).toBe(0);
  });
});

describe('formatFreezePeriod', () => {
  it('formats period correctly', () => {
    const result = formatFreezePeriod('2026-01-10', '2026-01-20');

    expect(result).toContain('10/01/2026');
    expect(result).toContain('20/01/2026');
    expect(result).toContain('10 dias');
  });

  it('calculates correct day count', () => {
    const result = formatFreezePeriod('2026-01-01', '2026-01-08');

    expect(result).toContain('7 dias');
  });
});
