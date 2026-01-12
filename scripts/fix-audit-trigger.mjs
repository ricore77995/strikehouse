#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

let SUPABASE_URL, SERVICE_ROLE_KEY;

try {
  const envContent = readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      envVars[key] = value;
    }
  });

  SUPABASE_URL = envVars.VITE_SUPABASE_URL;
  SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;
} catch (error) {
  console.error('❌ Failed to read .env file:', error.message);
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const fixSQL = `
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
                    COALESCE(NEW.id, OLD.id),
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
`;

console.log('🔧 Fixing audit trigger with SERVICE_ROLE_KEY...\n');

try {
  const { data, error } = await supabase.rpc('exec_sql', { sql: fixSQL });

  if (error) {
    throw error;
  }

  console.log('✅ Audit trigger fixed successfully!');
  console.log('   Entity_id now correctly uses UUID type.');
  console.log('   You can now create members without errors.\n');
} catch (error) {
  console.error('❌ Fix failed:', error.message);
  console.log('\n📝 Please apply manually via Supabase Dashboard:');
  console.log('   https://supabase.com/dashboard/project/cgdshqmqsqwgwpjfmesr/sql/new');
  console.log('\n   SQL to execute is in: FIX_AUDIT_TRIGGER.md\n');
  process.exit(1);
}
