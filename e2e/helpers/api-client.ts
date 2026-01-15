import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _serviceClient: SupabaseClient | null = null;

/**
 * Get Supabase service client (bypasses RLS)
 * Use this for creating/deleting test data
 */
export const getServiceClient = (): SupabaseClient => {
  if (_serviceClient) return _serviceClient;

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing environment variables: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for E2E tests'
    );
  }

  _serviceClient = createClient(url, key, {
    auth: { persistSession: false },
  });

  return _serviceClient;
};

/**
 * Reset client (useful for tests that need fresh client)
 */
export const resetClient = () => {
  _serviceClient = null;
};
