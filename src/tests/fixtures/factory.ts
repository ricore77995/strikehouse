import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { format, addDays } from 'date-fns';

// Supabase local URLs
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Service client - bypasses RLS for test setup
 * Use this for creating test data
 */
export const createServiceClient = (): SupabaseClient => {
  if (!SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for integration tests');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
};

/**
 * Anon client - respects RLS
 * Use this for testing actual user flows
 */
export const createAnonClient = (): SupabaseClient => {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
};

/**
 * Create authenticated client for a specific user
 */
export const createAuthenticatedClient = async (
  email: string,
  password: string
): Promise<SupabaseClient> => {
  const client = createAnonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Auth failed for ${email}: ${error.message}`);
  return client;
};

// ============================================
// Factory Functions - Create Test Data
// ============================================

interface CreateCoachOptions {
  nome?: string;
  email?: string;
  telefone?: string;
  modalidade?: string;
  fee_type?: 'FIXED' | 'PERCENTAGE';
  fee_value?: number;
  credits_balance?: number;
  ativo?: boolean;
  user_id?: string;
}

export const createTestCoach = async (
  client: SupabaseClient,
  overrides: CreateCoachOptions = {}
) => {
  const timestamp = Date.now();
  const defaults: CreateCoachOptions = {
    nome: `Test Coach ${timestamp}`,
    email: `coach${timestamp}@test.local`,
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
    nome: `Test Area ${timestamp}`,
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
  return data;
};

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
  const randomChars = Math.random().toString(36).substring(2, 10).toUpperCase()
    .replace(/[IO01]/g, 'X'); // Remove confusing chars

  const defaults: CreateMemberOptions = {
    nome: `Test Member ${timestamp}`,
    telefone: `91${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
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
    nome: `Test Guest ${timestamp}`,
    ativo: true,
  };

  const { data, error } = await client
    .from('coach_guests')
    .insert({ ...defaults, ...options })
    .select()
    .single();

  if (error) throw new Error(`Failed to create coach guest: ${error.message}`);
  return data;
};

interface CreateCoachCreditOptions {
  coach_id: string;
  amount?: number;
  reason?: 'CANCELLATION' | 'ADJUSTMENT' | 'USED';
  rental_id?: string;
  expires_at?: string;
}

export const createTestCoachCredit = async (
  client: SupabaseClient,
  options: CreateCoachCreditOptions
) => {
  const defaults = {
    amount: 1,
    reason: 'CANCELLATION' as const,
    expires_at: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
  };

  const { data, error } = await client
    .from('coach_credits')
    .insert({ ...defaults, ...options })
    .select()
    .single();

  if (error) throw new Error(`Failed to create coach credit: ${error.message}`);
  return data;
};

/**
 * Consume a credit using the ledger pattern (insert negative amount)
 */
export const consumeCoachCredit = async (
  client: SupabaseClient,
  coachId: string,
  rentalId?: string
) => {
  const { data, error } = await client
    .from('coach_credits')
    .insert({
      coach_id: coachId,
      amount: -1,
      reason: 'USED',
      rental_id: rentalId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to consume coach credit: ${error.message}`);
  return data;
};

/**
 * Get coach credit balance (ledger sum)
 */
export const getCoachCreditBalance = async (
  client: SupabaseClient,
  coachId: string,
  includeExpired: boolean = false
): Promise<number> => {
  const today = format(new Date(), 'yyyy-MM-dd');

  let query = client
    .from('coach_credits')
    .select('amount')
    .eq('coach_id', coachId);

  if (!includeExpired) {
    query = query.or(`expires_at.is.null,expires_at.gte.${today}`);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get credit balance: ${error.message}`);

  return data?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
};

interface CreateStaffOptions {
  nome?: string;
  email?: string;
  role?: 'ADMIN' | 'STAFF' | 'OWNER';
  ativo?: boolean;
  user_id?: string;
}

export const createTestStaff = async (
  client: SupabaseClient,
  overrides: CreateStaffOptions = {}
) => {
  const timestamp = Date.now();
  const defaults: CreateStaffOptions = {
    nome: `Test Staff ${timestamp}`,
    email: `staff${timestamp}@test.local`,
    role: 'STAFF',
    ativo: true,
  };

  const { data, error } = await client
    .from('staff')
    .insert({ ...defaults, ...overrides })
    .select()
    .single();

  if (error) throw new Error(`Failed to create staff: ${error.message}`);
  return data;
};

// ============================================
// Cleanup Functions
// ============================================

/**
 * Clean up all test data created during tests
 * Run this in afterAll or afterEach
 */
export const cleanupTestData = async (client: SupabaseClient) => {
  // Order matters due to foreign key constraints
  await client.from('check_ins').delete().like('guest_name', 'Test%');
  await client.from('coach_credits').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('coach_guests').delete().like('nome', 'Test%');
  await client.from('rentals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('external_coaches').delete().like('email', '%@test.local');
  await client.from('areas').delete().like('nome', 'Test%');
  await client.from('members').delete().like('nome', 'Test%');
  await client.from('staff').delete().like('email', '%@test.local');
};

/**
 * Clean up specific entities by ID
 */
export const cleanupById = async (
  client: SupabaseClient,
  table: string,
  ids: string[]
) => {
  if (ids.length === 0) return;
  await client.from(table).delete().in('id', ids);
};

// ============================================
// Test User Creation (for auth tests)
// ============================================

interface TestUserResult {
  user_id: string;
  email: string;
  password: string;
}

/**
 * Create a test user in Supabase Auth
 * Requires service role key
 */
export const createTestAuthUser = async (
  client: SupabaseClient,
  email: string,
  password: string = 'testpass123'
): Promise<TestUserResult> => {
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw new Error(`Failed to create auth user: ${error.message}`);

  return {
    user_id: data.user.id,
    email,
    password,
  };
};

/**
 * Delete a test user from Supabase Auth
 */
export const deleteTestAuthUser = async (
  client: SupabaseClient,
  userId: string
) => {
  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) throw new Error(`Failed to delete auth user: ${error.message}`);
};
