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
};

/**
 * Clean up all tracked entities
 */
export const cleanupTrackedEntities = async () => {
  const client = serviceClient;

  // Order matters due to FK constraints
  if (createdIds.checkins.length > 0) {
    await client.from('check_ins').delete().in('id', createdIds.checkins);
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
  if (createdIds.members.length > 0) {
    await client.from('members').delete().in('id', createdIds.members);
  }
  if (createdIds.staff.length > 0) {
    await client.from('staff').delete().in('id', createdIds.staff);
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
