import { describe, it, expect } from 'vitest';
import { validateMemberAccess, MemberAccessParams } from '../checkin-rules';

describe('validateMemberAccess', () => {
  // Fixed date for deterministic tests
  const today = new Date('2026-01-15');

  describe('Status checks', () => {
    it('blocks BLOQUEADO member', () => {
      const member: MemberAccessParams = {
        status: 'BLOQUEADO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: '2026-12-31',
        credits_remaining: null,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(false);
      expect(result.result).toBe('BLOCKED');
      expect(result.message).toContain('bloqueado');
    });

    it('blocks CANCELADO member', () => {
      const member: MemberAccessParams = {
        status: 'CANCELADO',
        access_type: null,
        access_expires_at: null,
        credits_remaining: null,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(false);
      expect(result.result).toBe('BLOCKED');
      expect(result.message).toContain('cancelado');
    });

    it('blocks PAUSADO member', () => {
      const member: MemberAccessParams = {
        status: 'PAUSADO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: '2026-12-31',
        credits_remaining: null,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(false);
      expect(result.result).toBe('BLOCKED');
      expect(result.message).toContain('pausada');
    });

    it('rejects LEAD without access', () => {
      const member: MemberAccessParams = {
        status: 'LEAD',
        access_type: null,
        access_expires_at: null,
        credits_remaining: null,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(false);
      expect(result.result).toBe('EXPIRED');
      expect(result.message).toContain('sem plano ativo');
    });

    it('rejects ATIVO without access_type', () => {
      const member: MemberAccessParams = {
        status: 'ATIVO',
        access_type: null,
        access_expires_at: null,
        credits_remaining: null,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(false);
      expect(result.result).toBe('EXPIRED');
    });
  });

  describe('Subscription checks', () => {
    it('allows ATIVO with valid subscription', () => {
      const member: MemberAccessParams = {
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: '2026-02-15', // Future date
        credits_remaining: null,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(true);
      expect(result.result).toBe('ALLOWED');
    });

    it('allows subscription expiring today', () => {
      const member: MemberAccessParams = {
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: '2026-01-15', // Same day
        credits_remaining: null,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(true);
      expect(result.result).toBe('ALLOWED');
    });

    it('rejects expired subscription', () => {
      const member: MemberAccessParams = {
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: '2026-01-01', // Past date
        credits_remaining: null,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(false);
      expect(result.result).toBe('EXPIRED');
      expect(result.message).toContain('expirado');
    });

    it('allows subscription without expiration date', () => {
      const member: MemberAccessParams = {
        status: 'ATIVO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: null, // No expiration
        credits_remaining: null,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(true);
      expect(result.result).toBe('ALLOWED');
    });
  });

  describe('Credits checks', () => {
    it('allows ATIVO with credits remaining', () => {
      const member: MemberAccessParams = {
        status: 'ATIVO',
        access_type: 'CREDITS',
        access_expires_at: '2026-12-31',
        credits_remaining: 5,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(true);
      expect(result.result).toBe('ALLOWED');
    });

    it('allows with exactly 1 credit', () => {
      const member: MemberAccessParams = {
        status: 'ATIVO',
        access_type: 'CREDITS',
        access_expires_at: '2026-12-31',
        credits_remaining: 1,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(true);
    });

    it('rejects with 0 credits', () => {
      const member: MemberAccessParams = {
        status: 'ATIVO',
        access_type: 'CREDITS',
        access_expires_at: '2026-12-31',
        credits_remaining: 0,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(false);
      expect(result.result).toBe('NO_CREDITS');
      expect(result.message).toContain('créditos');
    });

    it('rejects with null credits', () => {
      const member: MemberAccessParams = {
        status: 'ATIVO',
        access_type: 'CREDITS',
        access_expires_at: '2026-12-31',
        credits_remaining: null,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(false);
      expect(result.result).toBe('NO_CREDITS');
    });

    it('rejects with negative credits', () => {
      const member: MemberAccessParams = {
        status: 'ATIVO',
        access_type: 'CREDITS',
        access_expires_at: '2026-12-31',
        credits_remaining: -1,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(false);
      expect(result.result).toBe('NO_CREDITS');
    });
  });

  describe('Daily Pass checks', () => {
    it('allows daily pass on same day', () => {
      const member: MemberAccessParams = {
        status: 'ATIVO',
        access_type: 'DAILY_PASS',
        access_expires_at: '2026-01-15', // Same day
        credits_remaining: null,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(true);
      expect(result.result).toBe('ALLOWED');
    });

    it('rejects expired daily pass', () => {
      const member: MemberAccessParams = {
        status: 'ATIVO',
        access_type: 'DAILY_PASS',
        access_expires_at: '2026-01-14', // Yesterday
        credits_remaining: null,
      };

      const result = validateMemberAccess(member, today);

      expect(result.allowed).toBe(false);
      expect(result.result).toBe('EXPIRED');
    });
  });

  describe('Priority order', () => {
    it('BLOQUEADO takes priority over expired subscription', () => {
      const member: MemberAccessParams = {
        status: 'BLOQUEADO',
        access_type: 'SUBSCRIPTION',
        access_expires_at: '2020-01-01', // Very expired
        credits_remaining: null,
      };

      const result = validateMemberAccess(member, today);

      expect(result.result).toBe('BLOCKED');
    });

    it('PAUSADO takes priority over no credits', () => {
      const member: MemberAccessParams = {
        status: 'PAUSADO',
        access_type: 'CREDITS',
        access_expires_at: '2026-12-31',
        credits_remaining: 0,
      };

      const result = validateMemberAccess(member, today);

      expect(result.result).toBe('BLOCKED');
    });
  });
});
