import { describe, it, expect } from 'vitest';
import { differenceInDays } from 'date-fns';

describe('Financial Calculations', () => {
  describe('Billing', () => {
    it('calculate days overdue', () => {
      const expiresAt = new Date('2026-01-01');
      const today = new Date('2026-01-10');
      const diasAtraso = differenceInDays(today, expiresAt);

      expect(diasAtraso).toBe(9);
    });

    it('calculate days remaining', () => {
      const expiresAt = new Date('2026-01-20');
      const today = new Date('2026-01-10');
      const diasRestantes = differenceInDays(expiresAt, today);

      expect(diasRestantes).toBe(10);
    });

    it('calculate days remaining for expiring today', () => {
      const today = new Date('2026-01-12');
      const expiresAt = new Date('2026-01-12');
      const diasRestantes = differenceInDays(expiresAt, today);

      expect(diasRestantes).toBe(0);
    });

    it('identify members expiring within 7 days', () => {
      const today = new Date('2026-01-12');
      const sevenDaysFromNow = new Date('2026-01-19');

      const members = [
        { id: '1', access_expires_at: '2026-01-15' }, // 3 days - YES
        { id: '2', access_expires_at: '2026-01-18' }, // 6 days - YES
        { id: '3', access_expires_at: '2026-01-20' }, // 8 days - NO
        { id: '4', access_expires_at: '2026-01-11' }, // -1 day (expired) - NO
      ];

      const expiringSoon = members.filter((member) => {
        const expiresAt = new Date(member.access_expires_at);
        const daysRemaining = differenceInDays(expiresAt, today);
        return daysRemaining >= 0 && daysRemaining <= 7;
      });

      expect(expiringSoon).toHaveLength(2);
      expect(expiringSoon.map(m => m.id)).toEqual(['1', '2']);
    });
  });

  describe('Cash Session', () => {
    it('calculate expected closing', () => {
      const opening = 10000; // €100.00 in cents
      const receitas = 50000; // €500.00 in cents
      const despesas = 20000; // €200.00 in cents
      const expected = opening + receitas - despesas;

      expect(expected).toBe(40000); // €400.00 in cents
    });

    it('detect difference above threshold', () => {
      const expected = 40000; // €400.00
      const actual = 39000; // €390.00
      const diff = Math.abs(actual - expected);
      const threshold = 500; // €5.00

      expect(diff).toBeGreaterThan(threshold);
      expect(diff).toBe(1000); // €10.00 difference
    });

    it('detect difference within threshold', () => {
      const expected = 40000; // €400.00
      const actual = 39800; // €398.00
      const diff = Math.abs(actual - expected);
      const threshold = 500; // €5.00

      expect(diff).toBeLessThanOrEqual(threshold);
      expect(diff).toBe(200); // €2.00 difference - acceptable
    });

    it('handle zero opening balance', () => {
      const opening = 0;
      const receitas = 25000; // €250.00
      const despesas = 5000; // €50.00
      const expected = opening + receitas - despesas;

      expect(expected).toBe(20000); // €200.00
    });
  });

  describe('Rental Fees', () => {
    it('calculate FIXED fee', () => {
      const coach = {
        fee_type: 'FIXED',
        fee_fixed_cents: 5000, // €50.00
      };

      const fee = coach.fee_fixed_cents;

      expect(fee).toBe(5000); // €50.00
    });

    it('calculate PERCENTAGE fee', () => {
      const coach = {
        fee_type: 'PERCENTAGE',
        fee_percentage_cents: 1500, // 15% (stored as 1500 = 15.00%)
      };

      const planBase = 6900; // €69.00 plan price

      // Calculate 15% of €69.00
      const fee = Math.round((planBase * coach.fee_percentage_cents) / 10000);

      expect(fee).toBe(1035); // €10.35 (15% of €69.00)
    });

    it('calculate PERCENTAGE fee for different amounts', () => {
      const coach = {
        fee_type: 'PERCENTAGE',
        fee_percentage_cents: 2000, // 20%
      };

      const smallAmount = 3000; // €30.00
      const largeAmount = 10000; // €100.00

      const smallFee = Math.round((smallAmount * coach.fee_percentage_cents) / 10000);
      const largeFee = Math.round((largeAmount * coach.fee_percentage_cents) / 10000);

      expect(smallFee).toBe(600); // €6.00 (20% of €30)
      expect(largeFee).toBe(2000); // €20.00 (20% of €100)
    });

    it('handle zero fee (free rental)', () => {
      const coach = {
        fee_type: 'FIXED',
        fee_fixed_cents: 0, // Free
      };

      const fee = coach.fee_fixed_cents;

      expect(fee).toBe(0);
    });
  });

  describe('Currency Formatting', () => {
    it('cents to euros', () => {
      const cents = 6900;
      const euros = cents / 100;

      expect(euros).toBe(69.00);
    });

    it('euros to cents', () => {
      const euros = 69.50;
      const cents = Math.round(euros * 100);

      expect(cents).toBe(6950);
    });

    it('format Portuguese currency', () => {
      const amount = 69.50;

      const formatted = new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
      }).format(amount);

      expect(formatted).toContain('€');
      expect(formatted).toContain('69'); // Contains amount
      // Portuguese format uses comma as decimal separator
      expect(formatted).toMatch(/69[,,.]50/);
    });

    it('format large amounts correctly', () => {
      const amount = 1234.56;

      const formatted = new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
      }).format(amount);

      expect(formatted).toContain('€');
      expect(formatted).toContain('1'); // Thousands
      expect(formatted).toContain('234'); // Hundreds
      // Portuguese uses space or dot as thousands separator
    });

    it('handle zero amount', () => {
      const amount = 0;

      const formatted = new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
      }).format(amount);

      expect(formatted).toContain('€');
      expect(formatted).toContain('0');
    });

    it('prevent floating point errors in calculations', () => {
      // Floating point issue example: 0.1 + 0.2 !== 0.3
      // Solution: use cents (integers)

      const price1Cents = 1000; // €10.00
      const price2Cents = 1500; // €15.00
      const totalCents = price1Cents + price2Cents;

      expect(totalCents).toBe(2500); // Exact: €25.00

      // Verify no precision loss
      const totalEuros = totalCents / 100;
      expect(totalEuros).toBe(25.00);

      // Bad way (floating point):
      const price1Euros = 10.00;
      const price2Euros = 15.00;
      const totalFloating = price1Euros + price2Euros;

      // This works, but for many operations floating point can cause issues
      expect(totalFloating).toBe(25.00);

      // Example of floating point error:
      const badCalc1 = 0.1 + 0.2;
      expect(badCalc1).not.toBe(0.3); // Classic floating point issue!
      expect(badCalc1).toBeCloseTo(0.3, 10); // Need tolerance

      // Using cents avoids this:
      const goodCalc = 10 + 20; // cents
      expect(goodCalc).toBe(30); // Exact!
      expect(goodCalc / 100).toBe(0.3); // Perfect conversion
    });
  });
});
