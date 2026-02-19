/**
 * E2E Test: Offline Payment (DINHEIRO) Flow
 *
 * Tests the complete offline payment flow:
 * 1. Staff receives cash payment from LEAD member
 * 2. Staff creates transaction in cash_sessions
 * 3. Member is activated locally (no Stripe involved)
 * 4. Check-in works after activation
 *
 * This test does NOT use Stripe - tests the DINHEIRO exception flow.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createTestMember, cleanupTestMember, getTestSupabaseClient } from '../fixtures/setup';

describe('E2E: Offline Payment (DINHEIRO) Flow', () => {
  let client: ReturnType<typeof createClient>;
  let testMember: { id: string; email: string; nome: string; qr_code: string };
  let testStaffId: string;
  let testCashSessionId: string | null = null;

  beforeAll(async () => {
    client = getTestSupabaseClient();

    // Get a staff ID
    const { data: staff } = await client
      .from('staff')
      .select('id')
      .limit(1)
      .single();

    testStaffId = staff?.id || '00000000-0000-0000-0000-000000000001';

    console.log('🧪 E2E Test Suite: Offline Payment (DINHEIRO) Flow');
  });

  afterAll(async () => {
    // Cleanup test member
    if (testMember?.id) {
      await cleanupTestMember(client, testMember.id);
    }

    // Cleanup cash session if created
    if (testCashSessionId) {
      await client.from('cash_sessions').delete().eq('id', testCashSessionId);
    }
  });

  beforeEach(async () => {
    // Create fresh LEAD member for each test
    testMember = await createTestMember(client, {
      status: 'LEAD',
      email: `offline-test-${Date.now()}@test.com`,
    });
    console.log(`✅ Created test member: ${testMember.id} (${testMember.email})`);
  });

  describe('7.2: Offline Payment Activation', () => {
    it('activates LEAD member via DINHEIRO payment', async () => {
      // ============================================
      // STEP 1: Verify member starts as LEAD
      // ============================================
      console.log('\n📋 Step 1: Verifying member is LEAD...');

      const { data: leadMember } = await client
        .from('members')
        .select('status, access_expires_at')
        .eq('id', testMember.id)
        .single();

      expect(leadMember?.status).toBe('LEAD');
      console.log(`   ✅ Member status: ${leadMember?.status}`);

      // ============================================
      // STEP 2: Get or create cash session for today
      // ============================================
      console.log('\n📋 Step 2: Getting cash session...');

      const today = new Date().toISOString().split('T')[0];

      let { data: cashSession } = await client
        .from('cash_sessions')
        .select('*')
        .eq('session_date', today)
        .single();

      if (!cashSession) {
        // Create a new cash session
        const { data: newSession, error } = await client
          .from('cash_sessions')
          .insert({
            session_date: today,
            opening_balance_cents: 0,
            total_cash_in_cents: 0,
            total_cash_out_cents: 0,
            status: 'OPEN',
            opened_by: testStaffId,
          })
          .select()
          .single();

        if (error) {
          console.log('   ⚠️ Could not create cash session:', error.message);
          // Continue without cash session tracking
        } else {
          cashSession = newSession;
          testCashSessionId = newSession?.id;
          console.log(`   ✅ Created new cash session: ${cashSession?.id}`);
        }
      } else {
        console.log(`   ✅ Using existing cash session: ${cashSession.id}`);
      }

      // ============================================
      // STEP 3: Create DINHEIRO transaction
      // ============================================
      console.log('\n📋 Step 3: Creating DINHEIRO transaction...');

      const planAmountCents = 4000; // €40 - 2x/week plan
      const enrollmentFeeCents = 1500; // €15 enrollment fee
      const totalAmountCents = planAmountCents + enrollmentFeeCents;

      // Calculate access expiration (30 days from now)
      const accessExpiresAt = new Date();
      accessExpiresAt.setDate(accessExpiresAt.getDate() + 30);
      const expiresAtStr = accessExpiresAt.toISOString().split('T')[0];

      // Transaction 1: Plan payment
      const { data: planTx, error: planTxError } = await client
        .from('transactions')
        .insert({
          type: 'RECEITA',
          amount_cents: planAmountCents,
          payment_method: 'DINHEIRO',
          category: 'SUBSCRIPTION',
          member_id: testMember.id,
          description: `Plano 2x/semana €40 (DINHEIRO)`,
          created_by: testStaffId,
          transaction_date: today,
        })
        .select()
        .single();

      if (planTxError) {
        console.error('   ❌ Plan transaction failed:', planTxError);
        throw planTxError;
      }
      console.log(`   ✅ Plan transaction: ${planTx.id} (${planAmountCents} cents)`);

      // Transaction 2: Enrollment fee
      const { data: enrollTx, error: enrollTxError } = await client
        .from('transactions')
        .insert({
          type: 'RECEITA',
          amount_cents: enrollmentFeeCents,
          payment_method: 'DINHEIRO',
          category: 'TAXA_MATRICULA',
          member_id: testMember.id,
          description: `Taxa de Matrícula €15 (DINHEIRO)`,
          created_by: testStaffId,
          transaction_date: today,
        })
        .select()
        .single();

      if (enrollTxError) {
        console.error('   ❌ Enrollment transaction failed:', enrollTxError);
        throw enrollTxError;
      }
      console.log(`   ✅ Enrollment transaction: ${enrollTx.id} (${enrollmentFeeCents} cents)`);

      // ============================================
      // STEP 4: Activate member locally
      // ============================================
      console.log('\n📋 Step 4: Activating member...');

      const { error: updateError } = await client
        .from('members')
        .update({
          status: 'ATIVO',
          access_type: 'SUBSCRIPTION',
          access_expires_at: expiresAtStr,
          weekly_limit: 2, // 2x/week plan
          modalities_count: 1,
        })
        .eq('id', testMember.id);

      if (updateError) {
        console.error('   ❌ Member activation failed:', updateError);
        throw updateError;
      }
      console.log(`   ✅ Member activated with weekly_limit=2, expires: ${expiresAtStr}`);

      // ============================================
      // STEP 5: Update cash session totals (if exists)
      // ============================================
      if (cashSession?.id) {
        console.log('\n📋 Step 5: Updating cash session...');

        const { error: cashError } = await client
          .from('cash_sessions')
          .update({
            total_cash_in_cents: (cashSession.total_cash_in_cents || 0) + totalAmountCents,
          })
          .eq('id', cashSession.id);

        if (cashError) {
          console.log('   ⚠️ Could not update cash session:', cashError.message);
        } else {
          console.log(`   ✅ Cash session updated: +${totalAmountCents} cents`);
        }
      }

      // ============================================
      // STEP 6: Verify member is now ATIVO
      // ============================================
      console.log('\n📋 Step 6: Verifying activation...');

      const { data: activeMember } = await client
        .from('members')
        .select('status, access_type, access_expires_at, weekly_limit, modalities_count')
        .eq('id', testMember.id)
        .single();

      expect(activeMember?.status).toBe('ATIVO');
      expect(activeMember?.access_type).toBe('SUBSCRIPTION');
      expect(activeMember?.weekly_limit).toBe(2);
      expect(activeMember?.access_expires_at).toBe(expiresAtStr);

      console.log(`   ✅ Member verified:
         Status: ${activeMember?.status}
         Access type: ${activeMember?.access_type}
         Weekly limit: ${activeMember?.weekly_limit}
         Expires: ${activeMember?.access_expires_at}`);

      // ============================================
      // STEP 7: Test check-in works
      // ============================================
      console.log('\n📋 Step 7: Testing check-in...');

      const { data: checkin, error: checkinError } = await client
        .from('check_ins')
        .insert({
          member_id: testMember.id,
          type: 'MEMBER',
          result: 'ALLOWED',
          checked_in_by: testStaffId,
        })
        .select()
        .single();

      if (checkinError) {
        console.error('   ❌ Check-in failed:', checkinError);
        throw checkinError;
      }

      expect(checkin).toBeDefined();
      console.log(`   ✅ Check-in successful: ${checkin.id}`);

      // ============================================
      // STEP 8: Verify transactions exist
      // ============================================
      console.log('\n📋 Step 8: Verifying transactions...');

      const { data: transactions } = await client
        .from('transactions')
        .select('*')
        .eq('member_id', testMember.id)
        .eq('payment_method', 'DINHEIRO');

      expect(transactions?.length).toBe(2);
      console.log(`   ✅ Found ${transactions?.length} DINHEIRO transactions`);

      const total = transactions?.reduce((sum, tx) => sum + tx.amount_cents, 0);
      expect(total).toBe(totalAmountCents);
      console.log(`   ✅ Total: ${total} cents (€${(total! / 100).toFixed(2)})`);

    }, 30000);

    it('handles DINHEIRO payment for BLOQUEADO member (renewal)', async () => {
      // ============================================
      // Setup: Create an already blocked member
      // ============================================
      console.log('\n📋 Setup: Creating BLOQUEADO member...');

      // First activate, then block
      const { error: setupError } = await client
        .from('members')
        .update({
          status: 'BLOQUEADO',
          access_type: 'SUBSCRIPTION',
          access_expires_at: '2026-01-01', // Expired
        })
        .eq('id', testMember.id);

      expect(setupError).toBeNull();

      const { data: blockedMember } = await client
        .from('members')
        .select('status')
        .eq('id', testMember.id)
        .single();

      expect(blockedMember?.status).toBe('BLOQUEADO');
      console.log(`   ✅ Member is BLOQUEADO`);

      // ============================================
      // STEP 1: Create renewal transaction (no enrollment fee)
      // ============================================
      console.log('\n📋 Step 1: Creating renewal transaction...');

      const renewalAmountCents = 4000; // €40
      const today = new Date().toISOString().split('T')[0];

      const { data: renewalTx, error: txError } = await client
        .from('transactions')
        .insert({
          type: 'RECEITA',
          amount_cents: renewalAmountCents,
          payment_method: 'DINHEIRO',
          category: 'SUBSCRIPTION',
          member_id: testMember.id,
          description: `Renovação 2x/semana €40 (DINHEIRO)`,
          created_by: testStaffId,
          transaction_date: today,
        })
        .select()
        .single();

      expect(txError).toBeNull();
      console.log(`   ✅ Renewal transaction: ${renewalTx?.id}`);

      // ============================================
      // STEP 2: Reactivate member
      // ============================================
      console.log('\n📋 Step 2: Reactivating member...');

      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 30);

      const { error: updateError } = await client
        .from('members')
        .update({
          status: 'ATIVO',
          access_expires_at: newExpiry.toISOString().split('T')[0],
        })
        .eq('id', testMember.id);

      expect(updateError).toBeNull();

      // Verify reactivation
      const { data: activeMember } = await client
        .from('members')
        .select('status, access_expires_at')
        .eq('id', testMember.id)
        .single();

      expect(activeMember?.status).toBe('ATIVO');
      console.log(`   ✅ Member reactivated, expires: ${activeMember?.access_expires_at}`);

      // No enrollment fee should have been charged
      const { data: allTx } = await client
        .from('transactions')
        .select('category')
        .eq('member_id', testMember.id);

      const enrollmentTx = allTx?.find((tx) => tx.category === 'TAXA_MATRICULA');
      expect(enrollmentTx).toBeUndefined();
      console.log(`   ✅ No enrollment fee charged for renewal`);

    }, 30000);
  });
});
