import * as dotenv from 'dotenv';
import { getServiceClient } from './helpers/api-client';

// Load environment variables from .env file
dotenv.config();

/**
 * Playwright Global Setup
 *
 * Runs once before all tests.
 * - Verifies Supabase connection
 * - Cleans up any leftover E2E data from previous runs
 */
async function globalSetup() {
  console.log('\n🧪 E2E Global Setup starting...');

  // Verify environment variables
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('❌ Missing environment variables:');
    console.error('   - VITE_SUPABASE_URL:', url ? '✓' : '✗ MISSING');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY:', key ? '✓' : '✗ MISSING');
    throw new Error(
      'E2E tests require VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  // Get service client
  const client = getServiceClient();

  // Verify connection by querying a simple table
  const { error } = await client.from('areas').select('id').limit(1);

  if (error) {
    console.error('❌ Supabase connection failed:', error.message);
    throw new Error(`Cannot connect to Supabase: ${error.message}`);
  }

  console.log('✅ Supabase connection verified');

  // Optional: Clean up any leftover E2E data from previous runs
  // This ensures a clean slate even if previous run crashed
  try {
    const { cleanupAllE2EData } = await import('./helpers/cleanup');
    await cleanupAllE2EData(client);
    console.log('✅ Previous E2E data cleaned up');
  } catch (cleanupError) {
    console.warn('⚠️ Cleanup warning:', cleanupError);
    // Continue even if cleanup fails - tests might still work
  }

  console.log('🚀 E2E Global Setup complete\n');
}

export default globalSetup;
