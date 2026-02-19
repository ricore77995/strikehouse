-- ============================================
-- SEED DATA - BoxeMaster Pro
-- ============================================
-- Este ficheiro corre automaticamente após migrations
-- quando executas: npx supabase db reset
--
-- NOTA: Test users NÃO podem ser criados via seed.sql
-- em Supabase hosted. Usar scripts/seed-users.ts ou
-- make db-reset que já cria os users via Admin API.
-- ============================================

-- Verificação
DO $$
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'SEED COMPLETO!';
    RAISE NOTICE '';
    RAISE NOTICE 'Para criar test users, executar:';
    RAISE NOTICE '  make db-reset';
    RAISE NOTICE '';
    RAISE NOTICE 'Ou manualmente:';
    RAISE NOTICE '  npx tsx scripts/create-test-users.ts';
    RAISE NOTICE '==========================================';
END $$;
