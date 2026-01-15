// Subscription Freeze/Pause Utilities
// Gap 3: Subscription pause functionality

import { differenceInDays, addDays, format } from 'date-fns';

export interface FreezeValidationResult {
  valid: boolean;
  error?: string;
  remainingDays?: number;
}

export interface FreezeHistory {
  frozen_at: string;
  frozen_until: string;
}

/**
 * Maximum freeze days allowed per year
 */
export const MAX_FREEZE_DAYS_PER_YEAR = 30;

/**
 * Minimum days advance notice for member-initiated freeze
 */
export const MIN_FREEZE_ADVANCE_DAYS = 7;

/**
 * Validate if a freeze request is allowed
 */
export function validateFreezeRequest(
  freezeHistory: FreezeHistory[],
  requestedDays: number,
  isStaffOverride: boolean = false
): FreezeValidationResult {
  // Calculate total freeze days used this year
  const currentYear = new Date().getFullYear();
  const usedDays = freezeHistory
    .filter((h) => new Date(h.frozen_at).getFullYear() === currentYear)
    .reduce((total, h) => {
      const start = new Date(h.frozen_at);
      const end = new Date(h.frozen_until);
      return total + differenceInDays(end, start);
    }, 0);

  const remainingDays = MAX_FREEZE_DAYS_PER_YEAR - usedDays;

  if (requestedDays > remainingDays && !isStaffOverride) {
    return {
      valid: false,
      error: `Apenas ${remainingDays} dias de pausa disponiveis este ano. Maximo: ${MAX_FREEZE_DAYS_PER_YEAR} dias.`,
      remainingDays,
    };
  }

  if (requestedDays <= 0) {
    return {
      valid: false,
      error: 'Periodo de pausa invalido.',
      remainingDays,
    };
  }

  return { valid: true, remainingDays };
}

/**
 * Calculate new expiration date after freeze
 */
export function calculateNewExpiresAt(
  currentExpiresAt: string,
  freezeUntil: Date
): string {
  const freezeDays = differenceInDays(freezeUntil, new Date());
  const currentExpiry = new Date(currentExpiresAt);
  const newExpiry = addDays(currentExpiry, freezeDays);
  return format(newExpiry, 'yyyy-MM-dd');
}

/**
 * Format freeze dates for display
 */
export function formatFreezePeriod(frozenAt: string, frozenUntil: string): string {
  const start = new Date(frozenAt);
  const end = new Date(frozenUntil);
  const days = differenceInDays(end, start);
  return `${format(start, 'dd/MM/yyyy')} ate ${format(end, 'dd/MM/yyyy')} (${days} dias)`;
}

/**
 * Check if subscription is currently frozen
 */
export function isCurrentlyFrozen(
  frozenAt: string | null,
  frozenUntil: string | null
): boolean {
  if (!frozenAt || !frozenUntil) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(frozenAt);
  const end = new Date(frozenUntil);

  return today >= start && today <= end;
}

/**
 * Get remaining freeze days for the year
 */
export function getRemainingFreezeDays(freezeHistory: FreezeHistory[]): number {
  const currentYear = new Date().getFullYear();
  const usedDays = freezeHistory
    .filter((h) => new Date(h.frozen_at).getFullYear() === currentYear)
    .reduce((total, h) => {
      const start = new Date(h.frozen_at);
      const end = new Date(h.frozen_until);
      return total + differenceInDays(end, start);
    }, 0);

  return Math.max(0, MAX_FREEZE_DAYS_PER_YEAR - usedDays);
}
