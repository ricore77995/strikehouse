/**
 * Database Reset Script (Remote Supabase)
 *
 * Uso: npx tsx scripts/db-reset.ts
 *
 * Faz reset completo:
 * 1. Trunca tabelas dinâmicas
 * 2. Apaga auth users
 * 3. Recria test users + staff
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltam variáveis de ambiente:');
  console.error('   VITE_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TEST_USERS = [
  { email: 'owner@boxemaster.pt', password: 'owner123', nome: 'João Owner', role: 'OWNER' },
  { email: 'admin@boxemaster.pt', password: 'admin123', nome: 'Maria Admin', role: 'ADMIN' },
  { email: 'staff@boxemaster.pt', password: 'staff123', nome: 'Pedro Staff', role: 'STAFF' },
  { email: 'partner@boxemaster.pt', password: 'partner123', nome: 'Ana Partner', role: 'PARTNER' },
];

async function resetDynamicData() {
  console.log('🗑️  A limpar dados dinâmicos...');

  // Ordem de dependências (filhos primeiro)
  const tables = [
    'sale_items',
    'sales',
    'coach_credits',
    'check_ins',
    'rentals',
    'pending_payments',
    'subscriptions',
    'member_ibans',
    'transactions',
    'members',
    'external_coaches',
    'classes',
    'cash_sessions',
    'audit_logs',
    'staff',
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error && !error.message.includes('0 rows')) {
      console.log(`   ⚠️  ${table}: ${error.message}`);
    } else {
      console.log(`   ✓ ${table}`);
    }
  }
}

async function deleteAllAuthUsers() {
  console.log('🔐 A apagar auth users...');

  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('   ❌ Erro ao listar users:', error.message);
    return;
  }

  for (const user of users.users) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.log(`   ⚠️  ${user.email}: ${deleteError.message}`);
    } else {
      console.log(`   ✓ ${user.email}`);
    }
  }
}

async function createTestUsers() {
  console.log('👥 A criar test users...');

  for (const user of TEST_USERS) {
    // 1. Criar auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    });

    if (authError) {
      console.error(`   ❌ ${user.email}: ${authError.message}`);
      continue;
    }

    // 2. Criar staff record
    const { error: staffError } = await supabase.from('staff').insert({
      user_id: authData.user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      ativo: true,
    });

    if (staffError) {
      console.error(`   ❌ Staff ${user.email}: ${staffError.message}`);
    } else {
      console.log(`   ✓ ${user.email} (${user.role})`);
    }
  }
}

async function ensureStaticData() {
  console.log('📋 A verificar dados estáticos...');

  // Ensure pricing_config exists (singleton)
  const { data: pricingConfig } = await supabase.from('pricing_config').select('id').limit(1);
  if (!pricingConfig?.length) {
    const { error } = await supabase.from('pricing_config').insert({
      base_price_cents: 6000,
      extra_modality_price_cents: 3000,
      single_class_price_cents: 1500,
      day_pass_price_cents: 2500,
      enrollment_fee_cents: 1500,
      currency: 'EUR',
    });
    if (error) {
      console.log(`   ⚠️  pricing_config: ${error.message}`);
    } else {
      console.log('   ✓ pricing_config (criado)');
    }
  } else {
    console.log('   ✓ pricing_config (existe)');
  }
}

async function main() {
  console.log('==========================================');
  console.log('DATABASE RESET - Supabase Remoto');
  console.log('==========================================\n');

  await resetDynamicData();
  console.log('');

  await deleteAllAuthUsers();
  console.log('');

  await createTestUsers();
  console.log('');

  await ensureStaticData();

  console.log('\n==========================================');
  console.log('✅ RESET COMPLETO!');
  console.log('==========================================');
  console.log('\nTest users:');
  for (const user of TEST_USERS) {
    console.log(`  ${user.email} / ${user.password} (${user.role})`);
  }
}

main().catch(console.error);
