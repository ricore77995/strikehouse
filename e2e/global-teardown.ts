import { getServiceClient, resetClient } from './helpers/api-client';
import { cleanupAllE2EData } from './helpers/cleanup';

/**
 * Playwright Global Teardown
 *
 * Runs once after all tests complete.
 * - Cleans up ALL E2E test data (safety net)
 * - Resets client connection
 */
async function globalTeardown() {
  console.log('\n🧹 E2E Global Teardown starting...');

  try {
    const client = getServiceClient();
    await cleanupAllE2EData(client);
    console.log('✅ E2E test data cleaned up');
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    // Don't throw - teardown should complete even if cleanup fails
  }

  // Reset the client singleton
  resetClient();

  console.log('🏁 E2E Global Teardown complete\n');
}

export default globalTeardown;
