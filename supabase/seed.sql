-- ============================================
-- SEED DATA - Test Users
-- ============================================
-- Este ficheiro corre automaticamente após migrations
-- quando executas: npx supabase db reset
--
-- Cria 4 utilizadores de teste com roles diferentes
-- ============================================

-- UUIDs fixos para consistência entre resets
-- (facilita testes e debugging)

-- 1. Criar auth users directamente
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud
) VALUES
    -- OWNER: owner@boxemaster.pt / owner123
    (
        'a0000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000000',
        'owner@boxemaster.pt',
        crypt('owner123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"nome": "João Owner"}',
        false,
        'authenticated',
        'authenticated'
    ),
    -- ADMIN: admin@boxemaster.pt / admin123
    (
        'a0000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000000',
        'admin@boxemaster.pt',
        crypt('admin123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"nome": "Maria Admin"}',
        false,
        'authenticated',
        'authenticated'
    ),
    -- STAFF: staff@boxemaster.pt / staff123
    (
        'a0000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000000',
        'staff@boxemaster.pt',
        crypt('staff123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"nome": "Pedro Staff"}',
        false,
        'authenticated',
        'authenticated'
    ),
    -- PARTNER: partner@boxemaster.pt / partner123
    (
        'a0000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000000',
        'partner@boxemaster.pt',
        crypt('partner123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"nome": "Ana Partner"}',
        false,
        'authenticated',
        'authenticated'
    )
ON CONFLICT (id) DO NOTHING;

-- 2. Criar identities para cada user (necessário para login)
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    created_at,
    updated_at,
    last_sign_in_at
) VALUES
    (
        'a0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        '{"sub": "a0000000-0000-0000-0000-000000000001", "email": "owner@boxemaster.pt"}',
        'email',
        'owner@boxemaster.pt',
        NOW(),
        NOW(),
        NOW()
    ),
    (
        'a0000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000002',
        '{"sub": "a0000000-0000-0000-0000-000000000002", "email": "admin@boxemaster.pt"}',
        'email',
        'admin@boxemaster.pt',
        NOW(),
        NOW(),
        NOW()
    ),
    (
        'a0000000-0000-0000-0000-000000000003',
        'a0000000-0000-0000-0000-000000000003',
        '{"sub": "a0000000-0000-0000-0000-000000000003", "email": "staff@boxemaster.pt"}',
        'email',
        'staff@boxemaster.pt',
        NOW(),
        NOW(),
        NOW()
    ),
    (
        'a0000000-0000-0000-0000-000000000004',
        'a0000000-0000-0000-0000-000000000004',
        '{"sub": "a0000000-0000-0000-0000-000000000004", "email": "partner@boxemaster.pt"}',
        'email',
        'partner@boxemaster.pt',
        NOW(),
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO NOTHING;

-- 3. Criar staff records ligados aos auth users
INSERT INTO staff (user_id, nome, email, role, ativo) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'João Owner', 'owner@boxemaster.pt', 'OWNER', true),
    ('a0000000-0000-0000-0000-000000000002', 'Maria Admin', 'admin@boxemaster.pt', 'ADMIN', true),
    ('a0000000-0000-0000-0000-000000000003', 'Pedro Staff', 'staff@boxemaster.pt', 'STAFF', true),
    ('a0000000-0000-0000-0000-000000000004', 'Ana Partner', 'partner@boxemaster.pt', 'PARTNER', true)
ON CONFLICT (email) DO NOTHING;

-- 4. Verificação
DO $$
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'SEED COMPLETO!';
    RAISE NOTICE 'Utilizadores de teste criados:';
    RAISE NOTICE '  - owner@boxemaster.pt / owner123';
    RAISE NOTICE '  - admin@boxemaster.pt / admin123';
    RAISE NOTICE '  - staff@boxemaster.pt / staff123';
    RAISE NOTICE '  - partner@boxemaster.pt / partner123';
    RAISE NOTICE '==========================================';
END $$;
