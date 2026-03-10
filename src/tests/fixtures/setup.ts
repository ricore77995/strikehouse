import { beforeAll, afterAll, beforeEach } from 'vitest';
import { createServiceClient, cleanupTestData } from './factory';

// Global service client for test setup
export const serviceClient = createServiceClient();

// Track created entity IDs for cleanup
export const createdIds: {
  coaches: string[];
  areas: string[];
  rentals: string[];
  members: string[];
  guests: string[];
  credits: string[];
  checkins: string[];
  staff: string[];
  authUsers: string[];
  transactions: string[];
  cashSessions: string[];
  pendingPayments: string[];
  memberIbans: string[];
  classes: string[];
  classBookings: string[];
  fixedSchedules: string[];
} = {
  coaches: [],
  areas: [],
  rentals: [],
  members: [],
  guests: [],
  credits: [],
  checkins: [],
  staff: [],
  authUsers: [],
  transactions: [],
  cashSessions: [],
  pendingPayments: [],
  memberIbans: [],
  classes: [],
  classBookings: [],
  fixedSchedules: [],
};

/**
 * Reset tracking arrays
 */
export const resetTracking = () => {
  createdIds.coaches = [];
  createdIds.areas = [];
  createdIds.rentals = [];
  createdIds.members = [];
  createdIds.guests = [];
  createdIds.credits = [];
  createdIds.checkins = [];
  createdIds.staff = [];
  createdIds.authUsers = [];
  createdIds.transactions = [];
  createdIds.cashSessions = [];
  createdIds.pendingPayments = [];
  createdIds.memberIbans = [];
  createdIds.classes = [];
  createdIds.classBookings = [];
  createdIds.fixedSchedules = [];
};

/**
 * Clean up all tracked entities
 */
export const cleanupTrackedEntities = async () => {
  const client = serviceClient;

  // Order matters due to FK constraints
  // Clean bookings and schedules first (they reference classes and members)
  if (createdIds.classBookings.length > 0) {
    await client.from('class_bookings').delete().in('id', createdIds.classBookings);
  }
  if (createdIds.fixedSchedules.length > 0) {
    await client.from('member_fixed_schedules').delete().in('id', createdIds.fixedSchedules);
  }
  if (createdIds.checkins.length > 0) {
    await client.from('check_ins').delete().in('id', createdIds.checkins);
  }
  if (createdIds.transactions.length > 0) {
    await client.from('transactions').delete().in('id', createdIds.transactions);
  }
  if (createdIds.pendingPayments.length > 0) {
    await client.from('pending_payments').delete().in('id', createdIds.pendingPayments);
  }
  if (createdIds.memberIbans.length > 0) {
    await client.from('member_ibans').delete().in('id', createdIds.memberIbans);
  }
  if (createdIds.credits.length > 0) {
    await client.from('coach_credits').delete().in('id', createdIds.credits);
  }
  if (createdIds.guests.length > 0) {
    await client.from('coach_guests').delete().in('id', createdIds.guests);
  }
  if (createdIds.rentals.length > 0) {
    await client.from('rentals').delete().in('id', createdIds.rentals);
  }
  if (createdIds.coaches.length > 0) {
    await client.from('external_coaches').delete().in('id', createdIds.coaches);
  }
  if (createdIds.areas.length > 0) {
    await client.from('areas').delete().in('id', createdIds.areas);
  }
  if (createdIds.classes.length > 0) {
    await client.from('classes').delete().in('id', createdIds.classes);
  }
  if (createdIds.members.length > 0) {
    await client.from('members').delete().in('id', createdIds.members);
  }
  if (createdIds.staff.length > 0) {
    await client.from('staff').delete().in('id', createdIds.staff);
  }
  if (createdIds.cashSessions.length > 0) {
    await client.from('cash_sessions').delete().in('id', createdIds.cashSessions);
  }

  // Clean up auth users last
  for (const userId of createdIds.authUsers) {
    try {
      await client.auth.admin.deleteUser(userId);
    } catch {
      // Ignore errors - user might already be deleted
    }
  }

  resetTracking();
};

/**
 * Global setup - runs once before all tests
 */
beforeAll(async () => {
  console.log('🧪 Integration test suite starting...');
  console.log(`📡 Supabase URL: ${process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'}`);

  // Verify Supabase is accessible
  try {
    const { error } = await serviceClient.from('areas').select('id').limit(1);
    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }
    console.log('✅ Supabase connection verified');
  } catch (err) {
    console.error('❌ Failed to connect to Supabase. Make sure it is running: supabase start');
    throw err;
  }
});

/**
 * Global teardown - runs once after all tests
 */
afterAll(async () => {
  console.log('🧹 Cleaning up test data...');
  await cleanupTrackedEntities();
  await cleanupTestData(serviceClient);
  console.log('✅ Cleanup complete');
});

/**
 * Per-test cleanup (optional - use if tests need isolation)
 */
beforeEach(() => {
  // Reset any per-test state if needed
});

/**
 * Get the test Supabase client (service role)
 */
export function getTestSupabaseClient() {
  return serviceClient;
}

/**
 * Create a test member with specified options
 */
export async function createTestMember(
  client: ReturnType<typeof createServiceClient>,
  options: {
    status?: 'LEAD' | 'ATIVO' | 'BLOQUEADO' | 'CANCELADO';
    email?: string;
    nome?: string;
    telefone?: string;
    qrCode?: string;
  } = {}
): Promise<{ id: string; email: string; nome: string; qr_code: string }> {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();

  const memberData = {
    nome: options.nome || `Test Member ${timestamp}`,
    email: options.email || `test-${timestamp}@example.com`,
    telefone: options.telefone || `91${timestamp.toString().slice(-7)}`,
    status: options.status || 'LEAD',
    qr_code: options.qrCode || `MBR-${randomStr}`,
  };

  const { data, error } = await client
    .from('members')
    .insert(memberData)
    .select('id, email, nome, qr_code')
    .single();

  if (error) {
    throw new Error(`Failed to create test member: ${error.message}`);
  }

  // Track for cleanup
  createdIds.members.push(data.id);

  return data;
}

/**
 * Clean up a specific test member and related data
 */
export async function cleanupTestMember(
  client: ReturnType<typeof createServiceClient>,
  memberId: string
): Promise<void> {
  // Delete related data first (FK constraints)
  await client.from('check_ins').delete().eq('member_id', memberId);
  await client.from('transactions').delete().eq('member_id', memberId);
  await client.from('pending_payments').delete().eq('member_id', memberId);
  await client.from('member_ibans').delete().eq('member_id', memberId);
  await client.from('subscriptions').delete().eq('member_id', memberId);

  // Delete member
  await client.from('members').delete().eq('id', memberId);

  // Remove from tracking
  createdIds.members = createdIds.members.filter((id) => id !== memberId);
}
