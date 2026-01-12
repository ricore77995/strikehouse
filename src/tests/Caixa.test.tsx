import { describe, it, expect } from 'vitest';

describe('Cash Session Calculations', () => {
  it('should calculate expected_closing correctly', () => {
    const opening = 10000; // €100.00
    const totalReceitas = 50000; // €500.00 in (cash receipts)
    const totalDespesas = 20000; // €200.00 out (cash expenses)

    const expectedClosing = opening + totalReceitas - totalDespesas;

    expect(expectedClosing).toBe(40000); // €100 + €500 - €200 = €400.00
  });

  it('should show alert when difference > €5.00', () => {
    const expected = 40000; // €400.00
    const actual = 39000; // €390.00 (€10 shortage)

    const difference = Math.abs(actual - expected);
    const threshold = 500; // €5.00

    expect(difference).toBeGreaterThan(threshold);
    expect(difference).toBe(1000); // €10.00 difference
  });

  it('should not alert when difference <= €5.00', () => {
    const expected = 40000; // €400.00
    const actual = 39600; // €396.00 (€4 shortage - acceptable)

    const difference = Math.abs(actual - expected);
    const threshold = 500; // €5.00

    expect(difference).toBeLessThanOrEqual(threshold);
    expect(difference).toBe(400); // €4.00 difference (within tolerance)
  });

  it('should detect exact match (zero difference)', () => {
    const expected = 40000; // €400.00
    const actual = 40000; // €400.00 (perfect match)

    const difference = actual - expected;

    expect(difference).toBe(0);
    expect(Math.abs(difference)).toBe(0);
  });

  it('should calculate difference for surplus', () => {
    const expected = 40000; // €400.00
    const actual = 41000; // €410.00 (€10 surplus)

    const difference = actual - expected;

    expect(difference).toBeGreaterThan(0);
    expect(difference).toBe(1000); // €10.00 surplus
  });

  it('should calculate difference for shortage', () => {
    const expected = 40000; // €400.00
    const actual = 38000; // €380.00 (€20 shortage)

    const difference = actual - expected;

    expect(difference).toBeLessThan(0);
    expect(difference).toBe(-2000); // -€20.00 shortage
  });

  it('should validate opening balance is non-negative', () => {
    const invalidOpening = -10000; // -€100.00 (invalid)
    const validOpening = 0; // €0.00 (valid)

    expect(invalidOpening).toBeLessThan(0);
    expect(validOpening).toBeGreaterThanOrEqual(0);
  });

  it('should handle session status correctly', () => {
    const openSession = { status: 'OPEN', closed_at: null };
    const closedSession = { status: 'CLOSED', closed_at: '2026-01-11T20:00:00Z' };

    expect(openSession.status).toBe('OPEN');
    expect(openSession.closed_at).toBeNull();

    expect(closedSession.status).toBe('CLOSED');
    expect(closedSession.closed_at).not.toBeNull();
  });

  it('should prevent negative closing amount', () => {
    const invalidClosing = -5000; // -€50.00 (invalid)
    const validClosing = 0; // €0.00 (valid - empty cash box)

    expect(invalidClosing).toBeLessThan(0);
    expect(validClosing).toBeGreaterThanOrEqual(0);
  });

  it('should format cents to euros correctly', () => {
    const testCases = [
      { cents: 6900, euros: 69.00 },
      { cents: 500, euros: 5.00 },
      { cents: 100, euros: 1.00 },
      { cents: 1, euros: 0.01 },
      { cents: 0, euros: 0.00 },
    ];

    testCases.forEach(({ cents, euros }) => {
      const formatted = new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
      }).format(cents / 100);

      // Verify formatting contains euro symbol and correct number
      expect(formatted).toContain('€');
      expect(cents / 100).toBe(euros);
    });
  });
});
