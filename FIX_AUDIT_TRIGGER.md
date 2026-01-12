# 🔧 Correção do Audit Trigger - Instruções

## Problema
O trigger de auditoria está tentando inserir UUID como TEXT, causando erro:
```
column "entity_id" is of type uuid but expression is of type text
```

## Solução Rápida (2 minutos)

### Passo 1: Acessar Supabase Dashboard
1. Vá para: https://supabase.com/dashboard/project/cgdshqmqsqwgwpjfmesr
2. Faça login se necessário

### Passo 2: Abrir SQL Editor
1. No menu lateral esquerdo, clique em **SQL Editor**
2. Clique em **New Query**

### Passo 3: Executar SQL de Correção
Cole e execute este SQL:

```sql
-- Corrige o audit trigger para usar UUID ao invés de TEXT
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_role VARCHAR(20);
    v_old_data JSONB;
    v_new_data JSONB;
    v_action VARCHAR(20);
    v_description TEXT;
BEGIN
    v_user_id := auth.uid();
    SELECT role INTO v_user_role FROM staff WHERE user_id = v_user_id AND ativo = true LIMIT 1;

    IF v_user_role IS NULL THEN
        v_user_role := 'SYSTEM';
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_action := 'CREATE';
        v_new_data := to_jsonb(NEW);
        v_description := 'Novo registro criado em ' || TG_TABLE_NAME;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_description := 'Registro atualizado em ' || TG_TABLE_NAME;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_old_data := to_jsonb(OLD);
        v_description := 'Registro excluído de ' || TG_TABLE_NAME;
    END IF;

    IF v_user_id IS NOT NULL THEN
        DECLARE
            v_staff_id UUID;
        BEGIN
            SELECT id INTO v_staff_id FROM staff WHERE user_id = v_user_id LIMIT 1;

            IF v_staff_id IS NOT NULL THEN
                INSERT INTO audit_logs (
                    user_id,
                    user_role,
                    action,
                    entity_type,
                    entity_id,
                    old_value,
                    new_value,
                    description
                ) VALUES (
                    v_staff_id,
                    v_user_role,
                    v_action,
                    TG_TABLE_NAME,
                    COALESCE(NEW.id, OLD.id),  -- ✅ CORREÇÃO: Removido ::text
                    v_old_data,
                    v_new_data,
                    v_description
                );
            END IF;
        END;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;
```

### Passo 4: Executar
1. Clique em **RUN** (ou pressione Ctrl+Enter)
2. Aguarde a mensagem "Success"

### Passo 5: Testar
Volte ao app e tente criar um membro novamente - deve funcionar! ✅

---

## O que foi corrigido?

**ANTES (linha 66 do trigger original):**
```sql
COALESCE(NEW.id::text, OLD.id::text)  -- ❌ Converte UUID para TEXT
```

**DEPOIS:**
```sql
COALESCE(NEW.id, OLD.id)  -- ✅ Mantém como UUID
```

A coluna `audit_logs.entity_id` é do tipo UUID, mas o trigger estava convertendo para TEXT causando incompatibilidade de tipos.

---

## Link Direto
https://supabase.com/dashboard/project/cgdshqmqsqwgwpjfmesr/sql/new
