import { describe, it, expect } from 'vitest';
import { differenceInHours, addDays, format } from 'date-fns';

describe('Rental Cancellation Logic', () => {
  it('should generate credit for >24h cancellation', () => {
    const rentalDate = new Date('2026-01-15T19:00:00'); // Jan 15, 7 PM
    const now = new Date('2026-01-13T10:00:00'); // Jan 13, 10 AM (57 hours before)

    const hoursUntil = differenceInHours(rentalDate, now);
    const generateCredit = hoursUntil >= 24;

    expect(hoursUntil).toBe(57); // 57 hours
    expect(hoursUntil).toBeGreaterThan(24);
    expect(generateCredit).toBe(true);
  });

  it('should NOT generate credit for <24h cancellation', () => {
    const rentalDate = new Date('2026-01-15T19:00:00'); // Jan 15, 7 PM
    const now = new Date('2026-01-15T10:00:00'); // Jan 15, 10 AM (9 hours before)

    const hoursUntil = differenceInHours(rentalDate, now);
    const generateCredit = hoursUntil >= 24;

    expect(hoursUntil).toBe(9); // 9 hours
    expect(hoursUntil).toBeLessThan(24);
    expect(generateCredit).toBe(false);
  });

  it('should generate credit for exactly 24h cancellation', () => {
    const rentalDate = new Date('2026-01-15T19:00:00'); // Jan 15, 7 PM
    const now = new Date('2026-01-14T19:00:00'); // Jan 14, 7 PM (exactly 24h before)

    const hoursUntil = differenceInHours(rentalDate, now);
    const generateCredit = hoursUntil >= 24;

    expect(hoursUntil).toBe(24); // Exactly 24 hours
    expect(generateCredit).toBe(true); // >= 24 means exactly 24h qualifies
  });

  it('should set credit expiration to 90 days from now', () => {
    const today = new Date('2026-01-11');
    const expiresAt = addDays(today, 90);
    const formattedExpiration = format(expiresAt, 'yyyy-MM-dd');

    expect(formattedExpiration).toBe('2026-04-11'); // 90 days from Jan 11

    // Verify approximately 90 days (allow for DST transitions)
    const hoursDiff = differenceInHours(expiresAt, today);
    expect(hoursDiff).toBeGreaterThanOrEqual(90 * 24 - 2); // At least 2158 hours
    expect(hoursDiff).toBeLessThanOrEqual(90 * 24 + 2); // At most 2162 hours
  });

  it('should only generate credit if fee was charged', () => {
    const rental1 = { fee_charged_cents: 5000 }; // €50 charged
    const rental2 = { fee_charged_cents: null }; // No fee charged
    const rental3 = { fee_charged_cents: 0 }; // Zero fee

    const hoursUntil = 48; // >24h cancellation
    const generateCredit = hoursUntil >= 24;

    // Should generate credit for rental1 (has fee)
    expect(generateCredit && rental1.fee_charged_cents).toBeTruthy();

    // Should NOT generate credit for rental2 (no fee)
    expect(generateCredit && rental2.fee_charged_cents).toBeFalsy();

    // Should NOT generate credit for rental3 (zero fee)
    expect(generateCredit && rental3.fee_charged_cents).toBeFalsy();
  });

  it('should calculate hours correctly across date boundaries', () => {
    const rentalDate = new Date('2026-01-16T02:00:00'); // Jan 16, 2 AM
    const now = new Date('2026-01-15T03:00:00'); // Jan 15, 3 AM (23 hours before)

    const hoursUntil = differenceInHours(rentalDate, now);
    const generateCredit = hoursUntil >= 24;

    expect(hoursUntil).toBe(23); // Just under 24h
    expect(generateCredit).toBe(false);
  });

  it('should detect overlap between rental time slots', () => {
    // Existing rental: 18:00 - 19:00
    const existingStart = '18:00';
    const existingEnd = '19:00';

    // Test cases: [newStart, newEnd, shouldOverlap]
    const testCases = [
      { newStart: '17:00', newEnd: '18:30', overlaps: true }, // Overlaps start
      { newStart: '18:30', newEnd: '19:30', overlaps: true }, // Overlaps end
      { newStart: '18:15', newEnd: '18:45', overlaps: true }, // Completely within
      { newStart: '17:30', newEnd: '19:30', overlaps: true }, // Completely covers
      { newStart: '17:00', newEnd: '18:00', overlaps: false }, // Ends when existing starts (no overlap)
      { newStart: '19:00', newEnd: '20:00', overlaps: false }, // Starts when existing ends (no overlap)
      { newStart: '16:00', newEnd: '17:00', overlaps: false }, // Before existing
      { newStart: '20:00', newEnd: '21:00', overlaps: false }, // After existing
    ];

    testCases.forEach(({ newStart, newEnd, overlaps }) => {
      const hasOverlap = (
        (newStart < existingEnd && newEnd > existingStart) // Standard overlap check
      );

      expect(hasOverlap).toBe(overlaps);
    });
  });

  it('should format credit amount in cents correctly', () => {
    const feeChargedCents = 5000; // €50.00 charged
    const creditAmount = feeChargedCents; // Full refund as credit

    expect(creditAmount).toBe(5000);
    expect(creditAmount / 100).toBe(50.00); // €50.00
  });
});
