import { SupabaseClient } from '@supabase/supabase-js';
import { testDataIds, resetTracking } from './test-data';

// ============================================
// Per-Test Cleanup (tracked IDs)
// ============================================

/**
 * Cleanup test data created during a test run.
 * Uses tracked IDs from testDataIds.
 * Order matters due to FK constraints - delete children first.
 */
export const cleanupTestData = async (client: SupabaseClient) => {
  // Order: children → parents (respecting FK constraints)

  // 1. Check-ins (references members, rentals)
  if (testDataIds.checkins.length > 0) {
    await client.from('check_ins').delete().in('id', testDataIds.checkins);
  }

  // 2. Transactions (references members)
  if (testDataIds.transactions.length > 0) {
    await client.from('transactions').delete().in('id', testDataIds.transactions);
  }

  // 3. Coach guests (references coaches)
  if (testDataIds.guests.length > 0) {
    await client.from('coach_guests').delete().in('id', testDataIds.guests);
  }

  // 4. Coach credits (references coaches, rentals)
  if (testDataIds.credits.length > 0) {
    await client.from('coach_credits').delete().in('id', testDataIds.credits);
  }

  // 5. Rentals (references coaches, areas)
  if (testDataIds.rentals.length > 0) {
    await client.from('rentals').delete().in('id', testDataIds.rentals);
  }

  // 6. Coaches
  if (testDataIds.coaches.length > 0) {
    await client.from('external_coaches').delete().in('id', testDataIds.coaches);
  }

  // 7. Areas
  if (testDataIds.areas.length > 0) {
    await client.from('areas').delete().in('id', testDataIds.areas);
  }

  // 8. Members (last, as many things reference them)
  if (testDataIds.members.length > 0) {
    await client.from('members').delete().in('id', testDataIds.members);
  }

  // Reset tracking for next test run
  resetTracking();
};

// ============================================
// Global Cleanup (by prefix)
// ============================================

/**
 * Cleanup ALL E2E test data from the database.
 * Uses "E2E Test" prefix to identify test data.
 * Used in globalTeardown as a safety net.
 */
export const cleanupAllE2EData = async (client: SupabaseClient) => {
  console.log('🧹 Cleaning up all E2E test data...');

  // 1. Check-ins that reference E2E test members
  const { data: e2eMembers } = await client
    .from('members')
    .select('id')
    .like('nome', 'E2E Test%');

  if (e2eMembers && e2eMembers.length > 0) {
    const memberIds = e2eMembers.map((m) => m.id);
    await client.from('check_ins').delete().in('member_id', memberIds);
    await client.from('transactions').delete().in('member_id', memberIds);
  }

  // 2. E2E test coaches and their related data
  const { data: e2eCoaches } = await client
    .from('external_coaches')
    .select('id')
    .like('nome', 'E2E Test%');

  if (e2eCoaches && e2eCoaches.length > 0) {
    const coachIds = e2eCoaches.map((c) => c.id);
    await client.from('coach_guests').delete().in('coach_id', coachIds);
    await client.from('coach_credits').delete().in('coach_id', coachIds);
    await client.from('rentals').delete().in('coach_id', coachIds);
  }

  // 3. Delete parent records
  await client.from('external_coaches').delete().like('nome', 'E2E Test%');
  await client.from('areas').delete().like('nome', 'E2E Test%');
  await client.from('members').delete().like('nome', 'E2E Test%');

  // 4. Cleanup E2E promo codes and modalities
  await client.from('discounts').delete().like('nome', 'E2E Test%');
  await client.from('discounts').delete().like('code', 'E2E%');
  await client.from('modalities').delete().like('code', 'e2e_%');
  await client.from('modalities').delete().like('code', 'test_%');

  console.log('✅ E2E test data cleanup complete');
};

// ============================================
// Cleanup Utilities
// ============================================

/**
 * Delete a specific member and all related data.
 * Useful for targeted cleanup in tests.
 */
export const deleteTestMember = async (
  client: SupabaseClient,
  memberId: string
) => {
  // Delete related data first
  await client.from('check_ins').delete().eq('member_id', memberId);
  await client.from('transactions').delete().eq('member_id', memberId);
  await client.from('member_ibans').delete().eq('member_id', memberId);
  await client.from('pending_payments').delete().eq('member_id', memberId);

  // Delete member
  await client.from('members').delete().eq('id', memberId);
};

/**
 * Delete a specific coach and all related data.
 */
export const deleteTestCoach = async (
  client: SupabaseClient,
  coachId: string
) => {
  // Delete related data first
  await client.from('coach_guests').delete().eq('coach_id', coachId);
  await client.from('coach_credits').delete().eq('coach_id', coachId);
  await client.from('rentals').delete().eq('coach_id', coachId);

  // Delete coach
  await client.from('external_coaches').delete().eq('id', coachId);
};
