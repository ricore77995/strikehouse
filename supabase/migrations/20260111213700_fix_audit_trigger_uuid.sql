-- Fix audit trigger to use UUID instead of text for entity_id
-- This fixes the "column entity_id is of type uuid but expression is of type text" error

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
    -- Get current user info
    v_user_id := auth.uid();

    -- Get role from staff table
    SELECT role INTO v_user_role FROM staff WHERE user_id = v_user_id AND ativo = true LIMIT 1;

    -- If no staff found, use 'SYSTEM'
    IF v_user_role IS NULL THEN
        v_user_role := 'SYSTEM';
    END IF;

    -- Determine action and data
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

    -- Only log if we have a valid user (skip system operations without user)
    IF v_user_id IS NOT NULL THEN
        -- Find a staff record for this user to use as user_id reference
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
                    COALESCE(NEW.id, OLD.id), -- FIX: Remove ::text conversion
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
