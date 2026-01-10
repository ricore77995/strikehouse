import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Test users to create
    const testUsers = [
      { email: "owner@boxemaster.pt", password: "owner123", nome: "João Owner", role: "OWNER" },
      { email: "admin@boxemaster.pt", password: "admin123", nome: "Maria Admin", role: "ADMIN" },
      { email: "staff@boxemaster.pt", password: "staff123", nome: "Pedro Staff", role: "STAFF" },
      { email: "partner@boxemaster.pt", password: "partner123", nome: "Ana Partner", role: "PARTNER" },
    ];

    const results = [];

    for (const user of testUsers) {
      // Check if user already exists in staff table
      const { data: existingStaff } = await supabase
        .from("staff")
        .select("id, email")
        .eq("email", user.email)
        .maybeSingle();

      if (existingStaff) {
        results.push({ email: user.email, status: "already exists" });
        continue;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      if (authError) {
        // User might already exist in auth, try to get their ID
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find((u) => u.email === user.email);
        
        if (existingUser) {
          // Create staff record for existing auth user
          const { error: staffError } = await supabase.from("staff").insert({
            user_id: existingUser.id,
            nome: user.nome,
            email: user.email,
            role: user.role,
            ativo: true,
          });

          if (staffError) {
            results.push({ email: user.email, status: "error", error: staffError.message });
          } else {
            results.push({ email: user.email, status: "staff created for existing auth user" });
          }
        } else {
          results.push({ email: user.email, status: "error", error: authError.message });
        }
        continue;
      }

      if (!authData.user) {
        results.push({ email: user.email, status: "error", error: "No user returned" });
        continue;
      }

      // Create staff record
      const { error: staffError } = await supabase.from("staff").insert({
        user_id: authData.user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        ativo: true,
      });

      if (staffError) {
        results.push({ email: user.email, status: "error", error: staffError.message });
      } else {
        results.push({ email: user.email, status: "created", role: user.role });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
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
  }
});
