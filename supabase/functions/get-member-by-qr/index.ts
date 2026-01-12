import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MemberData {
  nome: string;
  qr_code: string;
  status: string;
  access_type: string | null;
  access_expires_at: string | null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const qrCode = url.searchParams.get('qr_code');

    if (!qrCode) {
      return new Response(
        JSON.stringify({ error: 'QR code parameter is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create Supabase client with service role to bypass RLS
    // This is safe because we're only exposing minimal, non-sensitive member data
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch member data by QR code
    const { data: member, error } = await supabase
      .from('members')
      .select('nome, qr_code, status, access_type, access_expires_at')
      .eq('qr_code', qrCode)
      .single();

    if (error || !member) {
      return new Response(
        JSON.stringify({ error: 'QR code not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Return only safe, public member data
    const response: MemberData = {
      nome: member.nome,
      qr_code: member.qr_code,
      status: member.status,
      access_type: member.access_type,
      access_expires_at: member.access_expires_at,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error fetching member:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
