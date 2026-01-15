import { SupabaseClient } from '@supabase/supabase-js';
import { format, addDays } from 'date-fns';

// ============================================
// ID Tracking for Cleanup
// ============================================

export const testDataIds = {
  members: [] as string[],
  coaches: [] as string[],
  rentals: [] as string[],
  areas: [] as string[],
  checkins: [] as string[],
  transactions: [] as string[],
  guests: [] as string[],
  credits: [] as string[],
};

export const resetTracking = () => {
  Object.keys(testDataIds).forEach((key) => {
    testDataIds[key as keyof typeof testDataIds] = [];
  });
};

// ============================================
// Factory Functions
// ============================================

interface CreateMemberOptions {
  nome?: string;
  telefone?: string;
  email?: string;
  status?: 'LEAD' | 'ATIVO' | 'BLOQUEADO' | 'CANCELADO';
  access_type?: 'SUBSCRIPTION' | 'CREDITS' | 'DAILY_PASS' | null;
  access_expires_at?: string | null;
  credits_remaining?: number;
  qr_code?: string;
}

export const createTestMember = async (
  client: SupabaseClient,
  overrides: CreateMemberOptions = {}
) => {
  const timestamp = Date.now();
  const randomChars = Math.random()
    .toString(36)
    .substring(2, 10)
    .toUpperCase()
    .replace(/[IO01]/g, 'X');

  const defaults: CreateMemberOptions = {
    nome: `E2E Test Member ${timestamp}`,
    telefone: `91${Math.floor(Math.random() * 10000000)
      .toString()
      .padStart(7, '0')}`,
    status: 'ATIVO',
    access_type: 'SUBSCRIPTION',
    access_expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    qr_code: `MBR-${randomChars}`,
  };

  const { data, error } = await client
    .from('members')
    .insert({ ...defaults, ...overrides })
    .select()
    .single();

  if (error) throw new Error(`Failed to create member: ${error.message}`);

  testDataIds.members.push(data.id);
  return data;
};

interface CreateCoachOptions {
  nome?: string;
  email?: string;
  telefone?: string;
  modalidade?: string;
  fee_type?: 'FIXED' | 'PERCENTAGE';
  fee_value?: number;
  credits_balance?: number;
  ativo?: boolean;
}

export const createTestCoach = async (
  client: SupabaseClient,
  overrides: CreateCoachOptions = {}
) => {
  const timestamp = Date.now();
  const defaults: CreateCoachOptions = {
    nome: `E2E Test Coach ${timestamp}`,
    email: `e2e.coach.${timestamp}@test.local`,
    fee_type: 'FIXED',
    fee_value: 3000, // €30.00
    credits_balance: 0,
    ativo: true,
  };

  const { data, error } = await client
    .from('external_coaches')
    .insert({ ...defaults, ...overrides })
    .select()
    .single();

  if (error) throw new Error(`Failed to create coach: ${error.message}`);

  testDataIds.coaches.push(data.id);
  return data;
};

interface CreateAreaOptions {
  nome?: string;
  capacidade_pts?: number;
  is_exclusive?: boolean;
  ativo?: boolean;
}

export const createTestArea = async (
  client: SupabaseClient,
  overrides: CreateAreaOptions = {}
) => {
  const timestamp = Date.now();
  const defaults: CreateAreaOptions = {
    nome: `E2E Test Area ${timestamp}`,
    capacidade_pts: 10,
    is_exclusive: false,
    ativo: true,
  };

  const { data, error } = await client
    .from('areas')
    .insert({ ...defaults, ...overrides })
    .select()
    .single();

  if (error) throw new Error(`Failed to create area: ${error.message}`);

  testDataIds.areas.push(data.id);
  return data;
};

interface CreateRentalOptions {
  coach_id: string;
  area_id: string;
  rental_date?: string;
  start_time?: string;
  end_time?: string;
  status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  fee_charged_cents?: number;
  is_recurring?: boolean;
  series_id?: string;
  guest_count?: number;
}

export const createTestRental = async (
  client: SupabaseClient,
  options: CreateRentalOptions
) => {
  const defaults = {
    rental_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '10:00',
    end_time: '11:00',
    status: 'SCHEDULED' as const,
    guest_count: 0,
  };

  const { data, error } = await client
    .from('rentals')
    .insert({ ...defaults, ...options })
    .select()
    .single();

  if (error) throw new Error(`Failed to create rental: ${error.message}`);

  testDataIds.rentals.push(data.id);
  return data;
};

interface CreateCoachGuestOptions {
  coach_id: string;
  nome?: string;
  telefone?: string;
  email?: string;
  notas?: string;
  ativo?: boolean;
}

export const createTestCoachGuest = async (
  client: SupabaseClient,
  options: CreateCoachGuestOptions
) => {
  const timestamp = Date.now();
  const defaults = {
    nome: `E2E Test Guest ${timestamp}`,
    ativo: true,
  };

  const { data, error } = await client
    .from('coach_guests')
    .insert({ ...defaults, ...options })
    .select()
    .single();

  if (error) throw new Error(`Failed to create coach guest: ${error.message}`);

  testDataIds.guests.push(data.id);
  return data;
};

interface CreateTransactionOptions {
  type: 'RECEITA' | 'DESPESA';
  category: string;
  amount_cents: number;
  payment_method?: 'DINHEIRO' | 'CARTAO' | 'MBWAY' | 'TRANSFERENCIA';
  member_id?: string;
  description?: string;
  created_by?: string;
}

export const createTestTransaction = async (
  client: SupabaseClient,
  options: CreateTransactionOptions
) => {
  const timestamp = Date.now();
  const defaults = {
    payment_method: 'DINHEIRO' as const,
    description: `E2E Test Transaction ${timestamp}`,
  };

  const { data, error } = await client
    .from('transactions')
    .insert({ ...defaults, ...options })
    .select()
    .single();

  if (error) throw new Error(`Failed to create transaction: ${error.message}`);

  testDataIds.transactions.push(data.id);
  return data;
};

interface CreateCheckinOptions {
  member_id?: string;
  type: 'MEMBER' | 'GUEST';
  result: 'ALLOWED' | 'BLOCKED' | 'EXPIRED' | 'NO_CREDITS' | 'AREA_EXCLUSIVE' | 'NOT_FOUND';
  checked_in_by?: string;
  guest_name?: string;
  rental_id?: string;
}

export const createTestCheckin = async (
  client: SupabaseClient,
  options: CreateCheckinOptions
) => {
  const { data, error } = await client
    .from('check_ins')
    .insert(options)
    .select()
    .single();

  if (error) throw new Error(`Failed to create check-in: ${error.message}`);

  testDataIds.checkins.push(data.id);
  return data;
};

// ============================================
// Utility Functions
// ============================================

/**
 * Get existing plans from DB (for payment tests)
 */
export const getPlans = async (client: SupabaseClient) => {
  const { data, error } = await client
    .from('plans')
    .select('*')
    .eq('ativo', true)
    .order('preco_cents', { ascending: true });

  if (error) throw new Error(`Failed to get plans: ${error.message}`);
  return data;
};

/**
 * Get existing areas from DB
 */
export const getAreas = async (client: SupabaseClient) => {
  const { data, error } = await client
    .from('areas')
    .select('*')
    .eq('ativo', true);

  if (error) throw new Error(`Failed to get areas: ${error.message}`);
  return data;
};
