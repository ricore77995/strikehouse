// Payment Methods (matches database CHECK constraint)
export const PaymentMethod = {
  DINHEIRO: 'DINHEIRO',
  CARTAO: 'CARTAO',
  MBWAY: 'MBWAY',
  TRANSFERENCIA: 'TRANSFERENCIA',
} as const;

export type PaymentMethodType = typeof PaymentMethod[keyof typeof PaymentMethod];

// Check-in Results (database-valid only)
export const CheckinResultDB = {
  ALLOWED: 'ALLOWED',
  BLOCKED: 'BLOCKED',
  EXPIRED: 'EXPIRED',
  NO_CREDITS: 'NO_CREDITS',
} as const;

export type CheckinResultDBType = typeof CheckinResultDB[keyof typeof CheckinResultDB];

// Check-in Results (extended for UI)
export const CheckinResultUI = {
  ...CheckinResultDB,
  NOT_FOUND: 'NOT_FOUND',
  AREA_EXCLUSIVE: 'AREA_EXCLUSIVE',
} as const;

export type CheckinResultUIType = typeof CheckinResultUI[keyof typeof CheckinResultUI];

// Member Status
export const MemberStatus = {
  LEAD: 'LEAD',
  ATIVO: 'ATIVO',
  BLOQUEADO: 'BLOQUEADO',
  CANCELADO: 'CANCELADO',
} as const;

export type MemberStatusType = typeof MemberStatus[keyof typeof MemberStatus];

// Access Types
export const AccessType = {
  SUBSCRIPTION: 'SUBSCRIPTION',
  CREDITS: 'CREDITS',
  DAILY_PASS: 'DAILY_PASS',
} as const;

export type AccessTypeType = typeof AccessType[keyof typeof AccessType];

// Transaction Types
export const TransactionType = {
  RECEITA: 'RECEITA',
  DESPESA: 'DESPESA',
} as const;

export type TransactionTypeType = typeof TransactionType[keyof typeof TransactionType];

// Staff Roles
export const StaffRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
  PARTNER: 'PARTNER',
} as const;

export type StaffRoleType = typeof StaffRole[keyof typeof StaffRole];

// Rental Status
export const RentalStatus = {
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type RentalStatusType = typeof RentalStatus[keyof typeof RentalStatus];

// Helper function to validate enum values
export const isValidEnum = <T extends Record<string, string>>(
  enumObj: T,
  value: string
): value is T[keyof T] => {
  return Object.values(enumObj).includes(value);
};
