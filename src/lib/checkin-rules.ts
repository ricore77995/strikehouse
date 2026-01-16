/**
 * Check-in Rules - Pure business logic without dependencies
 *
 * This module contains the validation rules for member access.
 * All functions are pure (no side effects, no DB calls, no React hooks).
 * This allows for easy unit testing of business rules.
 */

export type MemberStatus = 'LEAD' | 'ATIVO' | 'BLOQUEADO' | 'PAUSADO' | 'CANCELADO';
export type AccessType = 'SUBSCRIPTION' | 'CREDITS' | 'DAILY_PASS' | null;
export type CheckinResultType = 'ALLOWED' | 'BLOCKED' | 'EXPIRED' | 'NO_CREDITS';

export interface MemberAccessParams {
  status: MemberStatus;
  access_type: AccessType;
  access_expires_at: string | null;
  credits_remaining: number | null;
}

export interface ValidationResult {
  allowed: boolean;
  result: CheckinResultType;
  message: string;
}

/**
 * Validate member access based on business rules.
 *
 * Validation order:
 * 1. Status BLOQUEADO → BLOCKED
 * 2. Status CANCELADO → BLOCKED
 * 3. Status PAUSADO → BLOCKED
 * 4. Status LEAD or no access_type → EXPIRED
 * 5. SUBSCRIPTION/DAILY_PASS expired → EXPIRED
 * 6. CREDITS with 0 remaining → NO_CREDITS
 * 7. All passed → ALLOWED
 *
 * @param member - Member access parameters
 * @param today - Current date (injectable for testing)
 * @returns Validation result with allowed flag, result type, and message
 */
export function validateMemberAccess(
  member: MemberAccessParams,
  today: Date = new Date()
): ValidationResult {
  // Rule 1: Status blocked
  if (member.status === 'BLOQUEADO') {
    return {
      allowed: false,
      result: 'BLOCKED',
      message: 'Membro bloqueado. Entre em contato com a recepção.',
    };
  }

  // Rule 2: Status cancelled
  if (member.status === 'CANCELADO') {
    return {
      allowed: false,
      result: 'BLOCKED',
      message: 'Membro cancelado. Entre em contato com a recepção.',
    };
  }

  // Rule 3: Status paused (freeze)
  if (member.status === 'PAUSADO') {
    return {
      allowed: false,
      result: 'BLOCKED',
      message: 'Subscrição pausada. Entre em contato com a recepção para reativar.',
    };
  }

  // Rule 4: LEAD without access
  if (member.status === 'LEAD' || !member.access_type) {
    return {
      allowed: false,
      result: 'EXPIRED',
      message: 'Membro sem plano ativo. Favor regularizar situação.',
    };
  }

  // Rule 5: Subscription/Daily Pass expired
  if (member.access_type === 'SUBSCRIPTION' || member.access_type === 'DAILY_PASS') {
    if (member.access_expires_at) {
      const expiresAt = new Date(member.access_expires_at);
      const todayMidnight = new Date(today);
      todayMidnight.setHours(0, 0, 0, 0);

      if (expiresAt < todayMidnight) {
        return {
          allowed: false,
          result: 'EXPIRED',
          message: `Acesso expirado em ${expiresAt.toLocaleDateString('pt-BR')}. Favor renovar.`,
        };
      }
    }
  }

  // Rule 6: Credits exhausted
  if (member.access_type === 'CREDITS') {
    if (!member.credits_remaining || member.credits_remaining <= 0) {
      return {
        allowed: false,
        result: 'NO_CREDITS',
        message: 'Sem créditos disponíveis. Favor adquirir mais créditos.',
      };
    }
  }

  // All rules passed
  return {
    allowed: true,
    result: 'ALLOWED',
    message: 'Acesso liberado!',
  };
}
