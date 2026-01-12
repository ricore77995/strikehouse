import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'path';

/**
 * Vitest configuration for integration tests
 *
 * These tests run against REAL Supabase database.
 * No mocks - all operations hit the actual database.
 *
 * Prerequisites:
 * 1. Supabase running (local or remote)
 * 2. .env file with SUPABASE_SERVICE_ROLE_KEY
 */
export default defineConfig(({ mode }) => {
  // Load env variables from .env (including non-prefixed vars)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    test: {
      include: ['src/tests/integration/**/*.test.ts'],
      exclude: ['src/tests/unit/**', 'e2e/**', 'node_modules/**'],
      setupFiles: ['./src/tests/fixtures/setup.ts'],
      testTimeout: 30000,
      hookTimeout: 30000,
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
      environment: 'node',
      sequence: {
        concurrent: false,
      },
      reporters: ['verbose'],
      // Pass env to tests
      env: {
        VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
