-- ============================================
-- RESET DYNAMIC DATA SCRIPT
-- ============================================
-- Apaga apenas dados dinamicos (transaccionais)
-- Mantem dados estaticos (configuracao/referencia)
--
-- NOTA: Para reset COMPLETO (inclui auth users), usar:
--   make db-reset
--
-- Este script é útil para limpar dados de teste
-- sem perder configurações ou ter que recriar users.
-- ============================================

-- Mostrar aviso
DO $$
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'ATENCAO: A apagar dados dinamicos...';
  RAISE NOTICE 'Tabelas MANTIDAS:';
  RAISE NOTICE '  - plans, modalities, areas, categories';
  RAISE NOTICE '  - products, pricing_config, discounts';
  RAISE NOTICE '  - gym_settings';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANTE: Apos executar, chamar seed-test-users!';
  RAISE NOTICE '==========================================';
END $$;

BEGIN;

-- 1. Desativar triggers temporariamente (evita side effects)
SET session_replication_role = replica;

-- 2. Apagar tabelas dinamicas em ordem de dependencias (filhos primeiro)
-- Nivel 1: Tabelas com FKs para outras dinamicas
TRUNCATE sale_items CASCADE;
TRUNCATE sales CASCADE;
TRUNCATE coach_credits CASCADE;

-- Nivel 2: Tabelas de actividade
TRUNCATE check_ins CASCADE;
TRUNCATE rentals CASCADE;
TRUNCATE pending_payments CASCADE;

-- Nivel 3: Subscriptions e relacionados
TRUNCATE subscriptions CASCADE;
TRUNCATE member_ibans CASCADE;
TRUNCATE transactions CASCADE;

-- Nivel 4: Entidades principais
TRUNCATE members CASCADE;
TRUNCATE external_coaches CASCADE;
TRUNCATE classes CASCADE;

-- Nivel 5: Sessoes e logs
TRUNCATE cash_sessions CASCADE;
TRUNCATE audit_logs CASCADE;

-- Nivel 6: Staff (sera recriado via seed-test-users)
TRUNCATE staff CASCADE;

-- 3. Reativar triggers
SET session_replication_role = DEFAULT;

COMMIT;

-- 4. Mostrar resultado
DO $$
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'RESET COMPLETO!';
  RAISE NOTICE '==========================================';
END $$;

-- 5. Verificacao - mostrar contagens
SELECT
  'DINAMICAS (devem ser 0)' as tipo,
  '' as tabela,
  NULL::bigint as registos
UNION ALL
SELECT '', 'members', COUNT(*) FROM members
UNION ALL SELECT '', 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT '', 'check_ins', COUNT(*) FROM check_ins
UNION ALL SELECT '', 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL SELECT '', 'rentals', COUNT(*) FROM rentals
UNION ALL SELECT '', 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL SELECT '', 'staff', COUNT(*) FROM staff
UNION ALL
SELECT
  'ESTATICAS (devem ter dados)' as tipo,
  '' as tabela,
  NULL::bigint as registos
UNION ALL SELECT '', 'plans', COUNT(*) FROM plans
UNION ALL SELECT '', 'modalities', COUNT(*) FROM modalities
UNION ALL SELECT '', 'areas', COUNT(*) FROM areas
UNION ALL SELECT '', 'categories', COUNT(*) FROM categories
UNION ALL SELECT '', 'products', COUNT(*) FROM products
UNION ALL SELECT '', 'pricing_config', COUNT(*) FROM pricing_config
UNION ALL SELECT '', 'discounts', COUNT(*) FROM discounts;
