import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as postgres from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const pool = new postgres.Pool(Deno.env.get("SUPABASE_DB_URL")!, 3, true);
  const connection = await pool.connect();

  try {
    // Execute the fix SQL directly via PostgreSQL connection
    await connection.queryObject`
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

    return new Response(
      JSON.stringify({
        success: true,
        message: "Audit trigger fixed successfully"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  } finally {
    connection.release();
  }
});
