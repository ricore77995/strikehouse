-- Create audit trigger function
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
                    COALESCE(NEW.id::text, OLD.id::text),
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

-- Create triggers for main tables
DROP TRIGGER IF EXISTS audit_members ON members;
CREATE TRIGGER audit_members
    AFTER INSERT OR UPDATE OR DELETE ON members
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_transactions ON transactions;
CREATE TRIGGER audit_transactions
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_rentals ON rentals;
CREATE TRIGGER audit_rentals
    AFTER INSERT OR UPDATE OR DELETE ON rentals
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_plans ON plans;
CREATE TRIGGER audit_plans
    AFTER INSERT OR UPDATE OR DELETE ON plans
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_products ON products;
CREATE TRIGGER audit_products
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_sales ON sales;
CREATE TRIGGER audit_sales
    AFTER INSERT OR UPDATE OR DELETE ON sales
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cash_sessions ON cash_sessions;
CREATE TRIGGER audit_cash_sessions
    AFTER INSERT OR UPDATE OR DELETE ON cash_sessions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_external_coaches ON external_coaches;
CREATE TRIGGER audit_external_coaches
    AFTER INSERT OR UPDATE OR DELETE ON external_coaches
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_areas ON areas;
CREATE TRIGGER audit_areas
    AFTER INSERT OR UPDATE OR DELETE ON areas
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();